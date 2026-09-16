import { Card } from "@/components/ui/Card";
import type { ParaVoce } from "@/lib/analysis/para-voce";
import type { MoneyFormatter } from "@/lib/money";

/**
 * "E para você?" em formas: duas barras e um número grande. A barra da estratégia leva um
 * tracinho no alvo, como a barra-bala do orçamento — passou do tracinho, está acima do que
 * a própria estratégia pede. Nada aqui é recomendação, e a frase que diz isso é a menor.
 */
export function ParaVoceCard({ data, ticker, money }: { data: ParaVoce; ticker: string; money: MoneyFormatter }) {
  const { position, strategy, monthlyIncomePerThousand } = data;
  if (!position && !strategy && monthlyIncomePerThousand === null) return null;

  const t = ticker.toUpperCase();
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const acima = strategy?.status === "ACIMA";

  return (
    <Card className="flex flex-col gap-4 border-accent/30 bg-accent-soft/30 p-4">
      <h2 className="text-[15px] font-semibold text-ink">E para você?</h2>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-caption text-ink-muted">
          <span>{t} na sua carteira</span>
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
            <span>
              {strategy.classLabel}: sua estratégia pede {pct(strategy.targetPercent)}
            </span>
            <b className={acima ? "text-danger" : "text-ink"}>hoje {pct(strategy.currentPercent)}</b>
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
          {acima && <p className="text-caption text-danger">Comprar mais te concentra ainda mais do que a sua estratégia pede.</p>}
        </div>
      )}

      {monthlyIncomePerThousand !== null && (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold tracking-tight text-ink">{money(monthlyIncomePerThousand, { round: true })}</span>
          <span className="text-caption text-ink-muted">por mês a cada {money(1000, { round: true })}, pelos dividendos de hoje</span>
        </div>
      )}

      <p className="text-[11px] text-ink-faint">Não é recomendação: é a sua carteira lida junto com os números do ativo.</p>
    </Card>
  );
}
