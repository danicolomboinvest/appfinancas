import type { HTMLAttributes } from "react";

type Tone = "success" | "danger" | "gold" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  gold: "bg-gold-soft text-gold-strong",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-2 text-ink-muted",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      {...props}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
    />
  );
}
