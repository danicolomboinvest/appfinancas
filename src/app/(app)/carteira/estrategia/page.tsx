import type { StrategyAssetClass } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { listPortfolioStrategy } from "@/lib/repositories/portfolio-strategy.repo";
import { STRATEGY_ASSET_CLASSES } from "@/lib/portfolio/strategy";
import { PageHeader } from "@/components/ui/PageHeader";
import { StrategyForm } from "./StrategyForm";
import { listGoals } from "@/lib/repositories/goal.repo";
import { horizonFromGoals } from "@/lib/portfolio/risk-profile";

export default async function EstrategiaCarteiraPage() {
  const ctx = await getRequiredSession();
  const [rows, goals] = await Promise.all([listPortfolioStrategy(ctx), listGoals(ctx)]);
  // O prazo do quiz sai das metas dela; perguntar de novo seria pedir a mesma informação duas
  // vezes, e aceitar uma resposta que pode contradizer o que ela já cadastrou.
  const goalHorizon = horizonFromGoals(
    goals.map((g) => ({ name: g.name, targetAmount: Number(g.targetAmount), targetDate: g.targetDate })),
  );

  const defaults = Object.fromEntries(
    STRATEGY_ASSET_CLASSES.map((assetClass) => [
      assetClass,
      Number(rows.find((r) => r.assetClass === assetClass)?.targetPercent ?? 0) * 100,
    ]),
  ) as Record<StrategyAssetClass, number>;

  return (
    <div className="flex flex-col gap-6">

      <PageHeader
        title="Estratégia da Carteira"
        subtitle="Defina os percentuais-alvo por classe de estratégia (somando 100%), independente da alocação-ideal de cada ativo individual."
      />

      <StrategyForm defaults={defaults} goalHorizon={goalHorizon} />
    </div>
  );
}
