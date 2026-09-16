import { Card } from "@/components/ui/Card";
import type { ParaVoce } from "@/lib/analysis/para-voce";
import type { MoneyFormatter } from "@/lib/money";

/**
 * O fecho do laudo: a carteira e a estratégia da pessoa, lidas junto com os números do ativo.
 * Duas linhas e uma frase — e nada quando não há o que dizer (sem carteira e sem estratégia
 * não existe "para você", e um card vazio seria pior que nenhum).
 */
export function ParaVoceCard({ data, ticker, money }: { data: ParaVoce; ticker: string; money: MoneyFormatter }) {
  const { position, strategy, monthlyIncomePerThousand } = data;
  if (!position && !strategy && monthlyIncomePerThousand === null) return null;

  const t = ticker.toUpperCase();
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  let frase: string | null = null;
  if (strategy) {
    if (strategy.status === "ACIMA") {
      frase = `Comprar mais agora te deixa ainda mais concentrada em ${strategy.classLabel.toLowerCase()} do que a sua própria estratégia pede.`;
    } else if (strategy.status === "ABAIXO") {
      frase = `Você está abaixo do que a sua estratégia pede em ${strategy.classLabel.toLowerCase()} — se for comprar algo dessa classe, este é o espaço que existe.`;
    } else {
      frase = `Você está dentro do que a sua estratégia pede em ${strategy.classLabel.toLowerCase()}.`;
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-accent/30 bg-accent-soft/30 p-5">
      <h2 className="text-h3 font-semibold text-ink">E para você?</h2>

      {position ? (
        <Row label={`Você já tem em ${t}`} value={`${money(position.value, { round: true })} · ${pct(position.percentOfPortfolio)} da carteira`} />
      ) : (
        <Row label={`Você já tem em ${t}`} value="nada ainda" muted />
      )}

      {strategy && (
        <Row
          label={`Sua estratégia pede em ${strategy.classLabel.toLowerCase()}`}
          value={`${pct(strategy.targetPercent)} · hoje ${pct(strategy.currentPercent)}`}
          tone={strategy.status === "ACIMA" ? "danger" : strategy.status === "ABAIXO" ? "accent" : undefined}
        />
      )}

      {(frase || monthlyIncomePerThousand !== null) && (
        <p className="text-sm leading-relaxed text-ink">
          {frase}
          {frase && monthlyIncomePerThousand !== null && " "}
          {monthlyIncomePerThousand !== null && (
            <>
              Se comprar {money(1000, { round: true })}, o dividendo dos últimos 12 meses daria{" "}
              <span className="font-semibold">~{money(monthlyIncomePerThousand)} por mês</span>.
            </>
          )}
        </p>
      )}

      <p className="text-caption text-ink-faint">
        Isso não é recomendação. É a sua carteira e a sua estratégia, lidas junto com os números do ativo.
      </p>
    </Card>
  );
}

function Row({ label, value, muted, tone }: { label: string; value: string; muted?: boolean; tone?: "danger" | "accent" }) {
  const cls = tone === "danger" ? "text-danger" : tone === "accent" ? "text-accent-strong" : muted ? "text-ink-faint" : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className={`shrink-0 text-sm font-semibold tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}
