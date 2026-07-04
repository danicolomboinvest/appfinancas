import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { computeYearByYearProjection } from "@/lib/consolidation/projection";
import { PatrimonyProjectionChart } from "@/components/charts/PatrimonyProjectionChart";

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
        <h1 className="text-2xl font-semibold">Projeção de patrimônio</h1>
        <p className="text-sm text-black/60">
          Preencha primeiro os dados na{" "}
          <Link href="/planejamento/acumulo" className="underline">
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Projeção de patrimônio ano a ano</h1>
        <p className="mt-1 text-sm text-black/60">
          Fase de acúmulo até os {params.retirementAge} anos
          {params.lifeExpectancyAge ? `, seguida da fase de usufruto até os ${params.lifeExpectancyAge} anos` : ""}.
        </p>
      </div>

      {years.length === 0 ? (
        <p className="text-sm text-black/60">Idade objetivo já atingida — nada para projetar.</p>
      ) : (
        <>
          <PatrimonyProjectionChart years={years} />

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-black/60">
                <th className="py-2">Idade</th>
                <th className="py-2">Fase</th>
                <th className="py-2">Investido</th>
                <th className="py-2">Juros acumulados</th>
                <th className="py-2">Patrimônio (nominal)</th>
                <th className="py-2">Patrimônio (real)</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year} className="border-b border-black/5">
                  <td className="py-2">{y.age}</td>
                  <td className="py-2">{y.phase === "ACCUMULATION" ? "Acúmulo" : "Usufruto"}</td>
                  <td className="py-2">{formatBRL(y.totalInvested)}</td>
                  <td className="py-2">{formatBRL(y.cumulativeInterest)}</td>
                  <td className="py-2">{formatBRL(y.balanceNominal)}</td>
                  <td className="py-2">{formatBRL(y.balanceReal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
