import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Card } from "./Card";

type Tone = "success" | "danger" | "accent" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  danger: "text-danger",
  accent: "text-accent-strong",
  neutral: "text-ink",
};

const TONE_BAR: Record<Tone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  accent: "bg-accent",
  neutral: "bg-ink-faint",
};

export function LinkedStatCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
  progressPercent,
  tone = "neutral",
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  /** 0 a 1, quando presente, mostra uma barra de progresso abaixo do valor. */
  progressPercent?: number;
  tone?: Tone;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="flex flex-col gap-3 p-3.5 transition-colors duration-150 hover:border-accent-strong/40 hover:bg-surface-hover sm:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </div>
          <ChevronRight size={15} className="text-ink-faint transition-transform duration-150 group-hover:translate-x-0.5" />
        </div>
        <p className={`text-lg leading-snug font-semibold tracking-tight sm:text-xl ${TONE_TEXT[tone]}`}>{value}</p>
        {progressPercent !== undefined && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full ${TONE_BAR[tone]}`}
              style={{ width: `${Math.round(Math.min(Math.max(progressPercent, 0), 1) * 100)}%` }}
            />
          </div>
        )}
        {hint && <p className="text-xs text-ink-faint">{hint}</p>}
      </Card>
    </Link>
  );
}
