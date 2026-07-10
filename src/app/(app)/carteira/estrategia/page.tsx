import type { StrategyAssetClass } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { listPortfolioStrategy } from "@/lib/repositories/portfolio-strategy.repo";
import { STRATEGY_ASSET_CLASSES } from "@/lib/portfolio/strategy";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StrategyForm } from "./StrategyForm";

export default async function EstrategiaCarteiraPage() {
  const ctx = await getRequiredSession();
  const rows = await listPortfolioStrategy(ctx);

  const defaults = Object.fromEntries(
    STRATEGY_ASSET_CLASSES.map((assetClass) => [
      assetClass,
      Number(rows.find((r) => r.assetClass === assetClass)?.targetPercent ?? 0) * 100,
    ]),
  ) as Record<StrategyAssetClass, number>;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Carteira de Investimentos", href: "/carteira" }, { label: "Estratégia" }]} />

      <PageHeader
        title="Estratégia da Carteira"
        subtitle="Defina os percentuais-alvo por classe de estratégia (somando 100%) — independente da alocação-ideal de cada ativo individual."
      />

      <StrategyForm defaults={defaults} />
    </div>
  );
}
