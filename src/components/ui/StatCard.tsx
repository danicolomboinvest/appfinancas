import { Card } from "./Card";

type Tone = "success" | "danger" | "gold" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "text-success",
  danger: "text-danger",
  gold: "text-gold-strong",
  neutral: "text-ink",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  /** Comparação com o período anterior (ex.: mês passado). `goodDirection` define se "para cima" é positivo. */
  trend?: { percent: number; periodLabel: string; goodDirection?: "up" | "down" };
}) {
  const trendUp = trend !== undefined && trend.percent >= 0;
  const trendIsGood = trend !== undefined && (trend.goodDirection === "down" ? !trendUp : trendUp);

  return (
    <Card className="p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tracking-tight ${TONE_CLASSES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
      {trend && (
        <p className={`mt-1 text-xs font-medium ${trendIsGood ? "text-success" : "text-danger"}`}>
          {trendUp ? "↑" : "↓"} {Math.abs(Math.round(trend.percent * 100))}% vs. {trend.periodLabel}
        </p>
      )}
    </Card>
  );
}
