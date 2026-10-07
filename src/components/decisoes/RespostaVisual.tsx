import type { Bloco, Veredito, Visual } from "@/lib/decisoes/respostas";

/** As cores de cada veredito: verde bom, âmbar atenção, vermelho ruim. */
const SELO: Record<Veredito, string> = {
  bom: "bg-success text-white",
  atencao: "bg-[#E8A33A] text-[#3a2600]",
  ruim: "bg-danger text-white",
};
const SELO_SUAVE: Record<Veredito, string> = {
  bom: "bg-success-soft text-success",
  atencao: "bg-[var(--color-atencao-fundo)] text-[var(--color-atencao)]",
  ruim: "bg-danger-soft text-danger",
};
const BARRA: Record<Veredito, string> = { bom: "bg-success", atencao: "bg-[#E8A33A]", ruim: "bg-danger" };
const TEXTO: Record<Veredito, string> = { bom: "text-success", atencao: "text-[var(--color-atencao)]", ruim: "text-danger" };

/**
 * A resposta do Decidir desenhada (07/10/2026): a palavra ou o número grande, o selo do veredito e
 * os blocos (quadradinhos, barra, lista, antes e agora). A Dani pediu para trocar o "textão" das
 * respostas por visual; as frases continuam no "Como cheguei nisso", junto da conta.
 */
export function RespostaVisual({ visual, veredito }: { visual: Visual; veredito: Veredito }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        {visual.abertura && <p className="text-sm font-medium text-ink-muted">{visual.abertura}</p>}
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <p className={`text-[2.25rem] font-bold leading-none tracking-tight tabular-nums ${visual.destaque.length > 14 ? "text-[1.75rem]" : ""} ${TEXTO[veredito]}`}>
            {visual.destaque}
          </p>
          {visual.selo && <span className={`mb-1 rounded-full px-2.5 py-1 text-xs font-semibold ${SELO[visual.selo.tom]}`}>{visual.selo.texto}</span>}
        </div>
        {visual.rotulo && <p className="text-sm text-ink-muted">{visual.rotulo}</p>}
      </div>
      {visual.blocos.map((b, i) => (
        <BlocoVisual key={i} bloco={b} />
      ))}
    </div>
  );
}

function BlocoVisual({ bloco }: { bloco: Bloco }) {
  if (bloco.tipo === "numeros") {
    return (
      <div className={`grid gap-2 ${bloco.itens.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {bloco.itens.map((it) => (
          <div key={it.rotulo} className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5">
            <p className="text-caption leading-tight text-ink-muted">{it.rotulo}</p>
            <p className={`mt-0.5 truncate text-[17px] font-bold tabular-nums ${it.tom ? TEXTO[it.tom] : "text-ink"}`}>{it.valor}</p>
          </div>
        ))}
      </div>
    );
  }

  if (bloco.tipo === "barra") {
    const pct = bloco.total > 0 ? Math.min(100, (bloco.valor / bloco.total) * 100) : 0;
    const marca = bloco.marcador !== undefined && bloco.total > 0 ? Math.min(100, (bloco.marcador / bloco.total) * 100) : null;
    return (
      <div className="flex flex-col gap-1.5">
        <div className="relative h-3 rounded-full bg-surface-2">
          <div className={`h-full rounded-full ${BARRA[bloco.tom]}`} style={{ width: `${Math.max(2, pct)}%` }} />
          {/* O tracinho é onde o mês devia estar a esta altura. */}
          {marca !== null && <span className="absolute -top-1 h-5 w-0.5 rounded-full bg-ink" style={{ left: `calc(${marca}% - 1px)` }} aria-hidden />}
        </div>
        <div className="flex justify-between gap-3 text-caption tabular-nums text-ink-muted">
          <span>{bloco.esquerda}</span>
          <span className="text-right">{bloco.direita}</span>
        </div>
      </div>
    );
  }

  if (bloco.tipo === "lista") {
    return (
      <div className="flex flex-col">
        {bloco.titulo && <p className="pb-1 text-sm font-semibold text-ink">{bloco.titulo}</p>}
        <ul className="flex flex-col divide-y divide-border">
          {bloco.itens.map((it) => (
            <li key={it.nome + it.valor} className="flex flex-col gap-1.5 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[15px] font-medium text-ink">{it.nome}</span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">{it.valor}</span>
              </div>
              {(it.pct !== undefined || it.detalhe || it.selo) && (
                <div className="flex items-center gap-2.5">
                  {it.pct !== undefined && (
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full rounded-full ${it.pct > 1 ? "bg-danger" : it.selo ? BARRA[it.selo.tom] : "bg-accent"}`}
                        style={{ width: `${Math.max(2, Math.min(100, it.pct * 100))}%` }}
                      />
                    </div>
                  )}
                  {it.detalhe && <span className={`text-caption text-ink-muted ${it.pct === undefined ? "flex-1" : "shrink-0"}`}>{it.detalhe}</span>}
                  {it.selo && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${SELO_SUAVE[it.selo.tom]}`}>{it.selo.texto}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Antes e agora: duas barrinhas por linha, a de agora na cor do que aconteceu.
  const maior = Math.max(...bloco.linhas.flatMap((l) => [l.antes, l.agora]), 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4 text-caption text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-border-strong" aria-hidden /> {bloco.antes}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-ink" aria-hidden /> {bloco.agora}
        </span>
      </div>
      {bloco.linhas.map((l) => {
        // Cada linha na própria escala quando é porcentagem (não dá pra medir 27% contra R$ 6 mil).
        const escala = l.agoraTexto.endsWith("%") ? Math.max(l.antes, l.agora, 0.0001) : Math.max(maior, 0.0001);
        const melhorou = l.melhorSeMenor ? l.agora < l.antes : l.agora > l.antes;
        const igual = Math.abs(l.agora - l.antes) < 0.005 * Math.max(1, escala);
        return (
          <div key={l.rotulo} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-medium text-ink">{l.rotulo}</span>
              <span className={`text-xs font-semibold ${igual ? "text-ink-muted" : melhorou ? "text-success" : "text-danger"}`}>
                {igual ? "igual" : l.agora > l.antes ? "↑ subiu" : "↓ caiu"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-border-strong" style={{ width: `${Math.max(2, (l.antes / escala) * 100)}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right text-caption tabular-nums text-ink-muted">{l.antesTexto}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full ${igual ? "bg-ink" : melhorou ? "bg-success" : "bg-danger"}`} style={{ width: `${Math.max(2, (l.agora / escala) * 100)}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right text-caption font-semibold tabular-nums text-ink">{l.agoraTexto}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
