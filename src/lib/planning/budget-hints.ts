import type { AuthContext } from "@/lib/auth/session";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { sumExpensesByParentCategory, sumExpensesByCustomCategory } from "@/lib/repositories/budget.repo";

export type BudgetHints = {
  /** "agosto" — o último mês fechado, que é a referência de "copiar" e de "entrou". */
  lastMonthLabel: string;
  lastMonthIncome: number;
  /** Gasto do último mês fechado por categoria (chave = ParentCategory ou id de personalizada). */
  lastMonthByCategory: Record<string, number>;
  /** Média dos últimos 3 meses fechados por categoria: base do "Sugerir pra mim". */
  averageByCategory: Record<string, number>;
  /** Meses que ainda faltam no ano (contando o atual): pra "R$ X guardados até dezembro". */
  monthsLeftInYear: number;
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function shift(year: number, month: number, back: number): { year: number; month: number } {
  const d = new Date(year, month - 1 - back, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * O que o app já sabe antes de perguntar: quanto entrou no mês passado, quanto saiu em cada
 * categoria, e a média dos últimos três meses. É o que deixa o orçamento começar preenchido
 * em vez de em branco — a pessoa ajusta, não inventa.
 */
export async function getBudgetHints(ctx: AuthContext, year: number, today: Date = new Date()): Promise<BudgetHints> {
  const isCurrentYear = year === today.getFullYear();
  const ref = isCurrentYear ? shift(today.getFullYear(), today.getMonth() + 1, 1) : { year, month: 12 };
  const windows = [0, 1, 2].map((back) => shift(ref.year, ref.month, back));

  const [summary, ...spent] = await Promise.all([
    getMonthlySummary(ctx, ref.year, ref.month),
    ...windows.flatMap((w) => [sumExpensesByParentCategory(ctx, w.year, w.month), sumExpensesByCustomCategory(ctx, w.year, w.month)]),
  ]);

  const perMonth: Record<string, number>[] = windows.map(() => ({}));
  spent.forEach((rows, i) => {
    const target = perMonth[Math.floor(i / 2)];
    for (const r of rows as { parentCategory?: string | null; customCategoryId?: string | null; spent: number }[]) {
      const key = r.parentCategory ?? r.customCategoryId;
      if (key) target[key] = (target[key] ?? 0) + r.spent;
    }
  });

  const keys = new Set<string>([...PARENT_CATEGORIES, ...perMonth.flatMap((m) => Object.keys(m))]);
  const monthsWithData = perMonth.filter((m) => Object.values(m).some((v) => v > 0)).length || 1;
  const averageByCategory: Record<string, number> = {};
  for (const k of keys) {
    const total = perMonth.reduce((sum, m) => sum + (m[k] ?? 0), 0);
    averageByCategory[k] = Math.round(total / monthsWithData);
  }

  return {
    lastMonthLabel: MONTHS[ref.month - 1],
    lastMonthIncome: summary.totalIncome,
    lastMonthByCategory: perMonth[0],
    averageByCategory,
    monthsLeftInYear: isCurrentYear ? 12 - today.getMonth() : 12,
  };
}
