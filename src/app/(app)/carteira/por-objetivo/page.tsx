import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema, type Voz } from "@/lib/profiles/voice";
import { getPortfolioByObjective, getAllocationByClass } from "@/lib/consolidation/portfolio";
import { getPortfolioStrategyComparison } from "@/lib/portfolio/strategy";
import { AllocationChart } from "@/components/charts/AllocationChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import type { GoalAllocation } from "@/lib/consolidation/portfolio";
import { StrategyComparisonSection } from "./StrategyComparisonSection";
import { formatPercentNumber } from "@/lib/format";
import { serverMoney } from "@/lib/money-server";
import type { MoneyFormatter } from "@/lib/money";
import { Section } from "@/components/ui/Section";


function formatPercent(value: number | null) {
  if (value === null) return "—";
  return formatPercentNumber(value * 100, 1);
}

export default async function CarteiraPorObjetivoPage() {
  const money = await serverMoney();
  const ctx = await getRequiredSession();
  // Empresa não monta estratégia de carteira: só o caixa e os ativos.
  if (ehEmpresa(ctx.profileKind)) redirect("/carteira");
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const [byObjective, allocation, strategyComparison] = await Promise.all([
    getPortfolioByObjective(ctx),
    getAllocationByClass(ctx),
    getPortfolioStrategyComparison(ctx),
  ]);
  const hasStrategy = strategyComparison.positions.some((p) => p.targetPercent > 0);

  return (
    <div className="flex flex-col gap-8">

      <PageHeader
        title={voz.titulos.porObjetivo}
        subtitle={
          <>
            {voz.titulos.porObjetivoSub}{" "}
            <Link href="/carteira" className="text-accent-strong hover:underline">
              {voz.titulos.porObjetivoEditar}
            </Link>
          </>
        }
      />

      <Section title={voz.titulos.posicaoPorObjetivo}>
        {/* Quando NADA tem objetivo, quatro cards diziam a mesma coisa duas vezes (total =
            sem objetivo) e mostravam dois zeros. A resposta é uma frase e um caminho. */}
        {byObjective.totalPortfolio > 0 && byObjective.outro.currentValue >= byObjective.totalPortfolio - 0.005 ? (
          <Card className="flex flex-col gap-2 border-accent/30 bg-accent-soft/30 p-5">
            <p className="text-lg font-semibold text-ink">{voz.titulos.objNenhumTitulo}</p>
            <p className="text-sm leading-relaxed text-ink-muted">
              {voz.titulos.objNenhumTexto(money(byObjective.totalPortfolio, { round: true }))}
            </p>
            <Link href="/carteira" className="w-fit text-sm font-medium text-accent-strong hover:underline">
              {voz.titulos.objNenhumLink}
            </Link>
          </Card>
        ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label={voz.titulos.objReserva}
            value={money(byObjective.reserva.currentValue)}
            hint={
              byObjective.reserva.targetAmount !== null
                ? voz.titulos.cartDaMeta(formatPercent(byObjective.reserva.achievementPercent), money(byObjective.reserva.targetAmount))
                : voz.titulos.objSemMetaHint
            }
          />
          <StatCard label={voz.titulos.objLiberdade} value={money(byObjective.liberdade.currentValue)} />
          <StatCard label={voz.titulos.objSem} value={money(byObjective.outro.currentValue)} />
        </div>
        )}
      </Section>

      {byObjective.metas.length > 0 && (
        <Section title={voz.titulos.secaoMetas}>
          <ResponsiveTable columns={goalColumns(money, voz)} rows={byObjective.metas} rowKey={(goal) => goal.goalId} />
        </Section>
      )}

      <Section
        title={voz.titulos.estrategiaVsAlvo}
        action={
          <Link href="/carteira/estrategia" className="text-caption font-medium text-accent-strong hover:underline">
            {hasStrategy ? voz.titulos.cartEditarEstrategia : voz.titulos.cartDefinirEstrategiaCurto} →
          </Link>
        }
      >
        <StrategyComparisonSection positions={strategyComparison.positions} hasStrategy={hasStrategy} voz={voz} />
      </Section>

      <Section title={voz.titulos.alocacaoPorClasse}>
        {allocation.classes.length === 0 ? (
          <p className="text-sm text-ink-faint">{voz.titulos.cartSemAtivos}</p>
        ) : (
          <AllocationChart classes={allocation.classes} />
        )}
      </Section>
    </div>
  );
}

const goalColumns = (money: MoneyFormatter, voz: Voz): ResponsiveColumn<GoalAllocation>[] => [
  {
    key: "name",
    label: voz.titulos.cartColMeta,
    render: (goal) => (
      <Link href={`/planejamento/metas/${goal.goalId}`} className="font-medium text-accent-strong hover:underline">
        {goal.goalName}
      </Link>
    ),
  },
  { key: "current", label: voz.titulos.cartColAlocado, render: (goal) => money(goal.currentValue) },
  { key: "target", label: voz.titulos.cartColAlvo, render: (goal) => money(goal.targetAmount) },
  { key: "achievement", label: voz.titulos.cartColAtingimento, render: (goal) => formatPercent(goal.achievementPercent) },
];
