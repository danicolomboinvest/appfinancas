import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { computeAccumulation } from "@/lib/planning/accumulation";
import { computeUsufruct } from "@/lib/planning/usufruct";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function UsufrutoPage() {
  const ctx = await getRequiredSession();
  const params = await getPlanningParams(ctx);

  if (!params) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Liberdade Financeira" />
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
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Liberdade Financeira"
        subtitle={
          <>
            Compara a renda que o patrimônio acumulado geraria com o padrão de vida desejado.{" "}
            <Link href="/planejamento/acumulo" className="text-gold-strong hover:underline">
              ← editar dados
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Patrimônio ao se aposentar (real)" value={formatBRL(accumulation.finalValueReal)} tone="gold" />
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
    </div>
  );
}
