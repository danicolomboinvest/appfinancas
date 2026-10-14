import { CATEGORIAS_FIXAS } from "@/lib/decisoes/semana-fixa";

type Soma = { parentCategory: string | null; spent: number };

/**
 * A semana passada do ritual é o dia a dia, como a semana do Resumo: sem as contas fixas (Moradia,
 * Educação, Impostos). Com elas, a semana do aluguel virava "285% acima da média" e "o que mais
 * pesou: Moradia", que não é o que ela pode mudar.
 */
export function semanaPassadaDoDiaADia(somas: Soma[][]): { total: number; media: number | null; maior: Soma | null } {
  const doDia = (s: Soma[]) => s.filter((g) => !CATEGORIAS_FIXAS.has(g.parentCategory ?? ""));
  const total = (s: Soma[]) => doDia(s).reduce((t, g) => t + g.spent, 0);
  const anteriores = somas.slice(1).map(total).filter((v) => v > 0);
  const maior = doDia(somas[0] ?? []).filter((g) => g.parentCategory).sort((a, b) => b.spent - a.spent)[0] ?? null;
  return { total: total(somas[0] ?? []), media: anteriores.length > 0 ? anteriores.reduce((s, v) => s + v, 0) / anteriores.length : null, maior };
}
