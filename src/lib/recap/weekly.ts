import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { PARENT_CATEGORY_LABEL } from "@/lib/categories";
import type { ParentCategory } from "@prisma/client";

export type WeekdaySpend = { label: string; value: number };

export type WeeklyRecap = {
  /** Rótulo do período, ex.: "6 de jul. — 12 de jul." */
  rangeLabel: string;
  weekSpent: number;
  prevWeekSpent: number;
  /** (weekSpent - prevWeekSpent) / prevWeekSpent; null quando não há base de comparação. */
  weekDeltaPercent: number | null;
  topCategory: { label: string; value: number } | null;
  /** Seg..Dom, sempre 7 posições. */
  byWeekday: WeekdaySpend[];
  bestDay: { label: string; value: number } | null;
  worstDay: { label: string; value: number } | null;
  /** Renda − gastos desde o primeiro lançamento ("ficou no bolso"). */
  allTimeSaved: number;
  /** Quantos meses de uso (mínimo 1) — base do ritmo. */
  monthsActive: number;
  avgMonthlySaving: number;
  /** Poupança média projetada a 10% a.a. por 10 anos. */
  projection10y: number;
  hasData: boolean;
};

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function fmtDay(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

/** Valor futuro de aportes mensais a 10% a.a. por 10 anos (juros compostos mensais). */
function futureValue(monthlyContribution: number): number {
  if (monthlyContribution <= 0) return 0;
  const i = 0.1 / 12;
  const n = 120;
  return monthlyContribution * ((Math.pow(1 + i, n) - 1) / i);
}

/**
 * Monta os dados do Resumo Semanal (stories): gastos da semana vs. anterior, por categoria e
 * por dia, quanto "ficou no bolso" desde o começo, e a projeção de 10 anos desse ritmo.
 * A data de referência de cada gasto é entryDate (quando existe) ou createdAt (fallback para
 * lançamentos antigos, de antes do campo).
 */
export async function computeWeeklyRecap(ctx: AuthContext): Promise<WeeklyRecap> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000); // últimos 7 dias
  const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [recentExpenses, allTime, firstEntry] = await Promise.all([
    // Gastos das 2 últimas semanas por qualquer uma das datas (entryDate nova ou createdAt).
    prisma.monthlyEntry.findMany({
      where: {
        userId: ctx.userId,
        category: "EXPENSE",
        OR: [{ entryDate: { gte: prevWeekStart } }, { entryDate: null, createdAt: { gte: prevWeekStart } }],
      },
      select: { amount: true, entryDate: true, createdAt: true, parentCategory: true },
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
  ]);

  const inWeek = (d: Date) => d >= weekStart;
  const inPrevWeek = (d: Date) => d >= prevWeekStart && d < weekStart;
  const refDate = (e: { entryDate: Date | null; createdAt: Date }) => e.entryDate ?? e.createdAt;

  let weekSpent = 0;
  let prevWeekSpent = 0;
  const byCategory = new Map<string, number>();
  const byWeekday = new Array(7).fill(0) as number[];

  for (const e of recentExpenses) {
    const d = refDate(e);
    const amount = Number(e.amount);
    if (inWeek(d)) {
      weekSpent += amount;
      const label = e.parentCategory ? PARENT_CATEGORY_LABEL[e.parentCategory as ParentCategory] : "Outros";
      byCategory.set(label, (byCategory.get(label) ?? 0) + amount);
      byWeekday[d.getDay()] += amount;
    } else if (inPrevWeek(d)) {
      prevWeekSpent += amount;
    }
  }

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
        (now.getFullYear() - firstEntry.createdAt.getFullYear()) * 12 + (now.getMonth() - firstEntry.createdAt.getMonth()) + 1,
      )
    : 1;
  const avgMonthlySaving = allTimeSaved / monthsActive;

  return {
    rangeLabel: `${fmtDay(weekStart)} — ${fmtDay(startOfToday)}`,
    weekSpent,
    prevWeekSpent,
    weekDeltaPercent: prevWeekSpent > 0 ? (weekSpent - prevWeekSpent) / prevWeekSpent : null,
    topCategory: topCategoryEntry ? { label: topCategoryEntry[0], value: topCategoryEntry[1] } : null,
    byWeekday: weekdaySeries,
    bestDay,
    worstDay,
    allTimeSaved,
    monthsActive,
    avgMonthlySaving,
    projection10y: futureValue(avgMonthlySaving),
    hasData: weekSpent > 0 || prevWeekSpent > 0 || sums.INCOME > 0 || sums.EXPENSE > 0,
  };
}
