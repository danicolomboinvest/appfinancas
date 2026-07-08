import type { AuthContext } from "@/lib/auth/session";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { monthsElapsedInYear } from "@/lib/consolidation/realized-months";
import {
  listBudgetsForYear,
  sumExpensesByParentCategoryForYear,
  sumExpensesByCustomCategoryForYear,
} from "@/lib/repositories/budget.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";

export type CategoryComparison = {
  /** Valor de ParentCategory (categoria padrão) ou o `id` de uma CustomCategory. */
  categoryKey: string;
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

/**
 * Monta o comparativo de um mês a partir de listas já buscadas do banco — função pura, sem I/O.
 * `categoryKeys` é a lista completa de categorias a preencher (as 7 padrão + as personalizadas
 * do usuário) — assim uma categoria sem plano nem gasto ainda aparece como SEM_PLANO, em vez de
 * simplesmente não aparecer.
 */
export function buildMonthlyComparison(
  month: number,
  isRealized: boolean,
  categoryKeys: string[],
  budgets: { categoryKey: string; plannedAmount: number }[],
  spent: { categoryKey: string; spent: number }[],
): MonthlyPlannedVsActual {
  const plannedMap = new Map(budgets.map((b) => [b.categoryKey, b.plannedAmount]));
  const spentMap = new Map(spent.map((s) => [s.categoryKey, s.spent]));

  const categories: CategoryComparison[] = categoryKeys.map((categoryKey) => {
    const planned = plannedMap.get(categoryKey) ?? 0;
    const categorySpent = spentMap.get(categoryKey) ?? 0;
    const { deviationPercent, status } = compareCategoryBudget(planned, categorySpent);
    return { categoryKey, planned, spent: categorySpent, deviationPercent, status };
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
export function computeOverBudgetStreak(monthsDescending: MonthlyPlannedVsActual[], categoryKey: string): number {
  let streak = 0;
  for (const month of monthsDescending) {
    const category = month.categories.find((c) => c.categoryKey === categoryKey);
    if (category?.status === "ACIMA") {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

/** Orquestra os repositórios e monta o comparativo do ano inteiro (categorias padrão + personalizadas). */
export async function getAnnualPlannedVsActual(ctx: AuthContext, year: number): Promise<AnnualPlannedVsActual> {
  const [budgets, spent, customCategories, customSpent] = await Promise.all([
    listBudgetsForYear(ctx, year),
    sumExpensesByParentCategoryForYear(ctx, year),
    listCustomCategories(ctx),
    sumExpensesByCustomCategoryForYear(ctx, year),
  ]);

  const categoryKeys: string[] = [...PARENT_CATEGORIES, ...customCategories.map((c) => c.id)];
  const monthsElapsed = monthsElapsedInYear(year);

  const budgetsByMonth = new Map<number, { categoryKey: string; plannedAmount: number }[]>();
  const spentByMonth = new Map<number, { categoryKey: string; spent: number }[]>();
  for (let month = 1; month <= 12; month += 1) {
    budgetsByMonth.set(month, []);
    spentByMonth.set(month, []);
  }
  for (const b of budgets) {
    // Cada linha de Budget pertence a exatamente uma categoria: padrão (parentCategory) ou
    // personalizada (customCategoryId) — listBudgetsForYear já traz as duas juntas.
    const categoryKey = b.parentCategory ?? b.customCategoryId;
    if (!categoryKey) continue;
    budgetsByMonth.get(b.month)?.push({ categoryKey, plannedAmount: Number(b.plannedAmount) });
  }
  for (const s of spent) {
    spentByMonth.get(s.month)?.push({ categoryKey: s.parentCategory, spent: s.spent });
  }
  for (const s of customSpent) {
    spentByMonth.get(s.month)?.push({ categoryKey: s.customCategoryId, spent: s.spent });
  }

  const months: MonthlyPlannedVsActual[] = Array.from({ length: 12 }, (_, i) => i + 1).map((month) =>
    buildMonthlyComparison(
      month,
      month <= monthsElapsed,
      categoryKeys,
      budgetsByMonth.get(month) ?? [],
      spentByMonth.get(month) ?? [],
    ),
  );

  const realizedMonths = months.filter((m) => m.isRealized);
  const totalPlannedRealized = realizedMonths.reduce((sum, m) => sum + m.totalPlanned, 0);
  const totalSpentRealized = realizedMonths.reduce((sum, m) => sum + m.totalSpent, 0);

  return { year, months, totalPlannedRealized, totalSpentRealized };
}
