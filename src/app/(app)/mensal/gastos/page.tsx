import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { sumExpensesByParentCategory, sumExpensesByCustomCategory } from "@/lib/repositories/budget.repo";
import { PARENT_CATEGORY_LABEL } from "@/lib/categories";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SpendingBubbleChart, type BubbleDatum } from "@/components/charts/SpendingBubbleChart";

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function adjacentMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function firstOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SpendingBubblePage(props: PageProps<"/mensal/gastos">) {
  const searchParams = await props.searchParams;
  const now = new Date();
  const yearParam = firstOf(searchParams.year);
  const monthParam = firstOf(searchParams.month);
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;

  const ctx = await getRequiredSession();
  const [customCategories, spentByParent, spentByCustom] = await Promise.all([
    listCustomCategories(ctx),
    sumExpensesByParentCategory(ctx, year, month),
    sumExpensesByCustomCategory(ctx, year, month),
  ]);

  const customCategoryNameById = new Map(customCategories.map((c) => [c.id, c.name]));
  const bubbleData: BubbleDatum[] = [
    ...spentByParent.map((s) => ({ name: PARENT_CATEGORY_LABEL[s.parentCategory], value: s.spent })),
    ...spentByCustom.map((s) => ({ name: customCategoryNameById.get(s.customCategoryId) ?? "Outro", value: s.spent })),
  ];
  const totalSpent = bubbleData.reduce((sum, d) => sum + d.value, 0);

  const prev = adjacentMonth(year, month, -1);
  const next = adjacentMonth(year, month, 1);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: "Seu dinheiro no mês", href: "/mensal" },
          { label: "Só gastos" },
        ]}
      />

      <PageHeader
        title="Só gastos"
        subtitle={`${MONTH_LABELS[month - 1]} de ${year} — cada bolha é uma categoria, o tamanho é quanto você gastou nela.`}
        action={
          <div className="flex items-center gap-1">
            <Link
              href={`/mensal/gastos?year=${prev.year}&month=${prev.month}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft size={16} /> {MONTH_LABELS[prev.month - 1]}
            </Link>
            <Link
              href={`/mensal/gastos?year=${next.year}&month=${next.month}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              {MONTH_LABELS[next.month - 1]} <ChevronRight size={16} />
            </Link>
          </div>
        }
      />

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-muted">Gastos por categoria</h2>
          <span className="text-sm font-medium text-ink">
            {totalSpent.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
        <SpendingBubbleChart data={bubbleData} />
      </Card>
    </div>
  );
}
