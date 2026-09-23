import { TrendingDown, TrendingUp } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { vozDoTema } from "@/lib/profiles/voice";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";
import { PaywallCard } from "@/components/shell/PaywallCard";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { computeAccumulation } from "@/lib/planning/accumulation";
import { computeUsufruct } from "@/lib/planning/usufruct";
import { computeYearByYearProjection, type ProjectionYear } from "@/lib/consolidation/projection";
import { PatrimonyProjectionChart } from "@/components/charts/PatrimonyProjectionChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatRows } from "@/components/ui/StatRows";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import { Section } from "@/components/ui/Section";
import { CompositionBar } from "@/components/charts/CompositionBar";
import { PlanningParamsForm } from "./PlanningParamsForm";
import { PlanningWizard } from "./PlanningWizard";
import { formatPercentNumber } from "@/lib/format";
import { serverMoney } from "@/lib/money-server";
import type { MoneyFormatter } from "@/lib/money";


function formatPercent(value: number) {
  return formatPercentNumber(value * 100, 2);
}

const projectionColumns = (money: MoneyFormatter): ResponsiveColumn<ProjectionYear>[] => [
  { key: "age", label: "Idade", render: (y) => y.age },
  {
    key: "phase",
    label: "Fase",
    render: (y) => (
      <Badge tone={y.phase === "ACCUMULATION" ? "accent" : "info"}>{y.phase === "ACCUMULATION" ? "Acúmulo" : "Usufruto"}</Badge>
    ),
  },
  { key: "invested", label: "Investido", render: (y) => money(y.totalInvested ?? 0, { round: true }) },
  { key: "interest", label: "Juros acumulados", render: (y) => money(y.cumulativeInterest ?? 0, { round: true }) },
  { key: "nominal", label: "Patrimônio (nominal)", render: (y) => money(y.balanceNominal ?? 0, { round: true }) },
  { key: "real", label: "Patrimônio (real)", render: (y) => money(y.balanceReal ?? 0, { round: true }) },
];

export default async function IndependenciaFinanceiraPage() {
  const money = await serverMoney();
  const ctx = await getRequiredSession();
  // Empresa não se aposenta: a rota some do menu e, se alguém chegar por link, cai nas metas.
  if (ehEmpresa(ctx.profileKind)) redirect("/planejamento/metas");
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);

  // Aposentadoria é conteúdo do curso (construir patrimônio) — diferente de Metas/Reserva,
  // que ficam de graça mesmo dentro do mesmo grupo "Planejamento Financeiro" no menu.
  if (!(await hasPremiumAccess(ctx.userId))) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={voz.titulos.aposentadoria} subtitle={voz.titulos.aposentadoriaSub} />
        <PaywallCard feature="Aposentadoria" />
      </div>
    );
  }

  const params = await getPlanningParams(ctx);

  const defaults = params
    ? {
        currentAge: params.currentAge,
        retirementAge: params.retirementAge,
        lifeExpectancyAge: params.lifeExpectancyAge,
        currentPatrimony: Number(params.currentPatrimony),
        monthlyContributionAccumulation: Number(params.monthlyContributionAccumulation),
        accumulationAnnualRate: Number(params.accumulationAnnualRate),
        inflationAnnualRate: Number(params.inflationAnnualRate),
        usufructAnnualRate: Number(params.usufructAnnualRate),
        desiredPassiveIncome: Number(params.desiredPassiveIncome),
        otherPassiveIncome: Number(params.otherPassiveIncome),
      }
    : {};

  // Primeira vez (sem parâmetros): wizard guiado "Quanto custa a vida que você quer?", uma
  // pergunta por tela. Só depois de concluir é que a pessoa cai no dashboard abaixo (item 4).
  if (!params) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={voz.titulos.aposentadoria}
          subtitle={voz.titulos.aposentadoriaWizardSub}
        />
        <PlanningWizard />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={voz.titulos.aposentadoria}
        subtitle={voz.titulos.aposentadoriaSub}
      />

      <CollapsibleSection label={voz.titulos.apEditar} defaultOpen={false}>
        <PlanningParamsForm defaults={defaults} />
      </CollapsibleSection>

      {(() => {
            const accumulation = computeAccumulation({
              currentAge: params.currentAge,
              retirementAge: params.retirementAge,
              currentPatrimony: Number(params.currentPatrimony),
              monthlyContributionAccumulation: Number(params.monthlyContributionAccumulation),
              accumulationAnnualRate: Number(params.accumulationAnnualRate),
              inflationAnnualRate: Number(params.inflationAnnualRate),
            });

            const years = computeYearByYearProjection({
              currentAge: params.currentAge,
              retirementAge: params.retirementAge,
              lifeExpectancyAge: params.lifeExpectancyAge,
              currentPatrimony: Number(params.currentPatrimony),
              monthlyContributionAccumulation: Number(params.monthlyContributionAccumulation),
              accumulationAnnualRate: Number(params.accumulationAnnualRate),
              inflationAnnualRate: Number(params.inflationAnnualRate),
              usufructAnnualRate: Number(params.usufructAnnualRate),
              desiredPassiveIncome: Number(params.desiredPassiveIncome),
              otherPassiveIncome: Number(params.otherPassiveIncome),
            });

            const usufruct = computeUsufruct({
              finalValueReal: accumulation.finalValueReal,
              usufructAnnualRate: Number(params.usufructAnnualRate),
              otherPassiveIncome: Number(params.otherPassiveIncome),
              desiredPassiveIncome: Number(params.desiredPassiveIncome),
            });
            const isSurplus = usufruct.surplusOrDeficit >= 0;

            return (
              <>
                {/* A resposta ANTES dos números que a produzem. A tela antiga abria com nove
                    cards do mesmo tamanho: sem hierarquia, nenhum deles era a resposta, e a
                    pessoa tinha que descobrir sozinha qual olhar. */}
                <section id="acumulo" className="flex flex-col gap-6">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm text-ink-muted">
                      {voz.titulos.apSeNadaMudar(params.retirementAge)}
                    </p>
                    <p className="text-display font-bold tracking-tight text-accent">
                      {money(accumulation.finalValueReal, { round: true })}
                    </p>
                    <p className="text-sm text-ink-muted">{voz.titulos.apHoje}</p>
                  </div>

                  {/* O veredito ganhou o id da antiga seção "Renda na aposentadoria": os links
                      do dashboard e o redirect de /planejamento/usufruto apontam pra cá, e
                      agora caem direto na resposta em vez de numa grade de números. */}
                  <Card
                    id="liberdade-financeira"
                    className={`flex flex-col gap-2.5 p-5 scroll-mt-24 ${isSurplus ? "border-success/30 bg-success-soft/40" : "border-danger/30 bg-danger-soft/40"}`}
                  >
                    <div className="flex items-center gap-2">
                      {isSurplus ? (
                        <TrendingUp size={18} className="text-success" strokeWidth={1.75} />
                      ) : (
                        <TrendingDown size={18} className="text-danger" strokeWidth={1.75} />
                      )}
                      <p className={`text-sm font-semibold ${isSurplus ? "text-success" : "text-danger"}`}>
                        {isSurplus ? voz.titulos.apDaPe : voz.titulos.apNaoDaPe}
                      </p>
                    </div>
                    <p className="text-2xl font-semibold tracking-tight text-ink">
                      {money(usufruct.totalPassiveIncome, { round: true })} por mês
                    </p>
                    <p className="text-sm leading-relaxed text-ink-muted">
                      {voz.titulos.apVereditoIntro}{" "}
                      <span className="font-semibold text-ink">
                        {money(Number(params.desiredPassiveIncome), { round: true })}
                      </span>{" "}
                      {isSurplus ? `${voz.titulos.apSobram} ` : `${voz.titulos.apFaltam} `}
                      <span className={`font-semibold ${isSurplus ? "text-success" : "text-danger"}`}>
                        {money(Math.abs(usufruct.surplusOrDeficit), { round: true })}
                      </span>{" "}
                      {voz.titulos.apTodoMes}
                      {Number(params.otherPassiveIncome) > 0 && (
                        <>
                          {" "}
                          Já contando as outras rendas de{" "}
                          {money(Number(params.otherPassiveIncome), { round: true })}.
                        </>
                      )}
                    </p>
                  </Card>

                  {/* Tudo em dinheiro de hoje, a mesma moeda da manchete. Somar o que saiu do
                      bolso com os juros NOMINAIS ao lado de um valor final REAL não fecha:
                      são cenários diferentes (ver o comentário em computeAccumulation). */}
                  <Section
                    title={voz.titulos.apDeOndeVem}
                    hint={voz.titulos.apDeOndeVemHint}
                  >
                    <CompositionBar
                      slices={[
                        {
                          key: "bolso",
                          label: voz.titulos.apBolso(accumulation.years),
                          value: accumulation.totalInvested,
                          formatted: money(accumulation.totalInvested, { round: true }),
                          color: "var(--color-accent)",
                        },
                        {
                          key: "juros",
                          label: voz.titulos.apJuros,
                          value: accumulation.totalReturnReal,
                          formatted: money(accumulation.totalReturnReal, { round: true }),
                          color: "var(--color-success)",
                        },
                      ]}
                      footnote={
                        accumulation.totalInvested > 0 && accumulation.totalReturnReal > 0
                          ? voz.titulos.apJurosNota(money(1, { round: true }), money(accumulation.totalReturnReal / accumulation.totalInvested))
                          : undefined
                      }
                    />
                  </Section>

                  <CollapsibleSection label={voz.titulos.apPremissas}>
                    <div className="flex flex-col gap-4">
                      <StatRows
                        items={[
                          { label: "Tempo de contribuição", value: `${accumulation.years} anos` },
                          { label: "Rendimento ao ano", value: formatPercent(accumulation.nominalAnnualRate) },
                          { label: "Inflação assumida", value: formatPercent(Number(params.inflationAnnualRate)) },
                          { label: "Rendimento acima da inflação", value: formatPercent(accumulation.realAnnualRate) },
                        ]}
                      />

                      {/* O número grande e empolgante que NÃO é o mesmo cenário da manchete.
                          Fica aqui embaixo, dito por extenso, em vez de disputar a tela. */}
                      <Card className="flex flex-col gap-2 p-5">
                        <p className="text-sm font-semibold text-ink">
                          E se você nunca reajustar o aporte?
                        </p>
                        <p className="text-sm leading-relaxed text-ink-muted">
                          O plano acima assume que você acompanha a inflação: guardar{" "}
                          {money(Number(params.monthlyContributionAccumulation), { round: true })} hoje e ir
                          corrigindo esse valor com o tempo. Se em vez disso você guardar sempre o mesmo valor
                          de face, o saldo chega a{" "}
                          <span className="font-semibold text-ink">
                            {money(accumulation.finalValueNominal, { round: true })}
                          </span>
                          , só que em dinheiro de {new Date().getFullYear() + accumulation.years} — que compra
                          bem menos do que a manchete.
                        </p>
                      </Card>
                    </div>
                  </CollapsibleSection>
                </section>

                <section id="projecao" className="flex flex-col gap-3">
                  <h2 className="text-h2 font-semibold tracking-tight text-ink">{voz.titulos.apProjecao}</h2>
                  <p className="-mt-1 text-sm text-ink-muted">
                    {voz.titulos.apProjecaoSub(params.retirementAge, params.lifeExpectancyAge ?? null)}
                  </p>

                  {years.length === 0 ? (
                    <p className="text-sm text-ink-muted">Idade objetivo já atingida, nada para projetar.</p>
                  ) : (
                    <>
                      <Card className="p-5">
                        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                          <span className="flex items-center gap-1.5">
                            <Badge tone="accent">{voz.titulos.apAcumulo}</Badge> {voz.titulos.apAcumuloDesc}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Badge tone="info">{voz.titulos.apUsufruto}</Badge> {voz.titulos.apUsufrutoDesc}
                          </span>
                        </div>
                        <PatrimonyProjectionChart years={years} nomes={{ nominal: voz.titulos.apNominal, real: voz.titulos.apReal }} />
                      </Card>

                      <CollapsibleSection label={voz.titulos.apAnoAAno}>
                        <ResponsiveTable
                          columns={projectionColumns(money)}
                          rows={years}
                          rowKey={(y) => String(y.year)}
                          maxHeightClassName="max-h-[520px] overflow-y-auto"
                        />
                      </CollapsibleSection>
                    </>
                  )}
                </section>
              </>
            );
          })()}
    </div>
  );
}
