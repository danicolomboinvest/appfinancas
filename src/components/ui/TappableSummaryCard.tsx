import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Card } from "./Card";
import { ProgressBar } from "./ProgressBar";

type ProgressTone = "success" | "danger" | "accent" | "neutral";

const HERO_VALUE_TONE: Record<"accent" | "danger", string> = {
  accent: "text-accent-strong",
  danger: "text-danger",
};

/**
 * Card-resumo tocável — usado na tela Resumo (home). O card inteiro é um link, sem botão
 * separado: tocar em qualquer parte leva para `href`. `size="hero"` é o tratamento de
 * destaque (Fraunces + valor grande) reservado ao card de maior prioridade da tela (ex.:
 * "Quanto posso gastar hoje"); os demais usam `size="regular"` (ícone + título + valor).
 */
export function TappableSummaryCard({
  href,
  icon: Icon,
  title,
  value,
  hint,
  progressPercent,
  progressTone = "neutral",
  size = "regular",
  heroTone = "accent",
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  value: string;
  hint?: string;
  /** 0 a 1 — quando presente, mostra uma barra de progresso abaixo do valor. */
  progressPercent?: number;
  progressTone?: ProgressTone;
  size?: "regular" | "hero";
  /** Só se aplica a size="hero" — dourado é o padrão (número em destaque = conquista), mas
   * vira alerta sóbrio quando o número representa algo negativo (ex.: orçamento estourado). */
  heroTone?: "accent" | "danger";
}) {
  if (size === "hero") {
    return (
      <Link href={href} className="group block">
        <Card className="flex flex-col gap-2 p-6 transition-colors duration-150 hover:border-accent-strong/40 hover:bg-surface-hover">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-medium text-ink-muted">
              <Icon size={15} strokeWidth={1.75} />
              {title}
            </span>
            <ChevronRight size={16} className="text-ink-faint transition-transform duration-150 group-hover:translate-x-0.5" />
          </div>
          <p className={`font-serif text-display font-normal tracking-tight ${HERO_VALUE_TONE[heroTone]}`}>{value}</p>
          {hint && <p className="text-sm text-ink-muted">{hint}</p>}
        </Card>
      </Link>
    );
  }

  return (
    <Link href={href} className="group block">
      <Card className="flex flex-col gap-3 p-4 transition-colors duration-150 hover:border-accent-strong/40 hover:bg-surface-hover">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <Icon size={15} strokeWidth={1.75} />
            {title}
          </div>
          <ChevronRight size={15} className="text-ink-faint transition-transform duration-150 group-hover:translate-x-0.5" />
        </div>
        <p className="text-lg font-semibold tracking-tight text-ink sm:text-xl">{value}</p>
        {progressPercent !== undefined && <ProgressBar percent={progressPercent} tone={progressTone} />}
        {hint && <p className="text-xs text-ink-faint">{hint}</p>}
      </Card>
    </Link>
  );
}
