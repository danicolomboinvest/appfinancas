import { getRequiredSession } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { computeEmergencyFundPlan } from "@/lib/planning/emergency-fund";
import { SavingsProjectionChart } from "@/components/charts/SavingsProjectionChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { EmergencyFundForm } from "./EmergencyFundForm";
import { formatPercentNumber } from "@/lib/format";
import { serverMoney } from "@/lib/money-server";


export default async function ReservaEmergenciaPage() {
  const money = await serverMoney();
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

  // Mês previsto de conclusão vira data de verdade ("junho de 2027"). "Faltam 9 meses" obriga
  // a pessoa a contar no calendário pra saber quando é.
  let completionLabel: string | null = null;
  if (plan && plan.monthsToTarget !== null) {
    const done = nowInBrazil();
    done.setMonth(done.getMonth() + plan.monthsToTarget);
    completionLabel = done.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

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
            <StatCard label="Meta da reserva" value={money(Number(fund.targetAmount))} tone="accent" />
            <StatCard label="Reserva atual" value={money(Number(fund.currentAmount))} />
            <StatCard
              label="Tempo para concluir"
              value={plan.monthsToTarget === null ? "Inatingível com esses parâmetros" : `${plan.monthsToTarget} meses`}
            />
            <StatCard label="Rentabilidade mensal" value={formatPercentNumber(plan.monthlyRate * 100, 3)} />
          </div>

          {plan.projection.length > 0 && (
            <Card className="p-5">
              <SavingsProjectionChart
                projection={plan.projection}
                targetAmount={Number(fund.targetAmount)}
                currentAmount={Number(fund.currentAmount)}
                completionLabel={completionLabel}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
