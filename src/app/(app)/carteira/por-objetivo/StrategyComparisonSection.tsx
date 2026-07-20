import Link from "next/link";
import type { StrategyClassPosition } from "@/lib/portfolio/strategy";
import { STRATEGY_ASSET_CLASS_LABEL, STRATEGY_ASSET_CLASS_COLOR } from "@/lib/portfolio/strategy";
import { Card } from "@/components/ui/Card";
import { DonutAllocationChart } from "@/components/charts/DonutAllocationChart";
import { formatPercentNumber } from "@/lib/format";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

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

  const currentData = positions.map((p) => ({
    name: STRATEGY_ASSET_CLASS_LABEL[p.assetClass],
    value: p.currentPercent,
    color: STRATEGY_ASSET_CLASS_COLOR[p.assetClass],
  }));
  const targetData = positions.map((p) => ({
    name: STRATEGY_ASSET_CLASS_LABEL[p.assetClass],
    value: p.targetPercent,
    color: STRATEGY_ASSET_CLASS_COLOR[p.assetClass],
  }));
  const visible = positions.filter((p) => p.targetPercent > 0 || p.currentValue > 0);

  return (
    <div className="flex flex-col gap-4">
      <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <DonutAllocationChart title="Carteira atual" data={currentData} />
        <DonutAllocationChart title="Estratégia-alvo" data={targetData} />
      </Card>

      {/* Só números — o usuário bate o olho e sabe quanto mover. Sem parágrafos (item 5.2). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => {
          const targetValue = p.currentValue + p.rebalanceAmount;
          const aportar = p.rebalanceAmount >= 0;
          return (
            <Card key={p.assetClass} className="flex flex-col gap-3 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: STRATEGY_ASSET_CLASS_COLOR[p.assetClass] }}
                />
                {STRATEGY_ASSET_CLASS_LABEL[p.assetClass]}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-caption text-ink-muted">Você tem</p>
                  <p className="text-indicator font-semibold tabular-nums text-ink">
                    {formatPercentNumber(p.currentPercent * 100, 0)}
                  </p>
                  <p className="text-caption tabular-nums text-ink-faint">{formatBRL(p.currentValue)}</p>
                </div>
                <div>
                  <p className="text-caption text-ink-muted">Deveria ter</p>
                  <p className="text-indicator font-semibold tabular-nums text-ink">
                    {formatPercentNumber(p.targetPercent * 100, 0)}
                  </p>
                  <p className="text-caption tabular-nums text-ink-faint">{formatBRL(targetValue)}</p>
                </div>
              </div>

              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  aportar ? "bg-success-soft" : "bg-danger-soft"
                }`}
              >
                <span className={`text-caption font-medium ${aportar ? "text-success" : "text-danger"}`}>
                  {aportar ? "Aportar" : "Reduzir"}
                </span>
                <span className={`text-sm font-semibold tabular-nums ${aportar ? "text-success" : "text-danger"}`}>
                  {aportar ? "+" : "−"} {formatBRL(Math.abs(p.rebalanceAmount))}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-caption text-ink-faint">
        Referência matemática com base na sua estratégia — não é recomendação de compra ou venda.
      </p>
    </div>
  );
}
