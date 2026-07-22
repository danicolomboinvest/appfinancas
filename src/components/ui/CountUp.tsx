"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Anima um número de 0 até `value` na entrada da tela (~1,3s, easing de desaceleração), o
 * "count-up" dos números-herói pedido no documento de referência de design. Formate o valor
 * já animado com `format` (ex.: moeda) pra não perder a formatação durante a transição.
 * Respeita prefers-reduced-motion (pula direto pro valor final, sem animar).
 */
export function CountUp({
  value,
  format,
  brl = false,
  durationMs = 1300,
  /** Atraso antes de começar a animar, permite "coreografar" vários números entrando em
   * cascata na mesma tela (documento de referência de design), em vez de todos ao mesmo tempo. */
  delayMs = 0,
  className,
}: {
  value: number;
  /** SÓ para chamadores que também são client components, função não atravessa a fronteira
   * servidor→cliente (o React Flight rejeita e derruba a página inteira). De um Server
   * Component, use `brl` em vez de passar formatBRL. */
  format?: (n: number) => string;
  /** Formata como moeda (R$), serializável, seguro pra usar de Server Components. */
  brl?: boolean;
  durationMs?: number;
  delayMs?: number;
  className?: string;
}) {
  const fmt =
    format ??
    (brl
      ? (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : (n: number) => String(Math.round(n)));
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    function tick(now: number, start: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      // easeOutCubic, desacelera suavemente até o valor final, nunca "bate" seco.
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      setDisplay(next);
      // Baseline sempre atualizado: se o valor-alvo mudar NO MEIO da animação (ex.: alternar
      // Mensal/Anual rápido), a próxima começa de onde o número está, sem "voltar pro zero".
      startValueRef.current = next;
      if (t < 1) {
        rafRef.current = requestAnimationFrame((n) => tick(n, start));
      }
    }

    timeoutRef.current = setTimeout(() => {
      rafRef.current = requestAnimationFrame((now) => tick(now, now));
    }, delayMs);

    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reinicia a animação quando o valor-alvo muda
  }, [value, durationMs, delayMs]);

  return <span className={className}>{fmt(display)}</span>;
}
