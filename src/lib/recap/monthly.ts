import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { PARENT_CATEGORY_LABEL } from "@/lib/categories";
import { fv } from "@/lib/finance/fv";
import { annualToMonthly } from "@/lib/finance/rate-conversion";
import type { ParentCategory } from "@prisma/client";

export type WeekdaySpend = { label: string; value: number };

export type MonthlyRecap = {
  /** Rótulo do mês recapeado, ex.: "Julho de 2026". */
  rangeLabel: string;
  monthSpent: number;
  prevMonthSpent: number;
  /** (monthSpent - prevMonthSpent) / prevMonthSpent; null quando não há base de comparação. */
  monthDeltaPercent: number | null;
  topCategory: { label: string; value: number } | null;
  /** Seg..Dom, sempre 7 posições — distribuição de gasto por dia da semana no mês inteiro. */
  byWeekday: WeekdaySpend[];
  bestDay: { label: string; value: number } | null;
  worstDay: { label: string; value: number } | null;
  /** Renda − gastos desde o primeiro lançamento ("ficou no bolso"). Acumulado, não é média. */
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

/** Início e fim (exclusivo) de um mês corrido, em horário local. */
function monthRange(year: number, month: number): { start: Date; end: Date } {
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
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
 * A data de referência de cada gasto é entryDate (quando existe) ou createdAt (fallback para
 * lançamentos antigos, de antes do campo).
 */
export async function computeMonthlyRecap(ctx: AuthContext, year: number, month: number): Promise<MonthlyRecap> {
  const { start: monthStart, end: monthEnd } = monthRange(year, month);
  const prev = new Date(year, month - 2, 1);
  const { start: prevMonthStart } = monthRange(prev.getFullYear(), prev.getMonth() + 1);

  const [monthExpenses, prevMonthAgg, allTime, firstEntry, yearAgg] = await Promise.all([
    // Gastos do mês recapeado, por qualquer uma das datas (entryDate nova ou createdAt).
    prisma.monthlyEntry.findMany({
      where: {
        userId: ctx.userId,
        category: "EXPENSE",
        OR: [
          { entryDate: { gte: monthStart, lt: monthEnd } },
          { entryDate: null, createdAt: { gte: monthStart, lt: monthEnd } },
        ],
      },
      select: { amount: true, entryDate: true, createdAt: true, parentCategory: true },
    }),
    prisma.monthlyEntry.aggregate({
      where: {
        userId: ctx.userId,
        category: "EXPENSE",
        OR: [
          { entryDate: { gte: prevMonthStart, lt: monthStart } },
          { entryDate: null, createdAt: { gte: prevMonthStart, lt: monthStart } },
        ],
      },
      _sum: { amount: true },
    }),
    prisma.monthlyEntry.groupBy({
      by: ["category"],
      where: { userId: ctx.userId },
      _sum: { amount: true },
    }),
    prisma.monthlyEntry.findFirst({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    // Poupança média REAL do ano (até o mês recapeado): agrupa por mês pra saber quantos
    // meses de fato têm lançamento (não é "meses corridos desde o início").
    prisma.monthlyEntry.groupBy({
      by: ["year", "month", "category"],
      where: { userId: ctx.userId, year, month: { lte: month } },
      _sum: { amount: true },
    }),
  ]);

  const refDate = (e: { entryDate: Date | null; createdAt: Date }) => e.entryDate ?? e.createdAt;

  let monthSpent = 0;
  const byCategory = new Map<string, number>();
  const byWeekday = new Array(7).fill(0) as number[];

  for (const e of monthExpenses) {
    const d = refDate(e);
    const amount = Number(e.amount);
    monthSpent += amount;
    const label = e.parentCategory ? PARENT_CATEGORY_LABEL[e.parentCategory as ParentCategory] : "Outros";
    byCategory.set(label, (byCategory.get(label) ?? 0) + amount);
    byWeekday[d.getDay()] += amount;
  }
  const prevMonthSpent = Number(prevMonthAgg._sum.amount ?? 0);

  const topCategoryEntry = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
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
    topCategory: topCategoryEntry ? { label: topCategoryEntry[0], value: topCategoryEntry[1] } : null,
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
