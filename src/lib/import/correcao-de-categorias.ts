import type { ParentCategory } from "@prisma/client";

/**
 * Lançamentos antigos que o app categorizou errado sozinho (21/10/2026, aprovado pela Dani):
 * - 99 Food entrava como Transporte: a base comunitária guardava "99food" e o app passou a
 *   procurar "99 food", caindo no "99" das corridas.
 * - Cacau Show entrava como Lazer: uma versão antiga lia o "show" do nome como Cinema/Shows, e a
 *   base aprendeu o erro.
 *
 * Só mexe no que foi o APP que decidiu: lançamento importado, sem categoria própria dela, e de
 * quem não ensinou ao app essa mesma categoria para essa loja (a regra dela manda).
 */
export type Correcao = { nome: string; descricao: RegExp; errada: ParentCategory; certa: { parentCategory: ParentCategory; subcategory: string } };

export const CORRECOES: Correcao[] = [
  { nome: "99 Food", descricao: /\b99\s*food\b/i, errada: "TRANSPORTE", certa: { parentCategory: "ALIMENTACAO", subcategory: "Delivery" } },
  { nome: "Cacau Show", descricao: /\bcacau\s*show\b/i, errada: "LAZER", certa: { parentCategory: "ALIMENTACAO", subcategory: "Lanche/Café" } },
];

export type LancamentoParaCorrigir = {
  id: string;
  userId: string;
  description: string | null;
  parentCategory: ParentCategory | null;
  subcategory: string | null;
  customCategoryId: string | null;
  importBatchId: string | null;
};
export type RegraDaCliente = { userId: string; pattern: string; parentCategory: ParentCategory };

export type Mudanca = {
  id: string;
  correcao: string;
  de: { parentCategory: ParentCategory; subcategory: string | null };
  para: { parentCategory: ParentCategory; subcategory: string };
};
export type MotivoPulado = "escrito_a_mao" | "categoria_dela" | "ela_ensinou";

export function planejarCorrecao(
  lancamentos: LancamentoParaCorrigir[],
  regras: RegraDaCliente[],
): { mudancas: Mudanca[]; pulados: Record<MotivoPulado, number> } {
  const pulados: Record<MotivoPulado, number> = { escrito_a_mao: 0, categoria_dela: 0, ela_ensinou: 0 };
  const mudancas: Mudanca[] = [];
  for (const l of lancamentos) {
    const c = CORRECOES.find((x) => l.parentCategory === x.errada && x.descricao.test(l.description ?? ""));
    if (!c) continue;
    if (l.customCategoryId) {
      pulados.categoria_dela++;
      continue;
    }
    if (!l.importBatchId) {
      pulados.escrito_a_mao++;
      continue;
    }
    if (regras.some((r) => r.userId === l.userId && r.parentCategory === c.errada && c.descricao.test(r.pattern))) {
      pulados.ela_ensinou++;
      continue;
    }
    mudancas.push({ id: l.id, correcao: c.nome, de: { parentCategory: c.errada, subcategory: l.subcategory }, para: c.certa });
  }
  return { mudancas, pulados };
}
