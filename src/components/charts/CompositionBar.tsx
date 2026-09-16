"use client";

import { useEffect, useState } from "react";

export type CompositionSlice = {
  key: string;
  label: string;
  value: number;
  /** Já formatado na moeda da pessoa: o componente é client, quem chama é server. */
  formatted: string;
  color: string;
};

/**
 * "De onde vem esse dinheiro": uma barra dividida em partes que SOMAM um total, com a legenda
 * logo abaixo.
 *
 * Existe porque dois números lado a lado num card cada — o que saiu do bolso e o que os juros
 * puseram — não dizem a única coisa que importa ali: a proporção entre eles. Empilhados na
 * mesma barra, a resposta ("quase todo o patrimônio veio dos juros") é o desenho, não uma
 * conta que a pessoa precisa fazer de cabeça.
 *
 * As fatias precisam ser do MESMO cenário: misturar valor real com juros nominais foi
 * exatamente o erro que este componente nasceu para tornar impossível de esconder.
 */
export function CompositionBar({ slices, footnote }: { slices: CompositionSlice[]; footnote?: string }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const total = slices.reduce((soma, s) => soma + Math.max(s.value, 0), 0);
  if (total <= 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3.5 overflow-hidden rounded-full bg-surface-2">
        {slices.map((s) => (
          <span
            key={s.key}
            style={{
              width: grown ? `${(Math.max(s.value, 0) / total) * 100}%` : "0%",
              backgroundColor: s.color,
              transition: "width 700ms cubic-bezier(0.2, 0, 0, 1)",
            }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {slices.map((s) => (
          <div key={s.key} className="flex items-baseline gap-2">
            <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="flex-1 text-sm text-ink">{s.label}</span>
            <span className="text-sm font-semibold tabular-nums text-ink">{s.formatted}</span>
          </div>
        ))}
      </div>

      {footnote && <p className="text-caption leading-relaxed text-ink-faint">{footnote}</p>}
    </div>
  );
}
