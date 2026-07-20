"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Anima um número de 0 até `value` na entrada da tela (~1,3s, easing de desaceleração) — o
 * "count-up" dos números-herói pedido no documento de referência de design. Formate o valor
 * já animado com `format` (ex.: moeda) pra não perder a formatação durante a transição.
 * Respeita prefers-reduced-motion (pula direto pro valor final, sem animar).
 */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  durationMs = 1300,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startValueRef = useRef(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplay(value);
      startValueRef.current = value;
      return;
    }

    const from = startValueRef.current;
    const to = value;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      // easeOutCubic — desacelera suavemente até o valor final, nunca "bate" seco.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        startValueRef.current = to;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reinicia a animação quando o valor-alvo muda
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
