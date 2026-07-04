import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listMonthlyEntries } from "@/lib/repositories/monthly-entry.repo";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { EntryForm } from "./EntryForm";
import { DeleteEntryButton } from "./DeleteEntryButton";

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

const CATEGORY_LABEL: Record<string, string> = {
  INCOME: "Renda",
  EXPENSE: "Gasto",
  INVESTMENT_CONTRIBUTION: "Aporte",
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function adjacentMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export default async function MonthPage(props: PageProps<"/mensal/[year]/[month]">) {
  const { year: yearParam, month: monthParam } = await props.params;
  const year = Number(yearParam);
  const month = Number(monthParam);

  const ctx = await getRequiredSession();
  const [entries, summary] = await Promise.all([
    listMonthlyEntries(ctx, year, month),
    getMonthlySummary(ctx, year, month),
  ]);

  const prev = adjacentMonth(year, month, -1);
  const next = adjacentMonth(year, month, 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {MONTH_LABELS[month - 1]} de {year}
          </h1>
          <Link href={`/mensal/${year}`} className="text-sm underline">
            ← ver consolidado do ano
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/mensal/${prev.year}/${prev.month}`} className="underline">
            ← {MONTH_LABELS[prev.month - 1]}
          </Link>
          <Link href={`/mensal/${next.year}/${next.month}`} className="underline">
            {MONTH_LABELS[next.month - 1]} →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Renda" value={formatBRL(summary.totalIncome)} />
        <SummaryCard label="Gastos" value={formatBRL(summary.totalExpense)} />
        <SummaryCard label="Aportes" value={formatBRL(summary.totalInvestment)} />
        <SummaryCard label="Saldo" value={formatBRL(summary.balance)} />
      </div>

      <EntryForm year={year} month={month} />

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-black/60">
            <th className="py-2">Categoria</th>
            <th className="py-2">Subcategoria</th>
            <th className="py-2">Descrição</th>
            <th className="py-2">Valor</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-black/5">
              <td className="py-2">{CATEGORY_LABEL[entry.category]}</td>
              <td className="py-2">{entry.subcategory ?? "—"}</td>
              <td className="py-2">{entry.description ?? "—"}</td>
              <td className="py-2">{formatBRL(Number(entry.amount))}</td>
              <td className="py-2">
                <DeleteEntryButton id={entry.id} year={year} month={month} />
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-black/40">
                Nenhum lançamento neste mês ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-4">
      <p className="text-xs text-black/60">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
