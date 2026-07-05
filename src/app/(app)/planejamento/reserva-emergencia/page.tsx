import { getRequiredSession } from "@/lib/auth/session";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { computeEmergencyFundPlan } from "@/lib/planning/emergency-fund";
import { SavingsProjectionChart } from "@/components/charts/SavingsProjectionChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
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
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Reserva de Emergência"
        subtitle="Meta calculada como meses de proteção × custo mensal, com projeção mês a mês até atingi-la."
      />

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
            <StatCard label="Meta da reserva" value={formatBRL(Number(fund.targetAmount))} tone="gold" />
            <StatCard label="Reserva atual" value={formatBRL(Number(fund.currentAmount))} />
            <StatCard
              label="Tempo para concluir"
              value={plan.monthsToTarget === null ? "Inatingível com esses parâmetros" : `${plan.monthsToTarget} meses`}
            />
            <StatCard label="Rentabilidade mensal" value={`${(plan.monthlyRate * 100).toFixed(3)}%`} />
          </div>

          {(() => {
            const targetAmount = Number(fund.targetAmount);
            const progress = targetAmount > 0 ? Math.min(Number(fund.currentAmount) / targetAmount, 1) : 0;
            return (
              <Card className="p-5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-ink-muted">Progresso da reserva</p>
                  <p className="text-sm font-semibold text-gold-strong">{Math.round(progress * 100)}%</p>
                </div>
                <ProgressBar percent={progress} tone={progress >= 1 ? "success" : "gold"} />
              </Card>
            );
          })()}

          {plan.projection.length > 0 && (
            <Card className="p-5">
              <SavingsProjectionChart projection={plan.projection} targetAmount={Number(fund.targetAmount)} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
