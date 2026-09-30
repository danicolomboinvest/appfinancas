"use client";

import { ChevronDown } from "lucide-react";

/**
 * Os números de apoio de um simulador (parcela, valor financiado, custo de oportunidade…) e o
 * gráfico ano a ano, recolhidos. O veredito e as barras ficam à vista; isto é pra quem quer
 * conferir. Antes eram três cartões grandes empilhados que, no celular, empurravam os controles
 * pra longe da resposta.
 */
export function DetalhesDoResultado({
  titulo = "Ver os números",
  itens = [],
  children,
}: {
  titulo?: string;
  itens?: { rotulo: string; valor: string; tom?: "bom" | "ruim" }[];
  children?: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl bg-surface-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-ink">
        {titulo}
        <ChevronDown size={16} className="text-ink-faint transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-4 px-4 pb-4">
        {itens.length > 0 && (
          <dl className="flex flex-col divide-y divide-border">
            {itens.map((i) => (
              <div key={i.rotulo} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-sm text-ink-muted">{i.rotulo}</dt>
                <dd className={`shrink-0 text-sm font-semibold tabular-nums ${i.tom === "bom" ? "text-success" : i.tom === "ruim" ? "text-danger" : "text-ink"}`}>{i.valor}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </div>
    </details>
  );
}
