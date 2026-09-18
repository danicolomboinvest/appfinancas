import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listAssets } from "@/lib/repositories/asset.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { listUpcomingDividendsForUser } from "@/lib/repositories/dividend.repo";
import {
  getPortfolioStrategyComparison,
  STRATEGY_ASSET_CLASS_LABEL,
} from "@/lib/portfolio/strategy";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssetsSection, type StrategySummary } from "./AssetsSection";
import { buildStrategyBullets, summarizeStrategy } from "@/lib/portfolio/strategy-bullets";
import { UpcomingDividendsSection } from "./UpcomingDividendsSection";
import { ContributionCard } from "./ContributionCard";
import { getContributionContext } from "@/lib/portfolio/contribution";
import { getContributionLinkState } from "@/lib/portfolio/contribution-link";
import { AllocateContributionCard } from "./AllocateContributionCard";
import { PARENT_CATEGORY_COLOR } from "@/lib/categories";

export default async function CarteiraPage() {
  const ctx = await getRequiredSession();
  const now = new Date();
  const [assets, goals, comparison, dividends, contribution, aporteDoMes] = await Promise.all([
    listAssets(ctx),
    listGoals(ctx),
    getPortfolioStrategyComparison(ctx),
    listUpcomingDividendsForUser(ctx),
    getContributionContext(ctx, now.getFullYear(), now.getMonth() + 1),
    getContributionLinkState(ctx, now.getFullYear(), now.getMonth() + 1),
  ]);
  const goalNameById = new Map(goals.map((goal) => [goal.id, goal.name]));

  // A Estratégia da Carteira é a alocação ideal, vira o gráfico-alvo e a dica de
  // rebalanceamento na tela principal (o detalhe completo continua em Por Objetivo).
  const hasStrategy = comparison.positions.some((p) => p.targetPercent > 0);
  const strategy: StrategySummary = {
    hasStrategy,
    bullets: buildStrategyBullets(comparison.positions),
    balance: summarizeStrategy(comparison.positions),
    suggestions: comparison.positions
      .filter((p) => p.status !== "DENTRO")
      .sort((a, b) => Math.abs(b.rebalanceAmount) - Math.abs(a.rebalanceAmount))
      .slice(0, 3)
      .map((p) => ({
        label: STRATEGY_ASSET_CLASS_LABEL[p.assetClass],
        amount: p.rebalanceAmount,
      })),
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Carteira de Investimentos"
        subtitle={
          <>
            Acompanhe seus ativos e o objetivo de cada um.{" "}
            <Link href="/carteira/por-objetivo" className="text-accent-strong hover:underline">
              Ver consolidação por objetivo →
            </Link>
          </>
        }
      />

      {/* O que a pessoa já lançou como aporte no mês e ainda não disse onde foi. Aparece ANTES
          da sugestão de aporte: primeiro fecha o que já aconteceu, depois planeja o próximo. */}
      {aporteDoMes.pending > 0 && (
        <AllocateContributionCard
          month={now.getMonth() + 1}
          pending={aporteDoMes.pending}
          goalOfMonth={aporteDoMes.contributions.find((c) => c.goalName)?.goalName ?? null}
          // Ordem da pergunta: primeiro os ativos ligados a uma meta (o dinheiro costuma ir
          // pra lá), depois os maiores. Assim os seis primeiros já respondem quase sempre.
          assets={[...assets]
            .sort((a, b) => Number(Boolean(b.goalId)) - Number(Boolean(a.goalId)) || Number(b.currentValue) - Number(a.currentValue))
            .map((a) => ({
              id: a.id,
              name: a.name,
              ticker: a.ticker,
              goalName: a.goalId ? (goalNameById.get(a.goalId) ?? null) : null,
              color: PARENT_CATEGORY_COLOR.OUTROS,
            }))}
        />
      )}

      {/* Componente de servidor (sem "use client"): recebe os Date do Prisma direto, sem cruzar
          a fronteira servidor→cliente. */}
      <ContributionCard context={contribution} month={now.getMonth() + 1} />

      <UpcomingDividendsSection dividends={dividends} />

      <AssetsSection
        assets={assets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          ticker: asset.ticker,
          assetClass: asset.assetClass,
          objective: asset.objective,
          goalId: asset.goalId,
          quantity: asset.quantity !== null ? Number(asset.quantity) : null,
          investedValue: asset.investedValue !== null ? Number(asset.investedValue) : null,
          fixedIncomeIndex: asset.fixedIncomeIndex,
          currentValue: Number(asset.currentValue),
        }))}
        goals={goals.map((goal) => ({ id: goal.id, name: goal.name }))}
        goalNameById={goalNameById}
        strategy={strategy}
      />
    </div>
  );
}
