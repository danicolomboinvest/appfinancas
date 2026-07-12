import { TrendingDown, TrendingUp } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { computeAccumulation } from "@/lib/planning/accumulation";
import { computeUsufruct } from "@/lib/planning/usufruct";
import { computeYearByYearProjection, type ProjectionYear } from "@/lib/consolidation/projection";
import { PatrimonyProjectionChart } from "@/components/charts/PatrimonyProjectionChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import { PlanningParamsForm } from "./PlanningParamsForm";
import { PlanningWizard } from "./PlanningWizard";
import { formatPercentNumber } from "@/lib/format";

function formatBRL(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number) {
  return formatPercentNumber(value * 100, 2);
}

const projectionColumns: ResponsiveColumn<ProjectionYear>[] = [
  { key: "age", label: "Idade", render: (y) => y.age },
  {
    key: "phase",
    label: "Fase",
    render: (y) => (
      <Badge tone={y.phase === "ACCUMULATION" ? "accent" : "info"}>{y.phase === "ACCUMULATION" ? "Acúmulo" : "Usufruto"}</Badge>
    ),
  },
  { key: "invested", label: "Investido", render: (y) => formatBRL(y.totalInvested) },
  { key: "interest", label: "Juros acumulados", render: (y) => formatBRL(y.cumulativeInterest) },
  { key: "nominal", label: "Patrimônio (nominal)", render: (y) => formatBRL(y.balanceNominal) },
  { key: "real", label: "Patrimônio (real)", render: (y) => formatBRL(y.balanceReal) },
];

export default async function IndependenciaFinanceiraPage() {
  const ctx = await getRequiredSession();
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

  // Primeira vez (sem parâmetros): wizard guiado "Quanto custa a vida que você quer?" — uma
  // pergunta por tela. Só depois de concluir é que a pessoa cai no dashboard abaixo (item 4).
  if (!params) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Independência Financeira"
          subtitle="Vamos montar seu plano em alguns passos rápidos."
        />
        <PlanningWizard />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Independência Financeira"
        subtitle="Da fase de acúmulo até viver de renda: acompanhe a jornada inteira em um só lugar."
      />

      <CollapsibleSection label="Editar meus dados" defaultOpen={false}>
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

            const growthSparkline = years
              .filter((y) => y.phase === "ACCUMULATION")
              .map((y) => ({ label: `${y.age} anos`, value: y.balanceReal }));

            const usufruct = computeUsufruct({
              finalValueReal: accumulation.finalValueReal,
              usufructAnnualRate: Number(params.usufructAnnualRate),
              otherPassiveIncome: Number(params.otherPassiveIncome),
              desiredPassiveIncome: Number(params.desiredPassiveIncome),
            });
            const isSurplus = usufruct.surplusOrDeficit >= 0;

            return (
              <>
                <section id="acumulo" className="flex flex-col gap-3">
                  <h2 className="text-h2 font-semibold tracking-tight text-ink">Fase de acúmulo</h2>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <StatCard label="Tempo de contribuição" value={`${accumulation.years} anos`} />
                    <StatCard label="Taxa nominal (a.a.)" value={formatPercent(accumulation.nominalAnnualRate)} />
                    <StatCard label="Taxa real (a.a.)" value={formatPercent(accumulation.realAnnualRate)} />
                    <StatCard label="Valor final (nominal)" value={formatBRL(accumulation.finalValueNominal)} />
                    <StatCard
                      label="Valor final (real, poder de compra de hoje)"
                      value={formatBRL(accumulation.finalValueReal)}
                      tone="accent"
                      sparkline={growthSparkline}
                    />
                    <StatCard label="Total investido (do bolso)" value={formatBRL(accumulation.totalInvested)} />
                    <StatCard label="Retorno total (juros)" value={formatBRL(accumulation.totalReturn)} tone="success" />
                  </div>
                </section>

                <section id="liberdade-financeira" className="flex flex-col gap-3">
                  <h2 className="text-h2 font-semibold tracking-tight text-ink">Liberdade Financeira</h2>
                  <p className="-mt-1 text-sm text-ink-muted">
                    Compara a renda que o patrimônio acumulado geraria com o padrão de vida desejado.
                  </p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <StatCard label="Patrimônio ao se aposentar (real)" value={formatBRL(accumulation.finalValueReal)} tone="accent" />
                    <StatCard label="Renda passiva da carteira" value={formatBRL(usufruct.monthlyPassiveIncomeFromPortfolio)} />
                    <StatCard label="Renda passiva total (+ outras rendas)" value={formatBRL(usufruct.totalPassiveIncome)} />
                    <StatCard label="Gasto mensal desejado" value={formatBRL(Number(params.desiredPassiveIncome))} />
                  </div>

                  <Card className={`p-5 ${isSurplus ? "border-success/30 bg-success-soft/40" : "border-danger/30 bg-danger-soft/40"}`}>
                    <div className="flex items-center gap-2">
                      {isSurplus ? (
                        <TrendingUp size={18} className="text-success" strokeWidth={1.75} />
                      ) : (
                        <TrendingDown size={18} className="text-danger" strokeWidth={1.75} />
                      )}
                      <p className={`text-sm font-medium ${isSurplus ? "text-success" : "text-danger"}`}>
                        {isSurplus ? "Superávit" : "Déficit"}
                      </p>
                    </div>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{formatBRL(usufruct.surplusOrDeficit)}</p>
                    <p className="mt-2 text-sm text-ink-muted">
                      {isSurplus
                        ? "A renda passiva projetada cobre o padrão de vida desejado — liberdade financeira atingida nesse cenário."
                        : "A renda passiva projetada não cobre o padrão de vida desejado. Falta patrimônio ou é preciso reduzir o gasto objetivo."}
                    </p>
                  </Card>
                </section>

                <section id="projecao" className="flex flex-col gap-3">
                  <h2 className="text-h2 font-semibold tracking-tight text-ink">Projeção patrimonial</h2>
                  <p className="-mt-1 text-sm text-ink-muted">
                    Fase de acúmulo até os {params.retirementAge} anos
                    {params.lifeExpectancyAge ? `, seguida da fase de usufruto até os ${params.lifeExpectancyAge} anos` : ""}.
                  </p>

                  {years.length === 0 ? (
                    <p className="text-sm text-ink-muted">Idade objetivo já atingida — nada para projetar.</p>
                  ) : (
                    <>
                      <Card className="p-5">
                        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                          <span className="flex items-center gap-1.5">
                            <Badge tone="accent">Acúmulo</Badge> você ainda está aportando — o patrimônio só cresce.
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Badge tone="info">Usufruto</Badge> os aportes param e os saques para viver começam.
                          </span>
                        </div>
                        <PatrimonyProjectionChart years={years} />
                      </Card>

                      <CollapsibleSection label="Ver dados detalhados ano a ano">
                        <ResponsiveTable
                          columns={projectionColumns}
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
