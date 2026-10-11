import type { Grafico, Zona } from "@/lib/analysis/quatro-perguntas";

/**
 * Um gráfico por pergunta na Análise completa (rodada 56, direção A): colunas, réguas, número
 * grande, barras e os 100 pontinhos do S&P 500. Só desenha o que a lib entregou; a lib só entrega
 * o que tem dado de verdade.
 */
const ZONA: Record<Zona, string> = {
  bom: "color-mix(in srgb, var(--color-success) 38%, transparent)",
  bom2: "color-mix(in srgb, var(--color-success) 20%, transparent)",
  neu: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
  amb: "color-mix(in srgb, var(--color-atencao) 30%, transparent)",
};

export function GraficoDaPergunta({ g }: { g: Grafico }) {
  if (g.tipo === "colunas") {
    const mx = Math.max(...g.valores, 0) || 1;
    return (
      <div className="relative">
        {g.topo && <b className="absolute right-0 top-0 text-xs font-semibold text-ink">{g.topo}</b>}
        <div className={`flex items-end gap-1 ${g.topo ? "pt-5" : ""}`} style={{ height: g.topo ? 116 : 96 }}>
          {g.valores.map((v, i) => (
            <span key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <i
                className="an-col block w-full rounded-[5px]"
                style={{
                  height: `${Math.max(2, (v / mx) * 100).toFixed(1)}%`,
                  background: "var(--color-success)",
                  opacity: i === g.valores.length - 1 ? 0.62 : 0.24,
                  ["--d" as string]: `${i * 30}ms`,
                }}
              />
            </span>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {g.rotulos.map((r, i) => (
            // 12 meses num celular estreito: um rótulo sim, outro não, para nenhum sair cortado.
            <small key={i} className={`min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-xs text-ink-muted ${g.rotulos.length > 8 && i % 2 === 0 ? "max-[399px]:invisible" : ""}`}>{r}</small>
          ))}
        </div>
      </div>
    );
  }
  if (g.tipo === "regua") {
    const p = Math.max(2, Math.min(98, ((g.valor - g.min) / (g.max - g.min)) * 100));
    return (
      <div className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-3 text-[13px] text-ink-muted">
          <span>{g.rotulo}</span>
          <b className="font-semibold text-ink tabular-nums">{g.texto}</b>
        </span>
        <span className="relative flex h-1.5 gap-[3px]">
          {g.zonas.map(([w, z], i) => (
            <i key={i} className="block h-full rounded-full" style={{ flex: w, background: ZONA[z] }} />
          ))}
          <em className="absolute top-1/2 block size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface" style={{ left: `${p.toFixed(1)}%`, background: "var(--color-ink)" }} aria-hidden />
        </span>
        {g.extremos && (
          <span className="flex justify-between text-xs text-ink-muted">
            <small>{g.extremos[0]}</small>
            <small>{g.extremos[1]}</small>
          </span>
        )}
      </div>
    );
  }
  if (g.tipo === "grande") {
    return (
      <div className="flex items-center gap-4">
        <b className="text-[2.5rem] font-light leading-none tracking-[-0.03em] text-ink tabular-nums">
          {g.numero}
          {g.unidade && <small className="ml-0.5 text-[0.4em] font-normal text-ink-muted">{g.unidade}</small>}
        </b>
        {g.lado && (
          <span className="flex flex-col">
            <b className="text-[15px] font-semibold text-ink">{g.lado.valor}</b>
            <small className="text-xs text-ink-muted">{g.lado.rotulo}</small>
          </span>
        )}
      </div>
    );
  }
  if (g.tipo === "barras") {
    return (
      <div className="flex flex-col gap-2.5">
        {g.itens.map((it) => (
          <div key={it.rotulo} className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between gap-3 text-[13px] text-ink-muted">
              <span>{it.rotulo}</span>
              <b className="font-semibold text-ink tabular-nums">{it.texto}</b>
            </span>
            <span className="block h-2 w-full overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--color-ink) 7%, transparent)" }}>
              <i
                className="an-barra block h-full rounded-full"
                style={{ width: `${Math.max(3, it.fracao * 100).toFixed(1)}%`, background: it.tom === "bom" ? "color-mix(in srgb, var(--color-success) 60%, transparent)" : "color-mix(in srgb, var(--color-ink) 62%, transparent)" }}
              />
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[5px]" aria-hidden>
      {Array.from({ length: 100 }, (_, i) => (
        <i key={i} className="block aspect-square rounded-full" style={{ background: "var(--color-success)", opacity: 0.5 }} />
      ))}
    </div>
  );
}
