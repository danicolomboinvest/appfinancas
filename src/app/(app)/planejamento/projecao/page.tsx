import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { computeYearByYearProjection } from "@/lib/consolidation/projection";
import { PatrimonyProjectionChart } from "@/components/charts/PatrimonyProjectionChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

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
          <Link href="/planejamento/acumulo" className="text-gold-strong hover:underline">
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
            <PatrimonyProjectionChart years={years} />
          </Card>

          <Card className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border bg-surface-2/50 text-ink-muted">
                  <th className="px-4 py-3 font-medium">Idade</th>
                  <th className="px-4 py-3 font-medium">Fase</th>
                  <th className="px-4 py-3 font-medium">Investido</th>
                  <th className="px-4 py-3 font-medium">Juros acumulados</th>
                  <th className="px-4 py-3 font-medium">Patrimônio (nominal)</th>
                  <th className="px-4 py-3 font-medium">Patrimônio (real)</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y.year} className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                    <td className="px-4 py-3 text-ink">{y.age}</td>
                    <td className="px-4 py-3">
                      <Badge tone={y.phase === "ACCUMULATION" ? "gold" : "info"}>
                        {y.phase === "ACCUMULATION" ? "Acúmulo" : "Usufruto"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatBRL(y.totalInvested)}</td>
                    <td className="px-4 py-3 text-ink-muted">{formatBRL(y.cumulativeInterest)}</td>
                    <td className="px-4 py-3 text-ink-muted">{formatBRL(y.balanceNominal)}</td>
                    <td className="px-4 py-3 text-ink">{formatBRL(y.balanceReal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
