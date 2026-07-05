type Tone = "success" | "danger" | "gold" | "neutral";

const TONE_BAR: Record<Tone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  gold: "bg-gold",
  neutral: "bg-ink-faint",
};

export function ProgressBar({
  percent,
  tone = "gold",
  className = "",
}: {
  /** 0 a 1. */
  percent: number;
  tone?: Tone;
  className?: string;
}) {
  const clamped = Math.min(Math.max(percent, 0), 1);
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-surface-2 ${className}`}>
      <div className={`h-full rounded-full transition-all duration-300 ${TONE_BAR[tone]}`} style={{ width: `${Math.round(clamped * 100)}%` }} />
    </div>
  );
}
