import type { ParentCategory } from "@prisma/client";
import { Tag, type LucideIcon } from "lucide-react";
import { CUSTOM_CATEGORY_ICON_MAP, categoryIcon, categoryLabel, colorForCategorySlice, type CategoriasDoPerfil } from "@/lib/categories";
import { chaveDaCategoria } from "@/lib/empresa/periodo";
import { nomeDaSaida, tipoDaSaida, type LancamentoDaEmpresa } from "@/lib/empresa/regras";

/**
 * As despesas da Empresa por categoria (15/10/2026, a Dani: "cadê as categorias?"): todas, as que
 * sobem com a venda, as contas fixas, os impostos e as categorias criadas por ela. Antes a aba
 * Despesas só listava as variáveis, e as categorias criadas (sempre fixas) nunca apareciam.
 * Usada na aba Despesas e no "Como vai" acumulado.
 */
export type CategoriaDaTela = { chave: string; nome: string; Icone: LucideIcon; cor: string; valor: number; n: number; tipo: "variavel" | "fixa"; /** O que tem dentro (as subcategorias, da maior para a menor). */ dentro: string[] };

/** As despesas por categoria do período: TODAS (variáveis, fixas, impostos e as criadas por ela). */
export function categoriasDasDespesas(doPeriodo: LancamentoDaEmpresa[], categorias: CategoriasDoPerfil, custom: Record<string, { nome: string; icone: string }>): CategoriaDaTela[] {
  const mapa = new Map<string, CategoriaDaTela>();
  const subs = new Map<string, Map<string, number>>();
  for (const l of doPeriodo) {
    const t = tipoDaSaida(l);
    if (t !== "variavel" && t !== "fixa" && t !== "imposto") continue;
    const chave = chaveDaCategoria(l);
    let c = mapa.get(chave);
    if (!c) {
      const ehCustom = !!l.customCategoryId;
      const parent = (l.parentCategory ?? "OUTROS") as ParentCategory;
      c = {
        chave,
        nome: ehCustom ? (custom[chave]?.nome ?? "Outra") : categoryLabel(categorias, parent),
        Icone: ehCustom ? (CUSTOM_CATEGORY_ICON_MAP[custom[chave]?.icone ?? ""] ?? Tag) : categoryIcon(categorias, parent),
        cor: colorForCategorySlice({ kind: ehCustom ? "custom" : "parent", value: chave }, categorias),
        valor: 0,
        n: 0,
        tipo: t === "variavel" ? "variavel" : "fixa",
        dentro: [],
      };
      mapa.set(chave, c);
    }
    c.valor += l.amount;
    c.n += 1;
    // Só a subcategoria (a descrição do extrato é comprida demais para a linha).
    if (l.subcategory?.trim()) {
      const m = subs.get(chave) ?? new Map<string, number>();
      const nome = nomeDaSaida(l);
      m.set(nome, (m.get(nome) ?? 0) + l.amount);
      subs.set(chave, m);
    }
  }
  return [...mapa.values()].map((c) => ({ ...c, valor: Math.round(c.valor * 100) / 100, dentro: [...(subs.get(c.chave) ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n) })).filter((c) => c.valor > 0).sort((a, b) => b.valor - a.valor);
}
