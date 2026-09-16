"use client";

import { useEffect, useState } from "react";

/**
 * Planejado × realizado para RENDA e APORTE — onde passar do plano é bom.
 *
 * Não reaproveita a barra-bala do orçamento de propósito: lá, passar do planejado é estouro e
 * fica vermelho. Aqui é o contrário — ganhar mais do que esperava e guardar mais do que
 * prometeu são as duas melhores notícias que o mês pode dar. Usar o mesmo desenho pintaria de
 * vermelho exatamente o que a pessoa quer ver.
 */
export function PlanVsActualRow({
  label,
  planned,
  actual,
  formatted,
  color,
}: {
  label: string;
  planned: number;
  actual: number;
  /** Já formatado na moeda da pessoa (o componente é client, quem chama é server). */
  formatted: { planned: string; actual: string };
  color: string;
}) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const semPlano = planned <= 0;
  const razao = semPlano ? 0 : actual / planned;
  const alcancou = razao >= 1;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-[15px] font-semibold text-ink">{label}</span>
        <span className="text-caption tabular-nums text-ink-muted">
          {semPlano ? (
            <>
              {formatted.actual} · <span className="text-ink-faint">sem plano definido</span>
            </>
          ) : (
            <>
              {formatted.actual} de {formatted.planned}
              {" · "}
              <span className={alcancou ? "text-success" : "text-ink-muted"}>{Math.round(razao * 100)}%</span>
            </>
          )}
        </span>
      </div>
      <span className="relative block h-2.5 rounded-full bg-surface-2">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: grown ? `${Math.min(Math.max(razao, 0), 1) * 100}%` : "0%",
            backgroundColor: semPlano ? "var(--color-ink-faint)" : alcancou ? "var(--color-success)" : color,
            transition: "width 700ms cubic-bezier(0.2, 0, 0, 1)",
          }}
        />
      </span>
    </div>
  );
}
