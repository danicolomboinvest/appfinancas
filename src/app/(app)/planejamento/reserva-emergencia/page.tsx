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
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ChevronDown } from "lucide-react";
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

  const formulario = (
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
  );

  // A pergunta da tela é "minha proteção é suficiente?" (07/10/2026). Então a resposta vem em
  // meses de vida cobertos, não só em reais: "R$ 9.000" não diz nada; "cobre 1,5 mês do seu custo"
  // diz. Logo abaixo, quando fica pronta nesse ritmo e o botão de guardar do mês.
  const atual = fund ? Number(fund.currentAmount) : 0;
  const meta = fund ? Number(fund.targetAmount) : 0;
  const pct = meta > 0 ? Math.min(100, Math.round((atual / meta) * 100)) : 0;
  const custo = fund ? Number(fund.monthlyExpenseBase) : 0;
  const mesesCobertos = custo > 0 ? atual / custo : null;
  const cobre =
    mesesCobertos === null
      ? null
      : `Cobre ${mesesCobertos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${mesesCobertos >= 1 && mesesCobertos < 2 ? "mês" : "meses"} do seu custo de vida.`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={voz.titulos.reserva}
        // A explicação de como a meta é calculada fica só para quem ainda não montou a reserva.
        subtitle={fund ? undefined : voz.titulos.reservaSub}
      />

      {fund && plan && (
        <section className="flex flex-col gap-3">
          <HeroiDoTema>
            <p className="text-sm font-medium text-heroi-suave">{voz.titulos.reservaAtual}</p>
            <div>
              <p className="text-[2.5rem] font-bold leading-none tracking-tight tabular-nums">{money(atual, { round: true })}</p>
              <p className="mt-1.5 text-sm text-heroi-suave tabular-nums">
                de {money(meta, { round: true })}, {pct}%
              </p>
            </div>
            <div className="heroi-veu h-2 overflow-hidden rounded-full" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              {/* O destaque do herói, não o accent: no Girly o accent é rosa sobre o bloco rosa e sumia. */}
              <div className={`h-full rounded-full ${tempo?.tipo === "pronta" ? "bg-success" : "bg-[var(--color-heroi-destaque)]"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="flex items-start gap-2 text-sm">
              <span
                className={`mt-1.5 size-2 shrink-0 rounded-full ${tempo?.tipo === "naoFecha" ? "bg-danger" : tempo?.tipo === "pronta" ? "bg-success" : "bg-[var(--color-heroi-destaque)]"}`}
                aria-hidden
              />
              <span>
                {tempo?.tipo === "pronta" ? (
                  <>
                    <b className="font-semibold">{voz.titulos.reservaPronta}</b> {cobre}
                  </>
                ) : tempo?.tipo === "naoFecha" ? (
                  <>
                    {cobre} {voz.titulos.reservaNaoFechaHint}
                  </>
                ) : (
                  <>
                    {cobre} No ritmo atual, completa {completionLabel ? `em ${completionLabel}` : `em ${tempo?.texto}`}.
                  </>
                )}
              </span>
            </p>
          </HeroiDoTema>

          {mostrarGuardei && (
            <GuardeiNaReservaButton
              valorCombinado={Number(fund.monthlyContribution)}
              mesLabel={monthKeyLabel(chaveDoMes)}
              feito={guardouEsteMes}
            />
          )}
        </section>
      )}

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

      {/* A projeção e o rendimento ficam no toque: respondem "e se eu continuar assim?", que é a
          segunda pergunta, não a primeira. */}
      {fund && plan && plan.projection.length > 0 && (
        <details className="group rounded-2xl border border-border bg-surface">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 text-base font-semibold text-ink [&::-webkit-details-marker]:hidden">
            {voz.titulos.reservaProjecao}
            <ChevronDown size={18} className="shrink-0 text-ink-faint transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="flex flex-col gap-4 border-t border-border px-4 pb-5 pt-4 sm:px-5">
            <SavingsProjectionChart
              projection={plan.projection}
              targetAmount={Number(fund.targetAmount)}
              currentAmount={Number(fund.currentAmount)}
              completionLabel={completionLabel}
            />
            <StatRows items={[{ label: voz.titulos.reservaRendimento, value: formatPercentNumber(plan.monthlyRate * 100, 3) }]} />
          </div>
        </details>
      )}

      {/* FORA do bloco acima de propósito: conta nova não tem reserva no banco (fund === null),
          e o formulário é o ÚNICO jeito de criar uma. Dentro do `fund && plan &&`, a tela
          aparecia em branco pra quem mais precisa dela — e três lugares do app apontam pra cá.
          Com a reserva montada, ele fica recolhido (recolher esconde, não desmonta). */}
      {fund ? (
        <CollapsibleSection label={voz.titulos.apEditar}>{formulario}</CollapsibleSection>
      ) : (
        formulario
      )}
    </div>
  );
}
