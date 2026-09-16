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
import type { SpendingSlice } from "@/components/charts/SpendingPieChart";
import { SpendingByCategory } from "./SpendingByCategory";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Junta gastos por categoria-mãe (padrão) e personalizadas num único array {name, value, key}. */
function toSlices(
  parent: { parentCategory: ParentCategory; spent: number }[],
  custom: { customCategoryId: string; spent: number }[],
  customNameById: Map<string, string>,
  previous?: {
    parent: { parentCategory: ParentCategory; spent: number }[];
    custom: { customCategoryId: string; spent: number }[];
  },
): SpendingSlice[] {
  const prevParent = new Map(previous?.parent.map((s) => [s.parentCategory, s.spent]));
  const prevCustom = new Map(previous?.custom.map((s) => [s.customCategoryId, s.spent]));
  return [
    ...parent.map((s) => ({
      name: PARENT_CATEGORY_LABEL[s.parentCategory],
      value: s.spent,
      category: { kind: "parent" as const, value: s.parentCategory },
      previousValue: previous ? (prevParent.get(s.parentCategory) ?? 0) : undefined,
    })),
    ...custom.map((s) => ({
      name: customNameById.get(s.customCategoryId) ?? "Outro",
      value: s.spent,
      category: { kind: "custom" as const, value: s.customCategoryId },
      previousValue: previous ? (prevCustom.get(s.customCategoryId) ?? 0) : undefined,
    })),
  ];
}

function firstOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SpendingByCategoryPage(props: PageProps<"/mensal/gastos">) {
  const searchParams = await props.searchParams;
  const ctx = await getRequiredSession();
  const now = new Date();

  // Mês/ano selecionáveis via URL (?year&month), as setas do seletor navegam por aqui,
  // e o servidor recalcula os dados do período pedido. `view` preserva a aba ativa.
  const yearParam = Number(firstOf(searchParams.year));
  const monthParam = Number(firstOf(searchParams.month));
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : now.getFullYear();
  const month = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : now.getMonth() + 1;
  const viewParam = firstOf(searchParams.view);
  const initialPeriod = viewParam === "semana" || viewParam === "ano" ? viewParam : "mes";

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevMonth = new Date(year, month - 2, 1);
  const nextMonth = new Date(year, month, 1);

  const [
    customCategories,
    parentMonth,
    customMonth,
    parentYearByMonth,
    customYearByMonth,
    parentWeek,
    customWeek,
    parentPrev,
    customPrev,
  ] = await Promise.all([
    listCustomCategories(ctx),
    sumExpensesByParentCategory(ctx, year, month),
    sumExpensesByCustomCategory(ctx, year, month),
    sumExpensesByParentCategoryForYear(ctx, year),
    sumExpensesByCustomCategoryForYear(ctx, year),
    sumExpensesByParentCategorySince(ctx, weekAgo),
    sumExpensesByCustomCategorySince(ctx, weekAgo),
    // O mês anterior entra só pra cada linha dizer o que MUDOU — é o que a linha tinha de
    // vazio quando repetia "toque para ver os lançamentos" em todas as categorias.
    sumExpensesByParentCategory(ctx, prevMonth.getFullYear(), prevMonth.getMonth() + 1),
    sumExpensesByCustomCategory(ctx, prevMonth.getFullYear(), prevMonth.getMonth() + 1),
  ]);

  const customNameById = new Map(customCategories.map((c) => [c.id, c.name]));

  // As consultas anuais vêm por mês+categoria, somamos por categoria.
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

  return (
    <div className="flex flex-col gap-6">

      <PageHeader title="Só gastos" subtitle="Para onde seu dinheiro foi, por categoria." />

      <SpendingByCategory
        selectedYear={year}
        selectedMonth={month}
        week={toSlices(parentWeek, customWeek, customNameById)}
        month={toSlices(parentMonth, customMonth, customNameById, { parent: parentPrev, custom: customPrev })}
        previousMonthLabel={MONTH_LABELS[prevMonth.getMonth()].toLowerCase()}
        year={toSlices(parentYear, customYear, customNameById)}
        initialPeriod={initialPeriod}
        subtitle={{
          semana: "Últimos 7 dias",
          mes: `${MONTH_LABELS[month - 1]} de ${year}`,
          ano: String(year),
        }}
        nav={{
          prevMonthHref: `/mensal/gastos?view=mes&year=${prevMonth.getFullYear()}&month=${prevMonth.getMonth() + 1}`,
          nextMonthHref: `/mensal/gastos?view=mes&year=${nextMonth.getFullYear()}&month=${nextMonth.getMonth() + 1}`,
          prevYearHref: `/mensal/gastos?view=ano&year=${year - 1}&month=${month}`,
          nextYearHref: `/mensal/gastos?view=ano&year=${year + 1}&month=${month}`,
        }}
      />
    </div>
  );
}
