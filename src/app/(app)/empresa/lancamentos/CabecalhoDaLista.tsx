"use client";

import type { ParentCategory } from "@prisma/client";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { categoryLabel } from "@/lib/categories";
import { rotuloDoPeriodo, type Grupo, type PeriodoDaEmpresa } from "@/lib/empresa/periodo";

/** O nome de cada lista, em palavras de dona. */
function nomeDoGrupo(g: Grupo | null, ehMei: boolean, custom: Record<string, { nome: string }>, nomeDaMae: (k: ParentCategory) => string): string {
  if (!g) return "Lançamentos";
  if (g === "entradas") return "Entradas";
  if (g === "despesas") return "Despesas";
  if (g === "variaveis") return "Insumos e entregas";
  if (g === "fixas") return "Contas do mês";
  if (g === "lucro") return "Entradas e despesas";
  if (g === "prolabore") return "Seu salário";
  if (g === "impostos") return ehMei ? "Guia do MEI" : "Impostos";
  if (g.startsWith("cat:")) {
    const k = g.slice(4);
    return custom[k]?.nome ?? nomeDaMae(k as ParentCategory);
  }
  if (g.startsWith("saida:")) return g.slice(6);
  return g.slice(8).trim() || "Balcão e sem nome";
}

/** O topo da lista editável: o que é, de quando, o total e quantos lançamentos. */
export function CabecalhoDaLista({ grupo, periodo, hoje, total, n, ehMei, custom }: { grupo: Grupo | null; periodo: PeriodoDaEmpresa; hoje: string; total: number; n: number; ehMei: boolean; custom: Record<string, { nome: string }> }) {
  const money = useMoney();
  const { categorias } = useProfileTheme();
  const rotulo = rotuloDoPeriodo(periodo, hoje);
  const nome = nomeDoGrupo(grupo, ehMei, custom, (k) => categoryLabel(categorias, k));
  return (
    <HeroiDoTema>
      <div className="flex flex-col gap-0.5">
        <h1 className="titulo-tema text-[1.5rem] font-medium leading-tight">{nome}</h1>
        <p className="text-sm text-heroi-suave">
          {rotulo.nome} {rotulo.sub && <span>· {rotulo.sub}</span>}
        </p>
      </div>
      <ValorDestaque texto={total < 0 ? `−${money(-total)}` : money(total)} />
      <p className="text-sm text-heroi-suave">
        {n} {n === 1 ? "lançamento" : "lançamentos"}. Toque em um para editar.
      </p>
    </HeroiDoTema>
  );
}
