import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { computeAccumulation } from "@/lib/planning/accumulation";
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Planejamento Financeiro — Acúmulo</h1>
        <p className="mt-1 text-sm text-black/60">
          Separa a fase de acúmulo (juntar patrimônio) da fase de usufruto (viver da renda).{" "}
          <Link href="/planejamento/usufruto" className="underline">
            Ver fase de usufruto →
          </Link>
        </p>
      </div>

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
          <h2 className="mb-3 text-lg font-semibold">Resultado da fase de acúmulo</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <SummaryCard label="Tempo de contribuição" value={`${result.years} anos`} />
            <SummaryCard label="Taxa nominal (a.a.)" value={formatPercent(result.nominalAnnualRate)} />
            <SummaryCard label="Taxa real (a.a.)" value={formatPercent(result.realAnnualRate)} />
            <SummaryCard label="Valor final (nominal)" value={formatBRL(result.finalValueNominal)} />
            <SummaryCard label="Valor final (real, poder de compra de hoje)" value={formatBRL(result.finalValueReal)} />
            <SummaryCard label="Total investido (do bolso)" value={formatBRL(result.totalInvested)} />
            <SummaryCard label="Retorno total (juros)" value={formatBRL(result.totalReturn)} />
          </div>
          <p className="mt-3 text-sm">
            <Link href="/planejamento/projecao" className="underline">
              Ver a curva de patrimônio ano a ano →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-4">
      <p className="text-xs text-black/60">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
