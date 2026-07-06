import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { computeAccumulation } from "@/lib/planning/accumulation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { PlanningParamsForm } from "./PlanningParamsForm";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export default async function AcumuloPage() {
  const ctx = await getRequiredSession();
  const params = await getPlanningParams(ctx);

  const result = params
    ? computeAccumulation({
        currentAge: params.currentAge,
        retirementAge: params.retirementAge,
        currentPatrimony: Number(params.currentPatrimony),
        monthlyContributionAccumulation: Number(params.monthlyContributionAccumulation),
        accumulationAnnualRate: Number(params.accumulationAnnualRate),
        inflationAnnualRate: Number(params.inflationAnnualRate),
      })
    : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Planejamento Financeiro — Acúmulo"
        subtitle={
          <>
            Separa a fase de acúmulo (juntar patrimônio) da Liberdade Financeira (viver da renda).{" "}
            <Link href="/planejamento/usufruto" className="text-accent-strong hover:underline">
              Ver Liberdade Financeira →
            </Link>
          </>
        }
      />

      <PlanningParamsForm
        defaults={
          params
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
            : {}
        }
      />

      {result && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-ink-muted">Resultado da fase de acúmulo</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="Tempo de contribuição" value={`${result.years} anos`} />
            <StatCard label="Taxa nominal (a.a.)" value={formatPercent(result.nominalAnnualRate)} />
            <StatCard label="Taxa real (a.a.)" value={formatPercent(result.realAnnualRate)} />
            <StatCard label="Valor final (nominal)" value={formatBRL(result.finalValueNominal)} />
            <StatCard label="Valor final (real, poder de compra de hoje)" value={formatBRL(result.finalValueReal)} tone="accent" />
            <StatCard label="Total investido (do bolso)" value={formatBRL(result.totalInvested)} />
            <StatCard label="Retorno total (juros)" value={formatBRL(result.totalReturn)} tone="success" />
          </div>
          <p className="mt-4 text-sm">
            <Link href="/planejamento/projecao" className="text-accent-strong hover:underline">
              Ver a curva de patrimônio ano a ano →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
