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
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tracking-tight ${TONE_CLASSES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </Card>
  );
}
