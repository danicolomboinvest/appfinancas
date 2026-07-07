import type { ParentCategory } from "@prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { monthsElapsedInYear } from "@/lib/consolidation/realized-months";
import { listBudgetsForYear, sumExpensesByParentCategoryForYear } from "@/lib/repositories/budget.repo";

export type CategoryComparison = {
  parentCategory: ParentCategory;
  planned: number;
  spent: number;
  /** (spent - planned) / planned — positivo = estourou, negativo = economizou. null se não há plano. */
  deviationPercent: number | null;
  status: "DENTRO" | "ACIMA" | "SEM_PLANO";
};

export type MonthlyPlannedVsActual = {
  month: number;
  /** false para meses futuros — mesma semântica de `MonthlyBreakdown.isRealized` em consolidation/yearly.ts. */
  isRealized: boolean;
  totalPlanned: number;
  totalSpent: number;
  categories: CategoryComparison[];
};

export type AnnualPlannedVsActual = {
  year: number;
  months: MonthlyPlannedVsActual[];
  /** Soma só dos meses já ocorridos — nunca conte meses futuros como "gasto". */
  totalPlannedRealized: number;
  totalSpentRealized: number;
};

/** Compara planejado x gasto de uma única categoria — função pura, sem I/O. */
export function compareCategoryBudget(
  planned: number,
  spent: number,
): { deviationPercent: number | null; status: CategoryComparison["status"] } {
  if (planned <= 0) {
    return { deviationPercent: null, status: "SEM_PLANO" };
  }
  const deviationPercent = (spent - planned) / planned;
  return { deviationPercent, status: spent > planned ? "ACIMA" : "DENTRO" };
}

/** Monta o comparativo de um mês a partir de listas já buscadas do banco — função pura, sem I/O. */
export function buildMonthlyComparison(
  month: number,
  isRealized: boolean,
  budgets: { parentCategory: ParentCategory; plannedAmount: number }[],
  spent: { parentCategory: ParentCategory; spent: number }[],
): MonthlyPlannedVsActual {
  const plannedMap = new Map(budgets.map((b) => [b.parentCategory, b.plannedAmount]));
  const spentMap = new Map(spent.map((s) => [s.parentCategory, s.spent]));

  const categories: CategoryComparison[] = PARENT_CATEGORIES.map((parentCategory) => {
    const planned = plannedMap.get(parentCategory) ?? 0;
    const categorySpent = spentMap.get(parentCategory) ?? 0;
    const { deviationPercent, status } = compareCategoryBudget(planned, categorySpent);
    return { parentCategory, planned, spent: categorySpent, deviationPercent, status };
  });

  const totalPlanned = categories.reduce((sum, c) => sum + c.planned, 0);
  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);

  return { month, isRealized, totalPlanned, totalSpent, categories };
}

/** "Economia no mês": planejado - gasto (positivo = economizou, negativo = estourou o total). */
export function computeMonthSavings(comparison: MonthlyPlannedVsActual): number {
  return comparison.totalPlanned - comparison.totalSpent;
}

/** "Categoria que mais estourou": maior desvio percentual positivo entre categorias com plano definido. */
export function findBiggestOverrun(categories: CategoryComparison[]): CategoryComparison | null {
  const overruns = categories.filter(
    (c): c is CategoryComparison & { deviationPercent: number } => c.status === "ACIMA" && c.deviationPercent !== null,
  );
  if (overruns.length === 0) return null;
  return overruns.reduce((max, c) => (c.deviationPercent > max.deviationPercent ? c : max));
}

/** "Melhor categoria": maior economia percentual (desvio mais negativo) entre categorias com plano definido. */
export function findBiggestSaving(categories: CategoryComparison[]): CategoryComparison | null {
  const savings = categories.filter(
    (c): c is CategoryComparison & { deviationPercent: number } =>
      c.status !== "SEM_PLANO" && c.deviationPercent !== null && c.deviationPercent < 0,
  );
  if (savings.length === 0) return null;
  return savings.reduce((min, c) => (c.deviationPercent < min.deviationPercent ? c : min));
}

/**
 * Meses consecutivos (a partir do mês mais recente, andando para trás) em que uma categoria
 * específica excedeu o orçamento. Limitado aos meses do array recebido — não cruza virada de
 * ano no v1 (cruzar dez/jan é um passo futuro, se necessário).
 */
export function computeOverBudgetStreak(monthsDescending: MonthlyPlannedVsActual[], parentCategory: ParentCategory): number {
  let streak = 0;
  for (const month of monthsDescending) {
    const category = month.categories.find((c) => c.parentCategory === parentCategory);
    if (category?.status === "ACIMA") {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

/** Orquestra os repositórios e monta o comparativo do ano inteiro. */
export async function getAnnualPlannedVsActual(ctx: AuthContext, year: number): Promise<AnnualPlannedVsActual> {
  const [budgets, spent] = await Promise.all([
    listBudgetsForYear(ctx, year),
    sumExpensesByParentCategoryForYear(ctx, year),
  ]);

  const monthsElapsed = monthsElapsedInYear(year);

  const budgetsByMonth = new Map<number, { parentCategory: ParentCategory; plannedAmount: number }[]>();
  const spentByMonth = new Map<number, { parentCategory: ParentCategory; spent: number }[]>();
  for (let month = 1; month <= 12; month += 1) {
    budgetsByMonth.set(month, []);
    spentByMonth.set(month, []);
  }
  for (const b of budgets) {
    budgetsByMonth.get(b.month)?.push({ parentCategory: b.parentCategory, plannedAmount: Number(b.plannedAmount) });
  }
  for (const s of spent) {
    spentByMonth.get(s.month)?.push({ parentCategory: s.parentCategory, spent: s.spent });
  }

  const months: MonthlyPlannedVsActual[] = Array.from({ length: 12 }, (_, i) => i + 1).map((month) =>
    buildMonthlyComparison(month, month <= monthsElapsed, budgetsByMonth.get(month) ?? [], spentByMonth.get(month) ?? []),
  );

  const realizedMonths = months.filter((m) => m.isRealized);
  const totalPlannedRealized = realizedMonths.reduce((sum, m) => sum + m.totalPlanned, 0);
  const totalSpentRealized = realizedMonths.reduce((sum, m) => sum + m.totalSpent, 0);

  return { year, months, totalPlannedRealized, totalSpentRealized };
}
