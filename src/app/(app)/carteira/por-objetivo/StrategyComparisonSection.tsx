import Link from "next/link";
import type { StrategyClassPosition } from "@/lib/portfolio/strategy";
import { STRATEGY_ASSET_CLASS_LABEL } from "@/lib/portfolio/strategy";
import { Card } from "@/components/ui/Card";
import { DonutAllocationChart } from "@/components/charts/DonutAllocationChart";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPP(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)} p.p.`;
}

const STATUS_LABEL: Record<StrategyClassPosition["status"], string> = {
  ACIMA: "Acima do alvo",
  DENTRO: "Dentro do alvo",
  ABAIXO: "Abaixo do alvo",
};

const STATUS_TONE: Record<StrategyClassPosition["status"], string> = {
  ACIMA: "border-t-danger text-danger",
  DENTRO: "border-t-success text-success",
  ABAIXO: "border-t-accent text-accent-strong",
};

export function StrategyComparisonSection({
  positions,
  hasStrategy,
}: {
  positions: StrategyClassPosition[];
  hasStrategy: boolean;
}) {
  if (!hasStrategy) {
    return (
      <Card className="p-5 text-sm text-ink-muted">
        Você ainda não definiu uma{" "}
        <Link href="/carteira/estrategia" className="text-accent-strong hover:underline">
          estratégia da carteira
        </Link>
        . Defina os percentuais-alvo por classe para ver aqui o comparativo e o rebalanceamento.
      </Card>
    );
  }

  const currentData = positions.map((p) => ({ name: STRATEGY_ASSET_CLASS_LABEL[p.assetClass], value: p.currentPercent }));
  const targetData = positions.map((p) => ({ name: STRATEGY_ASSET_CLASS_LABEL[p.assetClass], value: p.targetPercent }));

  return (
    <div className="flex flex-col gap-4">
      <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <DonutAllocationChart title="Carteira atual" data={currentData} />
        <DonutAllocationChart title="Estratégia-alvo" data={targetData} />
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {positions
          .filter((p) => p.targetPercent > 0 || p.currentValue > 0)
          .map((p) => (
            <Card key={p.assetClass} className={`border-t-2 p-4 ${STATUS_TONE[p.status]}`}>
              <p className="text-sm font-medium text-ink">{STRATEGY_ASSET_CLASS_LABEL[p.assetClass]}</p>
              <p className={`mt-1 text-xs font-medium ${STATUS_TONE[p.status]}`}>{STATUS_LABEL[p.status]}</p>
              <div className="mt-2 flex items-baseline justify-between text-xs text-ink-muted">
                <span>
                  {(p.currentPercent * 100).toFixed(1)}% atual vs. {(p.targetPercent * 100).toFixed(1)}% alvo
                </span>
                <span>{formatPP(p.deviationPercent)}</span>
              </div>
              <p className="mt-2 text-xs text-ink-faint">
                {p.rebalanceAmount >= 0
                  ? `Comprar ${formatBRL(p.rebalanceAmount)} para bater o alvo`
                  : `Vender ${formatBRL(-p.rebalanceAmount)} para bater o alvo`}
              </p>
            </Card>
          ))}
      </div>
    </div>
  );
}
