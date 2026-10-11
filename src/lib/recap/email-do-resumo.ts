import type { Titulos } from "@/lib/profiles/voice";
import { sobrouDoMes } from "@/lib/consolidation/sobrou";

/**
 * O que a rota do resumo mensal manda pro modelo do e-mail (monthlyRecapEmail).
 *
 * 1) O valor grande é o SOBROU da regra única do app: entrou − gastou − guardou (versão nova,
 *    11/10/2026; ver lib/consolidation/sobrou.ts). Positivo é "sobrou", zero é "empatou" e
 *    negativo é "faltou", sempre sem sinal. Embaixo, Entrou, Gastou e Guardou fecham a conta.
 *    Antes o e-mail mostrava renda − gastos e o guardado à parte, e o número não batia com o
 *    da tela.
 *
 * 2) O botão leva pro fechamento do mês (/mensal/foco/fechamento), então fala disso: "Fechar
 *    setembro", e não "Ver o mês completo".
 *
 * Os rótulos trocados só valem pra este e-mail: a rota passa esta cópia do catálogo ao modelo.
 */
export function ajustarResumoPorEmail(
  t: Titulos,
  valores: { income: number; expense: number; investment: number },
  mesNome: string,
  /** Perfil Empresa: a linha do guardado continua com o termo de negócio ("Reteve"). */
  empresa = false,
): { balance: number; t: Titulos } {
  const balance = sobrouDoMes({ entrou: valores.income, gastou: valores.expense, guardou: valores.investment });
  return {
    balance,
    t: {
      ...t,
      emailRecapBotao: t.emailRecapBotaoFechar(mesNome),
      ...(!empresa ? { aportou: t.emailRecapGuardou } : {}),
    },
  };
}

const ROTULOS_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Os `n` meses que terminam no do resumo, do mais antigo ao dele: o gráfico Entrou x Gastou. */
export function mesesDoGrafico(year: number, month: number, n = 6): { year: number; month: number; rotulo: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(year, month - 1 - (n - 1 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1, rotulo: ROTULOS_CURTOS[d.getMonth()] };
  });
}

/**
 * A série do gráfico a partir da soma por mês e tipo. Os meses antes do primeiro movimento ficam
 * de fora (conta nova não ganha cinco colunas vazias); o mês do resumo fica sempre.
 */
export function serieDoGrafico(
  meses: { year: number; month: number; rotulo: string }[],
  somas: { year: number; month: number; category: string; total: number }[],
): { rotulo: string; entrou: number; gastou: number }[] {
  const de = (m: { year: number; month: number }, cat: string) => somas.filter((s) => s.year === m.year && s.month === m.month && s.category === cat).reduce((t, s) => t + s.total, 0);
  const serie = meses.map((m) => ({ rotulo: m.rotulo, entrou: de(m, "INCOME"), gastou: de(m, "EXPENSE") }));
  const primeiro = serie.findIndex((m) => m.entrou > 0 || m.gastou > 0);
  return primeiro < 0 ? serie.slice(-1) : serie.slice(Math.min(primeiro, serie.length - 1));
}

/**
 * As categorias que mais pesaram no mês, com o plano de cada (0 = sem plano). Mesma chave da
 * maior categoria (maiorCategoriaDoMes): mãe pelo rótulo do perfil, personalizada pelo nome.
 */
export function categoriasDoResumo(
  gastos: { amount: number; parentCategory: string | null; customCategoryId: string | null }[],
  planos: { parentCategory: string | null; customCategoryId: string | null; planned: number }[],
  rotulo: (g: { parentCategory: string | null; customCategoryId: string | null }) => string,
  limite = 3,
): { chave: string | null; nome: string; gasto: number; plano: number }[] {
  const chaveDe = (g: { parentCategory: string | null; customCategoryId: string | null }) =>
    g.customCategoryId ? `custom:${g.customCategoryId}` : g.parentCategory ? `parent:${g.parentCategory}` : null;
  const planoPor = new Map<string, number>();
  for (const p of planos) {
    const k = chaveDe(p);
    if (k) planoPor.set(k, (planoPor.get(k) ?? 0) + p.planned);
  }
  const porChave = new Map<string, { chave: string | null; nome: string; gasto: number; plano: number }>();
  for (const g of gastos) {
    const k = chaveDe(g);
    if (!k) continue;
    const atual = porChave.get(k) ?? { chave: g.customCategoryId ? null : g.parentCategory, nome: rotulo(g), gasto: 0, plano: planoPor.get(k) ?? 0 };
    atual.gasto += g.amount;
    porChave.set(k, atual);
  }
  return [...porChave.values()].filter((c) => c.gasto > 0).sort((a, b) => b.gasto - a.gasto).slice(0, limite);
}
