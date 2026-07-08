import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { computeYearByYearProjection } from "@/lib/consolidation/projection";
import { PatrimonyProjectionChart } from "@/components/charts/PatrimonyProjectionChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { ProjectionYear } from "@/lib/consolidation/projection";

function formatBRL(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function ProjecaoPage() {
  const ctx = await getRequiredSession();
  const params = await getPlanningParams(ctx);

  if (!params) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Projeção Patrimonial" />
        <p className="text-sm text-ink-muted">
          Preencha primeiro os dados na{" "}
          <Link href="/planejamento/acumulo" className="text-accent-strong hover:underline">
            fase de acúmulo
          </Link>
          .
        </p>
      </div>
    );
  }

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

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Projeção Patrimonial"
        subtitle={`Fase de acúmulo até os ${params.retirementAge} anos${
          params.lifeExpectancyAge ? `, seguida da fase de usufruto até os ${params.lifeExpectancyAge} anos` : ""
        }.`}
      />

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
    </div>
  );
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
