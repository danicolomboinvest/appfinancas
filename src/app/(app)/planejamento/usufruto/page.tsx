import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { computeAccumulation } from "@/lib/planning/accumulation";
import { computeUsufruct } from "@/lib/planning/usufruct";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function UsufrutoPage() {
  const ctx = await getRequiredSession();
  const params = await getPlanningParams(ctx);

  if (!params) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Planejamento Financeiro — Usufruto</h1>
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

  const accumulation = computeAccumulation({
    currentAge: params.currentAge,
    retirementAge: params.retirementAge,
    currentPatrimony: Number(params.currentPatrimony),
    monthlyContributionAccumulation: Number(params.monthlyContributionAccumulation),
    accumulationAnnualRate: Number(params.accumulationAnnualRate),
    inflationAnnualRate: Number(params.inflationAnnualRate),
  });

  const usufruct = computeUsufruct({
    finalValueReal: accumulation.finalValueReal,
    usufructAnnualRate: Number(params.usufructAnnualRate),
    otherPassiveIncome: Number(params.otherPassiveIncome),
    desiredPassiveIncome: Number(params.desiredPassiveIncome),
  });

  const isSurplus = usufruct.surplusOrDeficit >= 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Planejamento Financeiro — Usufruto</h1>
        <p className="mt-1 text-sm text-black/60">
          Compara a renda que o patrimônio acumulado geraria com o padrão de vida desejado.{" "}
          <Link href="/planejamento/acumulo" className="underline">
            ← editar dados
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Patrimônio ao se aposentar (real)" value={formatBRL(accumulation.finalValueReal)} />
        <SummaryCard label="Renda passiva da carteira" value={formatBRL(usufruct.monthlyPassiveIncomeFromPortfolio)} />
        <SummaryCard label="Renda passiva total (+ outras rendas)" value={formatBRL(usufruct.totalPassiveIncome)} />
        <SummaryCard label="Gasto mensal desejado" value={formatBRL(Number(params.desiredPassiveIncome))} />
      </div>

      <div
        className={`rounded-lg border p-4 ${isSurplus ? "border-green-600/30 bg-green-50" : "border-red-600/30 bg-red-50"}`}
      >
        <p className="text-sm font-medium">{isSurplus ? "Superávit" : "Déficit"}</p>
        <p className="mt-1 text-2xl font-semibold">{formatBRL(usufruct.surplusOrDeficit)}</p>
        <p className="mt-2 text-sm text-black/60">
          {isSurplus
            ? "A renda passiva projetada cobre o padrão de vida desejado — liberdade financeira atingida nesse cenário."
            : "A renda passiva projetada não cobre o padrão de vida desejado. Falta patrimônio ou é preciso reduzir o gasto objetivo."}
        </p>
      </div>
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
