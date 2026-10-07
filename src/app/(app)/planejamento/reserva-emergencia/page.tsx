import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { getTypicalMonthlyExpense } from "@/lib/planning/typical-expense";
import { computeEmergencyFundPlan, mesDeConclusao } from "@/lib/planning/emergency-fund";
import { SavingsProjectionChart } from "@/components/charts/SavingsProjectionChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatRows } from "@/components/ui/StatRows";
import { listAssets } from "@/lib/repositories/asset.repo";
import { EmergencyFundForm } from "./EmergencyFundForm";
import { formatPercentNumber } from "@/lib/format";
import { serverMoney } from "@/lib/money-server";
import { Section } from "@/components/ui/Section";
import { ReservaDivergente } from "@/components/decisoes/ReservaDivergente";
import { existeDecisao } from "@/lib/repositories/decisao.repo";
import { chaveDoMesDaReserva, mesesAteCompletar, mostraGuardei } from "@/lib/planning/reserva-guardei";
import { monthKeyLabel } from "@/lib/planning/goal-checkin";
import { GuardeiNaReservaButton } from "./GuardeiNaReservaButton";


export default async function ReservaEmergenciaPage() {
  const money = await serverMoney();
  const ctx = await getRequiredSession();
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const chaveDoMes = chaveDoMesDaReserva(nowInBrazil());
  const [fund, typicalExpense, assets, guardouEsteMes] = await Promise.all([
    getEmergencyFund(ctx),
    getTypicalMonthlyExpense(ctx),
    listAssets(ctx),
    existeDecisao(ctx, "reserva_guardei", chaveDoMes),
  ]);
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

  const reservaNumeros = fund
    ? { targetAmount: Number(fund.targetAmount), currentAmount: Number(fund.currentAmount), monthlyContribution: Number(fund.monthlyContribution) }
    : null;
  // O botão fica visível no mês já marcado (mostrando "Guardado em setembro"), pra ela ver que
  // anotou; some quando a reserva completa ou não há valor por mês combinado.
  const mostrarGuardei = guardouEsteMes ? reservaNumeros !== null : mostraGuardei(reservaNumeros);
  const tempo = plan ? mesesAteCompletar(plan.monthsToTarget) : null;

  // Mês previsto de conclusão vira data de verdade ("junho de 2027"). "Faltam 9 meses" obriga
  // a pessoa a contar no calendário pra saber quando é.
  let completionLabel: string | null = null;
  if (plan && plan.monthsToTarget !== null) {
    const done = mesDeConclusao(nowInBrazil(), plan.monthsToTarget);
    completionLabel = done.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={voz.titulos.reserva}
        // A explicação de como a meta é calculada fica só para quem ainda não montou a reserva.
        subtitle={fund ? undefined : voz.titulos.reservaSub}
      />

      {fund && (
        <ReservaDivergente
          naTelaDaReserva={Number(fund.currentAmount)}
          naCarteira={reserveInAssets}
          temInvestimentos={assets.length > 0}
          nomeDaReserva={voz.titulos.reserva}
          onde="reserva"
          money={(v) => money(v)}
        />
      )}

      {fund && plan && (
        <div className="flex flex-col gap-4">
          <StatRows
            items={[
              { label: voz.titulos.reservaMeta, value: money(Number(fund.targetAmount)), tone: "accent" },
              { label: voz.titulos.reservaAtual, value: money(Number(fund.currentAmount)) },
              {
                label: voz.titulos.reservaTempo,
                value: tempo?.tipo === "naoFecha" ? "Não fecha" : tempo?.tipo === "pronta" ? voz.titulos.reservaPronta : (tempo?.texto ?? ""),
                hint: tempo?.tipo === "naoFecha" ? voz.titulos.reservaNaoFechaHint : undefined,
                tone: tempo?.tipo === "pronta" ? "success" : undefined,
              },
              { label: voz.titulos.reservaRendimento, value: formatPercentNumber(plan.monthlyRate * 100, 3) },
            ]}
          />

          {mostrarGuardei && (
            <GuardeiNaReservaButton
              valorCombinado={Number(fund.monthlyContribution)}
              mesLabel={monthKeyLabel(chaveDoMes)}
              feito={guardouEsteMes}
            />
          )}

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
