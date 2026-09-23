import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { getTypicalMonthlyExpense } from "@/lib/planning/typical-expense";
import { computeEmergencyFundPlan } from "@/lib/planning/emergency-fund";
import { SavingsProjectionChart } from "@/components/charts/SavingsProjectionChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatRows } from "@/components/ui/StatRows";
import { listAssets } from "@/lib/repositories/asset.repo";
import { EmergencyFundForm } from "./EmergencyFundForm";
import { formatPercentNumber } from "@/lib/format";
import { serverMoney } from "@/lib/money-server";
import { Section } from "@/components/ui/Section";


export default async function ReservaEmergenciaPage() {
  const money = await serverMoney();
  const ctx = await getRequiredSession();
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const [fund, typicalExpense, assets] = await Promise.all([getEmergencyFund(ctx), getTypicalMonthlyExpense(ctx), listAssets(ctx)]);
  // Quem marcou um CDB como "reserva de emergência" na carteira já respondeu "quanto tem guardado".
  const reserveInAssets = assets.filter((a) => a.objective === "RESERVA_EMERGENCIA").reduce((sum, a) => sum + Number(a.currentValue), 0);

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
        title={voz.titulos.reserva}
        subtitle={voz.titulos.reservaSub}
      />

      {fund && plan && (
        <div className="flex flex-col gap-4">
          <StatRows
            items={[
              { label: voz.titulos.reservaMeta, value: money(Number(fund.targetAmount)), tone: "accent" },
              { label: voz.titulos.reservaAtual, value: money(Number(fund.currentAmount)) },
              {
                label: voz.titulos.reservaTempo,
                value: plan.monthsToTarget === null ? "Não fecha" : `${plan.monthsToTarget} meses`,
                hint: plan.monthsToTarget === null ? "Com esse aporte a reserva não chega na meta. Aumente o valor por mês." : undefined,
              },
              { label: voz.titulos.reservaRendimento, value: formatPercentNumber(plan.monthlyRate * 100, 3) },
            ]}
          />

          {plan.projection.length > 0 && (
            <Section title={voz.titulos.reservaProjecao}>
              <SavingsProjectionChart
                projection={plan.projection}
                targetAmount={Number(fund.targetAmount)}
                currentAmount={Number(fund.currentAmount)}
                completionLabel={completionLabel}
              />
            </Section>
          )}

        </div>
      )}

      {/* FORA do bloco acima de propósito: conta nova não tem reserva no banco (fund === null),
          e o formulário é o ÚNICO jeito de criar uma. Dentro do `fund && plan &&`, a tela
          aparecia em branco pra quem mais precisa dela — e três lugares do app apontam pra cá. */}
      <EmergencyFundForm
        typicalExpense={typicalExpense}
        reserveInAssets={reserveInAssets}
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
    </div>
  );
}
