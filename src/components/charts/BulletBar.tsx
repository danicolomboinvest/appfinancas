"use client";

import { useEffect, useState } from "react";

/**
 * Barra-bala: uma linha por item, com três informações no mesmo lugar — o quanto já foi
 * (preenchimento), o quanto era pra ser (tracinho) e o texto do lado direito.
 *
 * Existe pra matar a comparação de cabeça. Onde antes eram dois gráficos lado a lado
 * (planejado num, realizado no outro) ou duas roscas (carteira atual e ideal), a pessoa
 * precisava olhar um, guardar o número, olhar o outro e subtrair. Aqui a resposta é a
 * distância entre o preenchimento e o tracinho: passou do tracinho, está adiantada; não
 * chegou, está atrás. Sem conta.
 *
 * Também é o formato que sobrevive ao celular: barras empilhadas verticalmente crescem para
 * baixo, que é justamente a direção em que a tela tem espaço de sobra.
 */

export type BulletRow = {
  /** Chave estável para o React e para o clique. */
  key: string;
  label: string;
  /** Cor do preenchimento (aceita var(--color-*)). */
  color: string;
  /** 0 a 100+. Acima de 100 a barra satura, mas o excesso fica marcado em vermelho. */
  fillPercent: number;
  /** 0 a 100. Onde a barra "deveria" estar; ausente quando não há alvo (ex.: sem orçamento). */
  targetPercent?: number | null;
  /** Texto à direita do nome, ex.: "R$ 1.518 de 1.500" ou "falta R$ 469". */
  rightLabel: string;
  /** Marca o item como estourado: o preenchimento vira vermelho, independentemente da cor. */
  isOver?: boolean;
  /** Sem plano definido: barra neutra e apagada, em vez de acusar estouro de um limite que não existe. */
  isUnplanned?: boolean;
};

export function BulletBar({
  rows,
  /** Legenda do tracinho, só aparece quando existe pelo menos um alvo. */
  targetHint,
  onSelect,
}: {
  rows: BulletRow[];
  targetHint?: string;
  onSelect?: (key: string) => void;
}) {
  // Cresce de zero ao entrar na tela: é a animação que faz o olho ler aquilo como progresso,
  // e não como um desenho estático. Mesmo comportamento da ProgressBar e do ProgressRing.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (rows.length === 0) return null;
  const hasTarget = rows.some((r) => r.targetPercent != null);

  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((row) => {
        const fill = Math.min(Math.max(row.fillPercent, 0), 100);
        const fillColor = row.isUnplanned
          ? "var(--color-ink-faint)"
          : row.isOver
            ? "var(--color-danger)"
            : row.color;
        const Row = onSelect ? "button" : "div";

        return (
          <Row
            key={row.key}
            {...(onSelect ? { type: "button" as const, onClick: () => onSelect(row.key) } : {})}
            className={`grid w-full grid-cols-[1fr_auto] items-baseline gap-x-2 gap-y-1 text-left ${
              onSelect ? "cursor-pointer rounded-lg transition-opacity hover:opacity-80" : ""
            } ${row.isUnplanned ? "opacity-70" : ""}`}
          >
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink">
              <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: fillColor }} />
              <span className="truncate">{row.label}</span>
            </span>
            <span className={`text-xs tabular-nums ${row.isOver ? "text-danger" : "text-ink-muted"}`}>
              {row.rightLabel}
            </span>

            <span className="relative col-span-2 block h-2.5 rounded-full bg-surface-2">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: grown ? `${fill}%` : "0%",
                  backgroundColor: fillColor,
                  transition: "width 700ms cubic-bezier(0.2, 0, 0, 1)",
                }}
              />
              {row.targetPercent != null && (
                // O tracinho passa por cima do preenchimento, então precisa contrastar com ele
                // e com o trilho vazio ao mesmo tempo — daí a cor da tinta, não uma cor da paleta.
                <span
                  aria-hidden
                  className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-ink/80"
                  style={{ left: `calc(${Math.min(Math.max(row.targetPercent, 0), 100)}% - 1px)` }}
                />
              )}
            </span>
          </Row>
        );
      })}

      {hasTarget && targetHint && <p className="text-xs text-ink-faint">{targetHint}</p>}
    </div>
  );
}
