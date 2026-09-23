import { Card } from "@/components/ui/Card";
import type { ParaVoce } from "@/lib/analysis/para-voce";
import type { MoneyFormatter } from "@/lib/money";
import type { Voz } from "@/lib/profiles/voice";

/**
 * "E para você?" em formas: duas barras e um número grande. A barra da estratégia leva um
 * tracinho no alvo, como a barra-bala do orçamento — passou do tracinho, está acima do que
 * a própria estratégia pede. Nada aqui é recomendação, e a frase que diz isso é a menor.
 */
export function ParaVoceCard({ data, ticker, money, voz }: { data: ParaVoce; ticker: string; money: MoneyFormatter; voz: Voz }) {
  const { position, strategy, monthlyIncomePerThousand } = data;
  if (!position && !strategy && monthlyIncomePerThousand === null) return null;

  const t = ticker.toUpperCase();
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const acima = strategy?.status === "ACIMA";
  const textos = voz.titulos;

  return (
    <Card className="flex flex-col gap-4 border-accent/30 bg-accent-soft/30 p-4">
      <h2 className="text-[15px] font-semibold text-ink">{textos.fichasParaVoce}</h2>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-caption text-ink-muted">
          <span>{textos.fichasNaSuaCarteira(t)}</span>
          <b className="text-ink">{position ? pct(position.percentOfPortfolio) : "0%"}</b>
        </div>
        <div className="h-2 rounded-full bg-surface-2">
          <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, (position?.percentOfPortfolio ?? 0) * 100)}%` }} />
        </div>
        {position && <p className="text-caption text-ink-faint">{money(position.value, { round: true })}</p>}
      </div>

      {strategy && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-caption text-ink-muted">
            <span>{textos.fichasEstrategiaPede(strategy.classLabel, pct(strategy.targetPercent))}</span>
            <b className={acima ? "text-danger" : "text-ink"}>{textos.fichasHoje(pct(strategy.currentPercent))}</b>
          </div>
          <div className="relative h-2 rounded-full bg-surface-2">
            <div
              className={`h-2 rounded-full ${acima ? "bg-danger" : "bg-success"}`}
              style={{ width: `${Math.min(100, strategy.currentPercent * 100)}%` }}
            />
            <span
              aria-hidden
              className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink"
              style={{ left: `calc(${Math.min(100, strategy.targetPercent * 100)}% - 1px)` }}
            />
          </div>
          {acima && <p className="text-caption text-danger">{textos.fichasConcentra}</p>}
        </div>
      )}

      {monthlyIncomePerThousand !== null && (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold tracking-tight text-ink">{money(monthlyIncomePerThousand, { round: true })}</span>
          <span className="text-caption text-ink-muted">{textos.fichasPorMil(money(1000, { round: true }))}</span>
        </div>
      )}

      <p className="text-[11px] text-ink-faint">{textos.fichasNaoRecomendacao}</p>
    </Card>
  );
}
