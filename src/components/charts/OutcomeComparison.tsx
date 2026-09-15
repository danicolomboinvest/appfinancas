"use client";

import { useEffect, useState } from "react";
import { useMoney } from "@/components/money/MoneyProvider";


export type Outcome = { label: string; value: number; hint?: string };

/**
 * O veredito de um simulador como forma, não só como número.
 *
 * Nem todo simulador tem curva pra desenhar: "carro por assinatura × comprar", "consórcio ×
 * financiamento" e "vale a pena?" produzem dois totais, não duas séries no tempo. Inventar um
 * eixo de anos aí seria desenhar um dado que a conta não produz.
 *
 * Então o desenho é o que existe de verdade: duas barras na mesma escala, a vencedora
 * destacada, e a diferença escrita embaixo. O olho compara comprimento em vez de ler dois
 * números e subtrair — que era exatamente o trabalho que a tela empurrava pra pessoa.
 */
export function OutcomeComparison({
  a,
  b,
  /** Qual ganhou. "Ganhar" pode ser ter o MAIOR valor (patrimônio) ou o MENOR (custo). */
  winner,
  verdict,
}: {
  a: Outcome;
  b: Outcome;
  winner: "a" | "b";
  verdict: string;
}) {
  const money = useMoney();
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const max = Math.max(Math.abs(a.value), Math.abs(b.value), 1);
  const rows: { outcome: Outcome; isWinner: boolean }[] = [
    { outcome: a, isWinner: winner === "a" },
    { outcome: b, isWinner: winner === "b" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {rows.map(({ outcome, isWinner }) => (
          <div key={outcome.label} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className={`text-sm font-semibold ${isWinner ? "text-ink" : "text-ink-muted"}`}>
                {outcome.label}
              </span>
              <span className={`text-base font-bold tabular-nums ${isWinner ? "text-success" : "text-ink-muted"}`}>
                {money(outcome.value, { round: true })}
              </span>
            </div>
            <span className="relative block h-2.5 rounded-full bg-surface-2">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: grown ? `${(Math.abs(outcome.value) / max) * 100}%` : "0%",
                  backgroundColor: isWinner ? "var(--color-success)" : "var(--color-ink-faint)",
                  transition: "width 700ms cubic-bezier(0.2, 0, 0, 1)",
                }}
              />
            </span>
            {outcome.hint && <span className="text-caption text-ink-faint">{outcome.hint}</span>}
          </div>
        ))}
      </div>

      <p className="rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">{verdict}</p>
    </div>
  );
}
