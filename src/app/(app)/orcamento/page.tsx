import { getRequiredSession } from "@/lib/auth/session";
import { getAnnualBudgetPlan, getAnnualBudgetPlanForCustomCategories } from "@/lib/repositories/budget.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { PARENT_CATEGORIES, PARENT_CATEGORY_LABEL, PARENT_CATEGORY_DESCRIPTION } from "@/lib/categories";
import { PageHeader } from "@/components/ui/PageHeader";
import { OrcamentoForm } from "./OrcamentoForm";

export default async function OrcamentoPage() {
  const ctx = await getRequiredSession();
  const year = new Date().getFullYear();
  const [plan, customCategories] = await Promise.all([getAnnualBudgetPlan(ctx, year), listCustomCategories(ctx)]);
  const customPlan = await getAnnualBudgetPlanForCustomCategories(
    ctx,
    year,
    customCategories.map((c) => c.id),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Orçamento"
        subtitle="Antes de controlar seus gastos, defina quanto pretende gastar em cada categoria. Para despesas que acontecem só uma vez por ano (IPVA, seguro, manutenção do carro, presentes), faça uma média mensal."
      />

      <OrcamentoForm
        year={year}
        parentCategories={PARENT_CATEGORIES.map((parentCategory) => ({
          key: parentCategory,
          label: PARENT_CATEGORY_LABEL[parentCategory],
          description: PARENT_CATEGORY_DESCRIPTION[parentCategory],
          defaultValue: plan[parentCategory],
        }))}
        customCategories={customCategories.map((category) => ({
          id: category.id,
          name: category.name,
          icon: category.icon,
          defaultValue: customPlan[category.id] ?? 0,
        }))}
      />
    </div>
  );
}
