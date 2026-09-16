import type { AuthContext } from "@/lib/auth/session";
import { listBudgets, sumExpensesByParentCategory } from "@/lib/repositories/budget.repo";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { BudgetRow } from "./BudgetRow";
import { formatPercentNumber } from "@/lib/format";
import { Section } from "@/components/ui/Section";

function formatPercent(value: number) {
  return formatPercentNumber(value * 100, 1);
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
    <Section
      title="Orçamento por categoria"
      action={
        <span className="text-caption text-ink-muted">
          {formatPercent(committedPercent)} da renda comprometida
        </span>
      }
    >
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
    </Section>
  );
}
