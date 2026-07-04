import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getYearlySummary } from "@/lib/consolidation/yearly";
import { YearlyBarChart } from "@/components/charts/YearlyBarChart";

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

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function YearPage(props: PageProps<"/mensal/[year]">) {
  const { year: yearParam } = await props.params;
  const year = Number(yearParam);
  const ctx = await getRequiredSession();
  const summary = await getYearlySummary(ctx, year);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Controle mensal — {year}</h1>
          <p className="mt-1 text-sm text-black/60">Consolidação automática dos 12 meses do ano.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/mensal/${year - 1}`} className="underline">
            ← {year - 1}
          </Link>
          <Link href={`/mensal/${year + 1}`} className="underline">
            {year + 1} →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SummaryCard label="Renda" value={formatBRL(summary.totalIncome)} />
        <SummaryCard label="Gastos" value={formatBRL(summary.totalExpense)} />
        <SummaryCard label="Aportes" value={formatBRL(summary.totalInvestment)} />
        <SummaryCard label="Saldo" value={formatBRL(summary.balance)} />
        <SummaryCard
          label="Taxa de poupança"
          value={summary.savingsRate === null ? "—" : `${(summary.savingsRate * 100).toFixed(1)}%`}
        />
      </div>

      <YearlyBarChart months={summary.months} />

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-black/60">
            <th className="py-2">Mês</th>
            <th className="py-2">Renda</th>
            <th className="py-2">Gastos</th>
            <th className="py-2">Aportes</th>
            <th className="py-2">Saldo</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {summary.months.map((m) => (
            <tr key={m.month} className="border-b border-black/5">
              <td className="py-2">{MONTH_LABELS[m.month - 1]}</td>
              <td className="py-2">{formatBRL(m.totalIncome)}</td>
              <td className="py-2">{formatBRL(m.totalExpense)}</td>
              <td className="py-2">{formatBRL(m.totalInvestment)}</td>
              <td className="py-2">{formatBRL(m.balance)}</td>
              <td className="py-2">
                <Link href={`/mensal/${year}/${m.month}`} className="underline">
                  Lançar
                </Link>
              </td>
            </tr>
          ))}
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
