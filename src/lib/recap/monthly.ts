import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { categoryLabel } from "@/lib/categories";
import { fv } from "@/lib/finance/fv";
import { annualToMonthly } from "@/lib/finance/rate-conversion";
import type { ParentCategory } from "@prisma/client";
import { nowInBrazil } from "@/lib/date/brazil-now";

export type WeekdaySpend = { label: string; value: number };

export type MonthlyRecap = {
  /** Rótulo do mês recapeado, ex.: "Julho de 2026". */
  rangeLabel: string;
  monthSpent: number;
  prevMonthSpent: number;
  /** (monthSpent - prevMonthSpent) / prevMonthSpent; null quando não há base de comparação. */
  monthDeltaPercent: number | null;
  topCategory: { label: string; value: number } | null;
  /** Seg..Dom, sempre 7 posições — distribuição de gasto por dia da semana no mês inteiro
   * (só o que tem dia: compra de fatura importada fica de fora, ver weekdayOfExpense). */
  byWeekday: WeekdaySpend[];
  bestDay: { label: string; value: number } | null;
  worstDay: { label: string; value: number } | null;
  /** Renda − gastos desde o primeiro lançamento até o mês RECAPEADO ("ficou no bolso").
   * Acumulado, não é média; meses depois dele (recorrência, parcelas, o mês novo) ficam de fora. */
  allTimeSaved: number;
  /** Quantos meses de uso (mínimo 1), só para a frase "desde que você chegou aqui". */
  monthsActive: number;
  /** Poupança MÉDIA de verdade: total poupado no ano (até o mês recapeado) ÷ meses com
   * lançamento nesse ano. Não confundir com allTimeSaved (esse é acumulado, não é por mês). */
  avgMonthlySaving: number;
  /** allTimeSaved investido de uma vez, a 10% a.a. por 10 anos (o que already existe hoje vira patrimônio). */
  lumpSumProjection10y: number;
  /** Mantendo avgMonthlySaving todo mês, reinvestindo, por 10 anos a 10% a.a. */
  recurringProjection10y: number;
  hasData: boolean;
};

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PROJECTION_ANNUAL_RATE = 0.1;
const PROJECTION_YEARS = 10;

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/**
 * Em que dia da semana (0 = domingo) o gasto aconteceu, pro gráfico "por dia da semana".
 *
 * Pelo `entryDate` (coluna só de data, gravada à meia-noite UTC — por isso getUTCDay). Sem
 * data, o `createdAt` só serve quando o lançamento foi digitado à mão DENTRO do mês recapeado
 * (o dia em que ela lançou é o dia do gasto). Compra de fatura importada, parcela futura e cópia
 * de despesa recorrente não têm dia: o createdAt delas é o dia da importação ou de janeiro, e
 * jogaria a fatura inteira numa terça-feira qualquer.
 */
export function weekdayOfExpense(
  e: { entryDate: Date | null; createdAt: Date; importBatchId: string | null },
  year: number,
  month: number,
): number | null {
  if (e.entryDate) return e.entryDate.getUTCDay();
  if (e.importBatchId) return null;
  const criado = nowInBrazil(e.createdAt);
  if (criado.getFullYear() !== year || criado.getMonth() + 1 !== month) return null;
  return criado.getDay();
}

/**
 * A maior categoria do mês, pelo nome que a pessoa vê na tela do mês (getCategorySpending):
 * categoria-mãe pelo rótulo do perfil, personalizada pelo NOME dela. Antes toda personalizada
 * virava "Outros" (ela tem parentCategory nulo), e Pet R$ 900 + Academia R$ 600 davam "A maior
 * parte foi para Outros", uma categoria que ela não usa.
 *
 * Gasto sem categoria nenhuma não entra no ranking (como na tela do mês): não é um lugar pra
 * onde o dinheiro foi, é lançamento por classificar.
 */
export function maiorCategoriaDoMes(
  gastos: { amount: number; parentCategory: string | null; customCategoryId: string | null }[],
  rotulo: (g: { parentCategory: string | null; customCategoryId: string | null }) => string,
): { label: string; value: number } | null {
  const porChave = new Map<string, { label: string; value: number }>();
  for (const g of gastos) {
    const chave = g.parentCategory ? `parent:${g.parentCategory}` : g.customCategoryId ? `custom:${g.customCategoryId}` : null;
    if (!chave) continue;
    const atual = porChave.get(chave) ?? { label: rotulo(g), value: 0 };
    atual.value += g.amount;
    porChave.set(chave, atual);
  }
  const maior = [...porChave.values()].sort((a, b) => b.value - a.value)[0];
  return maior && maior.value > 0 ? maior : null;
}

/**
 * Qual mês recapear e se o card deve aparecer agora: só no fim do mês corrente (dia >= 25) ou
 * no começo do mês seguinte (dia <= 7), e só se esse mês ainda não foi fechado pelo usuário
 * (User.recapDismissedMonth). Fora dessa janela, ou já visto, o card não aparece.
 */
export function getRecapEligibility(
  now: Date,
  recapDismissedMonth: string | null,
): { eligible: boolean; year: number; month: number; monthKey: string } {
  const day = now.getDate();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // recapeia o mês CORRENTE (quase fechado)
  if (day <= 7) {
    // Início do mês: recapeia o mês ANTERIOR (já fechado de verdade).
    const prev = new Date(year, month - 2, 1);
    year = prev.getFullYear();
    month = prev.getMonth() + 1;
  } else if (day < 25) {
    // Meio do mês: fora da janela, não mostra nada.
    return { eligible: false, year, month, monthKey: `${year}-${String(month).padStart(2, "0")}` };
  }
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  return { eligible: recapDismissedMonth !== monthKey, year, month, monthKey };
}

/**
 * Monta os dados do Resumo Mensal (stories): gastos do mês vs. anterior, por categoria e por
 * dia da semana, quanto "ficou no bolso" desde o começo, e as duas projeções de 10 anos —
 * uma do que JÁ tem acumulado (investido de uma vez) e outra da poupança média mensal de
 * verdade (reinvestida todo mês), sem misturar as duas.
 *
 * O gasto do mês é o do ano/mês do lançamento — a mesma conta do Fluxo e do e-mail. Antes ia
 * pela data de criação quando o lançamento não tinha dia, e a fatura de agosto importada em
 * setembro (mais as 9 parcelas futuras que a importação cria) entrava como gasto de setembro.
 * A data só decide o dia da semana (ver weekdayOfExpense).
 */
export async function computeMonthlyRecap(ctx: AuthContext, year: number, month: number): Promise<MonthlyRecap> {
  const prev = new Date(year, month - 2, 1);
  // "Desde o começo" vai até o mês RECAPEADO, não até hoje: a despesa recorrente de outubro a
  // dezembro e as parcelas futuras já existem no banco, mas ainda não saíram do bolso. E no dia
  // 2/10 o resumo é de setembro: com o corte em hoje, o aluguel e as parcelas de outubro entravam
  // sem o salário de outubro, e o "no bolso" de setembro saía menor (às vezes negativo).
  const jaAconteceu = {
    OR: [{ year: { lt: year } }, { year, month: { lte: month } }],
  };

  const [monthExpenses, prevMonthAgg, allTime, firstEntry, yearAgg, personalizadas] = await Promise.all([
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", year, month },
      select: { amount: true, entryDate: true, createdAt: true, importBatchId: true, parentCategory: true, customCategoryId: true },
    }),
    prisma.monthlyEntry.aggregate({
      where: {
        userId: ctx.userId, profileId: ctx.profileId,
        category: "EXPENSE",
        year: prev.getFullYear(),
        month: prev.getMonth() + 1,
      },
      _sum: { amount: true },
    }),
    prisma.monthlyEntry.groupBy({
      by: ["category"],
      where: { userId: ctx.userId, profileId: ctx.profileId, ...jaAconteceu },
      _sum: { amount: true },
    }),
    prisma.monthlyEntry.findFirst({
      where: { userId: ctx.userId, profileId: ctx.profileId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    // Poupança média REAL do ano (até o mês recapeado): agrupa por mês pra saber quantos
    // meses de fato têm lançamento (não é "meses corridos desde o início").
    prisma.monthlyEntry.groupBy({
      by: ["year", "month", "category"],
      where: { userId: ctx.userId, profileId: ctx.profileId, year, month: { lte: month } },
      _sum: { amount: true },
    }),
    // Nomes das categorias personalizadas, pra maior categoria sair com o nome que ela deu.
    prisma.customCategory.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, select: { id: true, name: true } }),
  ]);
  const nomeDaPersonalizada = new Map(personalizadas.map((c) => [c.id, c.name]));

  let monthSpent = 0;
  const byWeekday = new Array(7).fill(0) as number[];

  for (const e of monthExpenses) {
    const amount = Number(e.amount);
    monthSpent += amount;
    const weekday = weekdayOfExpense(e, year, month);
    if (weekday !== null) byWeekday[weekday] += amount;
  }
  const prevMonthSpent = Number(prevMonthAgg._sum.amount ?? 0);

  const topCategory = maiorCategoriaDoMes(
    monthExpenses.map((e) => ({ amount: Number(e.amount), parentCategory: e.parentCategory, customCategoryId: e.customCategoryId })),
    (g) =>
      g.parentCategory
        ? categoryLabel(ctx.profileKind, g.parentCategory as ParentCategory)
        : (nomeDaPersonalizada.get(g.customCategoryId ?? "") ?? "Personalizada"),
  );
  const weekdaySeries: WeekdaySpend[] = Array.from({ length: 7 }, (_, i) => {
    // Começa em segunda (getDay: 0=Dom) pra ler como semana BR: Seg..Dom.
    const dayIndex = (i + 1) % 7;
    return { label: WEEKDAY_SHORT[dayIndex], value: byWeekday[dayIndex] };
  });
  const daysWithSpend = weekdaySeries.filter((d) => d.value > 0);
  const worstDay = daysWithSpend.length > 0 ? daysWithSpend.reduce((max, d) => (d.value > max.value ? d : max)) : null;
  const bestDay = daysWithSpend.length > 0 ? daysWithSpend.reduce((min, d) => (d.value < min.value ? d : min)) : null;

  const sums = { INCOME: 0, EXPENSE: 0, INVESTMENT_CONTRIBUTION: 0 };
  for (const g of allTime) sums[g.category] = Number(g._sum.amount ?? 0);
  const allTimeSaved = sums.INCOME - sums.EXPENSE;

  const monthsActive = firstEntry
    ? Math.max(
        1,
        (new Date().getFullYear() - firstEntry.createdAt.getFullYear()) * 12 +
          (new Date().getMonth() - firstEntry.createdAt.getMonth()) +
          1,
      )
    : 1;

  // Poupança média real: soma renda-gasto do ano (até o mês recapeado) ÷ meses PREENCHIDOS
  // (não meses corridos) — sem isso, um valor acumulado de vários meses vira "poupança do mês".
  const yearSums = { INCOME: 0, EXPENSE: 0 };
  const filledMonths = new Set<number>();
  for (const g of yearAgg) {
    if (g.category === "INCOME" || g.category === "EXPENSE") yearSums[g.category] += Number(g._sum.amount ?? 0);
    filledMonths.add(g.month);
  }
  const monthsFilled = Math.max(1, filledMonths.size);
  const avgMonthlySaving = (yearSums.INCOME - yearSums.EXPENSE) / monthsFilled;

  const monthlyRate = annualToMonthly(PROJECTION_ANNUAL_RATE);
  const nper = PROJECTION_YEARS * 12;
  const lumpSumProjection10y = fv(monthlyRate, nper, 0, Math.max(0, allTimeSaved)).toNumber();
  const recurringProjection10y = fv(monthlyRate, nper, Math.max(0, avgMonthlySaving), 0).toNumber();

  return {
    rangeLabel: monthLabel(year, month),
    monthSpent,
    prevMonthSpent,
    monthDeltaPercent: prevMonthSpent > 0 ? (monthSpent - prevMonthSpent) / prevMonthSpent : null,
    topCategory,
    byWeekday: weekdaySeries,
    bestDay,
    worstDay,
    allTimeSaved,
    monthsActive,
    avgMonthlySaving,
    lumpSumProjection10y,
    recurringProjection10y,
    hasData: monthSpent > 0 || prevMonthSpent > 0 || sums.INCOME > 0 || sums.EXPENSE > 0,
  };
}
