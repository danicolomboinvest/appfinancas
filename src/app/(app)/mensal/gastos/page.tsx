import { getRequiredSession } from "@/lib/auth/session";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import {
  sumExpensesByParentCategory,
  sumExpensesByCustomCategory,
  sumExpensesByParentCategoryForYear,
  sumExpensesByCustomCategoryForYear,
  sumExpensesByParentCategorySince,
  sumExpensesByCustomCategorySince,
} from "@/lib/repositories/budget.repo";
import { PARENT_CATEGORY_LABEL } from "@/lib/categories";
import type { ParentCategory } from "@prisma/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import type { SpendingSlice } from "@/components/charts/SpendingPieChart";
import { SpendingByCategory } from "./SpendingByCategory";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Junta gastos por categoria-mãe (padrão) e personalizadas num único array {name, value}. */
function toSlices(
  parent: { parentCategory: ParentCategory; spent: number }[],
  custom: { customCategoryId: string; spent: number }[],
  customNameById: Map<string, string>,
): SpendingSlice[] {
  return [
    ...parent.map((s) => ({ name: PARENT_CATEGORY_LABEL[s.parentCategory], value: s.spent })),
    ...custom.map((s) => ({ name: customNameById.get(s.customCategoryId) ?? "Outro", value: s.spent })),
  ];
}

export default async function SpendingByCategoryPage() {
  const ctx = await getRequiredSession();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    customCategories,
    parentMonth,
    customMonth,
    parentYearByMonth,
    customYearByMonth,
    parentWeek,
    customWeek,
  ] = await Promise.all([
    listCustomCategories(ctx),
    sumExpensesByParentCategory(ctx, year, month),
    sumExpensesByCustomCategory(ctx, year, month),
    sumExpensesByParentCategoryForYear(ctx, year),
    sumExpensesByCustomCategoryForYear(ctx, year),
    sumExpensesByParentCategorySince(ctx, weekAgo),
    sumExpensesByCustomCategorySince(ctx, weekAgo),
  ]);

  const customNameById = new Map(customCategories.map((c) => [c.id, c.name]));

  // As consultas anuais vêm por mês+categoria — somamos por categoria.
  const parentYear = Object.values(
    parentYearByMonth.reduce<Record<string, { parentCategory: ParentCategory; spent: number }>>((acc, r) => {
      acc[r.parentCategory] = { parentCategory: r.parentCategory, spent: (acc[r.parentCategory]?.spent ?? 0) + r.spent };
      return acc;
    }, {}),
  );
  const customYear = Object.values(
    customYearByMonth.reduce<Record<string, { customCategoryId: string; spent: number }>>((acc, r) => {
      acc[r.customCategoryId] = {
        customCategoryId: r.customCategoryId,
        spent: (acc[r.customCategoryId]?.spent ?? 0) + r.spent,
      };
      return acc;
    }, {}),
  );

  const week = toSlices(parentWeek, customWeek, customNameById);
  const monthData = toSlices(parentMonth, customMonth, customNameById);
  const yearData = toSlices(parentYear, customYear, customNameById);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Fluxo Financeiro", href: "/mensal" }, { label: "Só gastos" }]} />

      <PageHeader title="Só gastos" subtitle="Para onde seu dinheiro foi, por categoria." />

      <SpendingByCategory
        week={week}
        month={monthData}
        year={yearData}
        subtitle={{
          semana: "Últimos 7 dias",
          mes: `${MONTH_LABELS[month - 1]} de ${year}`,
          ano: String(year),
        }}
      />
    </div>
  );
}
