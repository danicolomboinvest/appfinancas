"use client";

import { useEffect, useState } from "react";

type Tone = "success" | "danger" | "accent" | "neutral";

const TONE_STROKE: Record<Tone, string> = {
  success: "var(--color-success)",
  danger: "var(--color-danger)",
  accent: "var(--color-accent)",
  neutral: "var(--color-ink-faint)",
};

/**
 * Anel de progresso com o número no meio. Mesma informação da ProgressBar, mas em formato
 * compacto e circular: cabe ao lado de um título sem ocupar uma linha inteira, e a forma
 * fechada comunica "quanto falta pra completar" melhor que uma barra que corre pro infinito.
 *
 * Cresce de 0 até o valor ao entrar na tela, igual à barra — a animação é o que faz o olho
 * perceber que aquilo é progresso, e não só um desenho.
 */
export function ProgressRing({
  percent,
  tone = "accent",
  size = 64,
  label,
  color,
}: {
  /** 0 a 1 (acima de 1 satura no anel cheio, mas o rótulo pode passar de 100%). */
  percent: number;
  tone?: Tone;
  size?: number;
  /** Texto no centro; quando ausente, mostra a porcentagem arredondada. */
  label?: string;
  /** Cor do traço, quando o contexto tem uma cor própria (ex.: a cor da meta). Sobrepõe `tone`. */
  color?: string;
}) {
  const clamped = Math.min(Math.max(percent, 0), 1);
  const radius = 15.5;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOffset(circumference - clamped * circumference));
    return () => cancelAnimationFrame(raf);
  }, [clamped, circumference]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--color-surface-2)" strokeWidth="3.2" />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={color ?? TONE_STROKE[tone]}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms ease-out" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-ink"
        style={{ fontSize: size * 0.24 }}
      >
        {label ?? `${Math.round(percent * 100)}%`}
      </span>
    </div>
  );
}
