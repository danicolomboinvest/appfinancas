import Link from "next/link";
import type { AuthContext } from "@/lib/auth/session";
import { listBudgets, sumExpensesByParentCategory, sumExpensesByCustomCategory } from "@/lib/repositories/budget.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { PARENT_CATEGORIES, PARENT_CATEGORY_LABEL, isParentCategoryKey, colorForCategorySlice } from "@/lib/categories";
import { buildMonthlyComparison } from "@/lib/planning/budget-comparison";
import { buildBudgetBullets, elapsedRatioOfMonth } from "@/lib/planning/budget-bullets";
import { BulletBar } from "@/components/charts/BulletBar";
import { Section } from "@/components/ui/Section";
import { formatPercentNumber } from "@/lib/format";
import { serverMoney } from "@/lib/money-server";

/**
 * "Orçamento por categoria" no mês: a MESMA barra-bala da página de Orçamento (quem está mais
 * perto de estourar no topo, tracinho onde o mês está, veredito em chips). Antes era a lista
 * de sete blocos com um campo "Planejado" e botão Salvar em cada um — a "listona" que a Dani
 * pediu pra aposentar. O plano se ajusta num lugar só, o assistente da página de Orçamento.
 */
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
  const [money, budgets, spentParent, spentCustom, customCategories] = await Promise.all([
    serverMoney(),
    listBudgets(ctx, year, month),
    sumExpensesByParentCategory(ctx, year, month),
    sumExpensesByCustomCategory(ctx, year, month),
    listCustomCategories(ctx),
  ]);

  const customLabels = new Map(customCategories.map((c) => [c.id, c.name]));
  const categoryKeys: string[] = [...PARENT_CATEGORIES, ...customCategories.map((c) => c.id)];
  const comparison = buildMonthlyComparison(
    month,
    true,
    categoryKeys,
    budgets.flatMap((b) => {
      const categoryKey = b.parentCategory ?? b.customCategoryId;
      return categoryKey ? [{ categoryKey, plannedAmount: Number(b.plannedAmount) }] : [];
    }),
    [
      ...spentParent.map((s) => ({ categoryKey: s.parentCategory, spent: s.spent })),
      ...spentCustom.map((s) => ({ categoryKey: s.customCategoryId, spent: s.spent })),
    ],
  );

  // Conta nova: sete blocos de "R$ 0,00 de R$ 0,00 planejado" não dizem nada. Um convite diz.
  if (comparison.totalPlanned === 0 && comparison.totalSpent === 0) {
    return (
      <Section title="Orçamento por categoria">
        <Link href={`/orcamento/${year}`} className="block rounded-2xl border border-dashed border-border-strong px-4 py-4 text-sm text-ink-muted hover:border-accent hover:text-ink">
          Você ainda não disse quanto quer gastar em cada categoria. <span className="font-medium text-accent-strong">Montar meu orçamento →</span>
        </Link>
      </Section>
    );
  }

  const rows = buildBudgetBullets(comparison.categories, {
    paceRatio: elapsedRatioOfMonth(new Date(), year, month),
    money,
    labelFor: (key) => (isParentCategoryKey(key) ? PARENT_CATEGORY_LABEL[key] : (customLabels.get(key) ?? "Categoria personalizada")),
    colorFor: (key) => colorForCategorySlice(isParentCategoryKey(key) ? { kind: "parent", value: key } : { kind: "custom", value: key }),
    labelStyle: "restante",
  });
  const over = rows.filter((r) => r.isOver && !r.isUnplanned).length;
  const unplanned = rows.filter((r) => r.isUnplanned).length;
  const within = rows.length - over - unplanned;
  const committed = totalIncome > 0 ? comparison.totalSpent / totalIncome : 0;

  return (
    <Section
      title="Orçamento por categoria"
      hint={totalIncome > 0 ? `${formatPercentNumber(committed * 100, 1)} da renda comprometida. O tracinho é onde o mês está.` : "O tracinho é onde o mês está."}
      action={
        <Link href={`/orcamento/${year}`} className="text-sm font-medium text-accent-strong hover:underline">
          {comparison.totalPlanned > 0 ? "Ajustar plano →" : "Montar meu orçamento →"}
        </Link>
      }
    >
      <BulletBar rows={rows} wide />
      <div className="flex flex-wrap items-center gap-2">
        {over > 0 && (
          <span className="rounded-full bg-danger-soft px-2.5 py-1 text-caption font-medium text-danger">
            {over} categoria{over === 1 ? "" : "s"} estourou{over === 1 ? "" : "ram"}
          </span>
        )}
        {within > 0 && <span className="rounded-full bg-success-soft px-2.5 py-1 text-caption font-medium text-success">{within} dentro do plano</span>}
        {unplanned > 0 && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-caption font-medium text-ink-muted">{unplanned} sem plano</span>}
      </div>
    </Section>
  );
}
