import { Card } from "./Card";
import { FitText } from "./FitText";
import { MiniSparkline, type SparklinePoint } from "./MiniSparkline";

type Tone = "success" | "danger" | "accent" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "text-success",
  danger: "text-danger",
  accent: "text-accent-strong",
  neutral: "text-ink",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  trend,
  sparkline,
  layout = "card",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  /** Comparação com o período anterior (ex.: mês passado). `goodDirection` define se "para cima" é positivo.
   * `displayValue`, quando presente, substitui o "X%" calculado (ex.: um valor em R$), útil para métricas
   * como saldo, onde a variação percentual pode ficar enganosa perto de zero (ver dashboard/page.tsx). */
  trend?: { percent: number; periodLabel: string; goodDirection?: "up" | "down"; displayValue?: string };
  /** Série de pontos (ex.: um por mês) para uma mini-tendência visual, com tooltip ao passar o mouse. */
  sparkline?: SparklinePoint[];
  /**
   * `row`: texto à esquerda, curvinha à direita, ocupando a largura inteira. É o formato de
   * uma LISTA de indicadores no celular — três cards numa grade de dois deixam o terceiro
   * órfão com meia tela vazia do lado. Em `row` a curva nunca fica de fora por falta de
   * espaço vertical, o que acontecia no card com dica.
   */
  layout?: "card" | "row";
}) {
  const trendUp = trend !== undefined && trend.percent >= 0;
  const trendIsGood = trend !== undefined && (trend.goodDirection === "down" ? !trendUp : trendUp);

  const trendChip = trend && (
    <p
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        trendIsGood ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
      }`}
    >
      {trendUp ? "↑" : "↓"} {trend.displayValue ?? `${Math.abs(Math.round(trend.percent * 100))}%`} vs.{" "}
      {trend.periodLabel}
    </p>
  );

  if (layout === "row") {
    return (
      <Card className="flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-muted">{label}</p>
          <p className={`mt-1 text-2xl font-semibold tracking-tight ${TONE_CLASSES[tone]}`}>{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
          {trendChip && <div className="mt-2">{trendChip}</div>}
        </div>
        {sparkline && (
          <div className="w-24 shrink-0 sm:w-28">
            <MiniSparkline points={sparkline} tone={tone === "neutral" ? "accent" : tone} height={44} />
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-3.5 sm:p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      {/* FitText: "R$ 1.234.567,89" é inquebrável e estourava o card em grade 2/3 colunas no
          celular — a fonte encolhe só o necessário pra caber, nunca corta. */}
      <div className="mt-1.5">
        <FitText className={`text-lg leading-snug font-semibold tracking-tight sm:text-xl ${TONE_CLASSES[tone]}`}>
          {value}
        </FitText>
      </div>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
      {sparkline && (
        <div className="-mx-1 mt-2">
          <MiniSparkline points={sparkline} tone={tone === "neutral" ? "accent" : tone} />
        </div>
      )}
      {/* A variação vem DEPOIS da curva e como etiqueta, não como frase solta: o card passa a
          ser "valor → desenho → veredito", que é a ordem em que o olho lê, e a etiqueta
          colorida é o que se vê antes de ler qualquer palavra. */}
      {trendChip && <div className="mt-2">{trendChip}</div>}
    </Card>
  );
}
