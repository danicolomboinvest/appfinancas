import type { AuthContext } from "@/lib/auth/session";
import { listBudgets, sumExpensesByParentCategory } from "@/lib/repositories/budget.repo";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { BudgetRow } from "./BudgetRow";
import { formatPercentNumber } from "@/lib/format";
import { Section } from "@/components/ui/Section";
import Link from "next/link";

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
  const totalPlanned = budgets.reduce((sum, b) => sum + Number(b.plannedAmount), 0);

  // Conta nova: sete blocos de "R$ 0,00 de R$ 0,00 planejado" não dizem nada. Um convite diz.
  if (totalPlanned === 0 && totalSpent === 0) {
    return (
      <Section title="Orçamento por categoria">
        <Link href="/orcamento" className="block rounded-2xl border border-dashed border-border-strong px-4 py-4 text-sm text-ink-muted hover:border-accent hover:text-ink">
          Você ainda não disse quanto quer gastar em cada categoria. <span className="font-medium text-accent-strong">Definir meu orçamento →</span>
        </Link>
      </Section>
    );
  }
  // Sem plano mas com gastos: só as categorias que já têm movimento.
  const categories = totalPlanned === 0 ? PARENT_CATEGORIES.filter((pc) => (spentMap.get(pc) ?? 0) > 0) : PARENT_CATEGORIES;

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
        {categories.map((pc) => (
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
