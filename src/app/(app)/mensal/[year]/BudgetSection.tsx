import type { AuthContext } from "@/lib/auth/session";
import { listBudgets, sumExpensesByParentCategory } from "@/lib/repositories/budget.repo";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { Card } from "@/components/ui/Card";
import { BudgetRow } from "./BudgetRow";

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export async function BudgetSection({
  ctx,
  year,
  month,
  totalIncome,
}: {
  ctx: AuthContext;
  year: number;
  month: number;
  totalIncome: number;
}) {
  const [budgets, spentByCategory] = await Promise.all([
    listBudgets(ctx, year, month),
    sumExpensesByParentCategory(ctx, year, month),
  ]);

  const plannedByCategory = new Map(budgets.map((b) => [b.parentCategory, Number(b.plannedAmount)]));
  const spentMap = new Map(spentByCategory.map((s) => [s.parentCategory, s.spent]));
  const totalSpent = spentByCategory.reduce((sum, s) => sum + s.spent, 0);
  const committedPercent = totalIncome > 0 ? totalSpent / totalIncome : 0;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-ink">Orçamento por categoria</h2>
        <span className="text-xs text-ink-muted">
          {formatPercent(committedPercent)} da renda comprometida com gastos este mês
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PARENT_CATEGORIES.map((pc) => (
          <BudgetRow
            key={pc}
            year={year}
            month={month}
            parentCategory={pc}
            plannedAmount={plannedByCategory.get(pc) ?? 0}
            spent={spentMap.get(pc) ?? 0}
          />
        ))}
      </div>
    </Card>
  );
}
