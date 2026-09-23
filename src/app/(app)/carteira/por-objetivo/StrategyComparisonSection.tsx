import Link from "next/link";
import type { Voz } from "@/lib/profiles/voice";
import type { StrategyClassPosition } from "@/lib/portfolio/strategy";
import { STRATEGY_ASSET_CLASS_LABEL, STRATEGY_ASSET_CLASS_COLOR } from "@/lib/portfolio/strategy";
import { Card } from "@/components/ui/Card";
import { BulletBar } from "@/components/charts/BulletBar";
import { buildStrategyBullets } from "@/lib/portfolio/strategy-bullets";
import { formatPercentNumber } from "@/lib/format";
import { serverMoney } from "@/lib/money-server";


export async function StrategyComparisonSection({
  positions,
  hasStrategy,
  voz,
}: {
  voz: Voz;
  positions: StrategyClassPosition[];
  hasStrategy: boolean;
}) {
  const money = await serverMoney();
  if (!hasStrategy) {
    return (
      // A frase tem um link no meio, por isso vem em três pedaços do catálogo.
      <Card className="p-5 text-sm text-ink-muted">
        {voz.titulos.cartSemEstrategiaAntes}{" "}
        <Link href="/carteira/estrategia" className="text-accent-strong hover:underline">
          {voz.titulos.cartSemEstrategiaLink}
        </Link>
        {voz.titulos.cartSemEstrategiaDepois}
      </Card>
    );
  }

  const bullets = buildStrategyBullets(positions);
  const visible = positions.filter((p) => p.targetPercent > 0 || p.currentValue > 0);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-5">
        <p className="text-sm font-medium text-ink">{voz.titulos.estrategiaVsAlvo}</p>
        <BulletBar rows={bullets} targetHint={voz.titulos.compHint} />
      </Card>

      {/* Só números, o usuário bate o olho e sabe quanto mover. Sem parágrafos (item 5.2). */}
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
                  <p className="text-caption text-ink-muted">{voz.titulos.compVoceTem}</p>
                  <p className="text-indicator font-semibold tabular-nums text-ink">
                    {formatPercentNumber(p.currentPercent * 100, 0)}
                  </p>
                  <p className="text-caption tabular-nums text-ink-faint">{money(p.currentValue, { round: true })}</p>
                </div>
                <div>
                  <p className="text-caption text-ink-muted">{voz.titulos.compDeveriaTer}</p>
                  <p className="text-indicator font-semibold tabular-nums text-ink">
                    {formatPercentNumber(p.targetPercent * 100, 0)}
                  </p>
                  <p className="text-caption tabular-nums text-ink-faint">{money(targetValue, { round: true })}</p>
                </div>
              </div>

              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  aportar ? "bg-success-soft" : "bg-danger-soft"
                }`}
              >
                <span className={`text-caption font-medium ${aportar ? "text-success" : "text-danger"}`}>
                  {aportar ? voz.titulos.compAportar : voz.titulos.compReduzir}
                </span>
                <span className={`text-sm font-semibold tabular-nums ${aportar ? "text-success" : "text-danger"}`}>
                  {aportar ? "+" : "−"} {money(Math.abs(p.rebalanceAmount), { round: true })}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-caption text-ink-faint">{voz.titulos.cartReferenciaMatematica}</p>
    </div>
  );
}
