import { getRequiredSession } from "@/lib/auth/session";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { computeEmergencyFundPlan } from "@/lib/planning/emergency-fund";
import { SavingsProjectionChart } from "@/components/charts/SavingsProjectionChart";
import { EmergencyFundForm } from "./EmergencyFundForm";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function ReservaEmergenciaPage() {
  const ctx = await getRequiredSession();
  const fund = await getEmergencyFund(ctx);

  const plan = fund
    ? computeEmergencyFundPlan({
        targetAmount: Number(fund.targetAmount),
        currentAmount: Number(fund.currentAmount),
        monthlyContribution: Number(fund.monthlyContribution),
        annualRate: Number(fund.annualRate),
      })
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reserva de Emergência</h1>
        <p className="mt-1 text-sm text-black/60">
          Meta calculada como meses de proteção × custo mensal, com projeção mês a mês até atingi-la.
        </p>
      </div>

      <EmergencyFundForm
        defaults={
          fund
            ? {
                targetMonths: fund.targetMonths,
                monthlyExpenseBase: Number(fund.monthlyExpenseBase),
                currentAmount: Number(fund.currentAmount),
                monthlyContribution: Number(fund.monthlyContribution),
                annualRate: Number(fund.annualRate),
              }
            : {}
        }
      />

      {fund && plan && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard label="Meta da reserva" value={formatBRL(Number(fund.targetAmount))} />
            <SummaryCard label="Reserva atual" value={formatBRL(Number(fund.currentAmount))} />
            <SummaryCard
              label="Tempo para concluir"
              value={plan.monthsToTarget === null ? "Inatingível com esses parâmetros" : `${plan.monthsToTarget} meses`}
            />
            <SummaryCard label="Rentabilidade mensal" value={`${(plan.monthlyRate * 100).toFixed(3)}%`} />
          </div>

          {plan.projection.length > 0 && (
            <SavingsProjectionChart projection={plan.projection} targetAmount={Number(fund.targetAmount)} />
          )}
        </div>
      )}
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
