import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listAssets } from "@/lib/repositories/asset.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import {
  getPortfolioStrategyComparison,
  STRATEGY_ASSET_CLASS_LABEL,
  STRATEGY_ASSET_CLASS_COLOR,
} from "@/lib/portfolio/strategy";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssetsSection, type StrategySummary } from "./AssetsSection";

export default async function CarteiraPage() {
  const ctx = await getRequiredSession();
  const [assets, goals, comparison] = await Promise.all([
    listAssets(ctx),
    listGoals(ctx),
    getPortfolioStrategyComparison(ctx),
  ]);
  const goalNameById = new Map(goals.map((goal) => [goal.id, goal.name]));

  // A Estratégia da Carteira é a alocação ideal — vira o gráfico-alvo e a dica de
  // rebalanceamento na tela principal (o detalhe completo continua em Por Objetivo).
  const hasStrategy = comparison.positions.some((p) => p.targetPercent > 0);
  const strategy: StrategySummary = {
    hasStrategy,
    targets: comparison.positions
      .filter((p) => p.targetPercent > 0)
      .map((p) => ({
        name: STRATEGY_ASSET_CLASS_LABEL[p.assetClass],
        value: p.targetPercent,
        color: STRATEGY_ASSET_CLASS_COLOR[p.assetClass],
      })),
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
