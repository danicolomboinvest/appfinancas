"use client";

import { useEffect, useState } from "react";

type Tone = "success" | "danger" | "accent" | "neutral";

/** Gradiente de tons próximos por tom, nunca arco-íris, sempre a mesma cor clareando pro branco. */
const TONE_GRADIENT: Record<Exclude<Tone, "neutral">, string> = {
  success: "linear-gradient(90deg, color-mix(in srgb, var(--color-success) 55%, white), var(--color-success))",
  danger: "linear-gradient(90deg, color-mix(in srgb, var(--color-danger) 55%, white), var(--color-danger))",
  accent: "linear-gradient(90deg, var(--color-accent-2), var(--color-accent))",
};

export function ProgressBar({
  percent,
  tone = "accent",
  className = "",
}: {
  /** 0 a 1. */
  percent: number;
  tone?: Tone;
  className?: string;
}) {
  const clamped = Math.min(Math.max(percent, 0), 1);
  // Cresce de 0 até o valor ao entrar na tela (~0,8s ease-out), pedido do documento de
  // referência de design. Começa em 0 e só assume o valor real no próximo tick, pra a
  // transição de CSS ter algo pra animar (senão já nasceria no tamanho final).
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(clamped * 100));
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-white/8 ${className}`}>
      <div
        className="h-full rounded-full transition-[width] duration-[800ms] ease-out"
        style={
          tone === "neutral"
            ? { width: `${width}%`, backgroundColor: "var(--color-ink-faint)" }
            : { width: `${width}%`, backgroundImage: TONE_GRADIENT[tone] }
        }
      />
    </div>
  );
}
