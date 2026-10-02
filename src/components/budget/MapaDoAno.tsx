const MESES = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export type LinhaDoMapa = { key: string; label: string; meses: ("dentro" | "passou" | "agora" | "futuro" | "sem-plano")[] };

const COR: Record<LinhaDoMapa["meses"][number], string> = {
  dentro: "bg-success/70",
  passou: "bg-danger/80",
  agora: "bg-accent/40",
  futuro: "bg-surface-2",
  "sem-plano": "bg-ink/10",
};

/**
 * O ano como mapa de calor (01/10/2026): uma linha por categoria, um quadradinho por mês, verde
 * quando ficou dentro do plano e vermelho quando passou. As barras de antes davam só o total;
 * aqui dá para ver o padrão ("Lazer estoura todo trimestre"). O detalhe continua na tabela.
 */
export function MapaDoAno({ linhas, legenda }: { linhas: LinhaDoMapa[]; legenda?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[5.5rem_repeat(12,minmax(0,1fr))] gap-1 text-center text-xs text-ink-faint">
        <span />
        {MESES.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
      {linhas.map((l) => (
        <div key={l.key} className="grid grid-cols-[5.5rem_repeat(12,minmax(0,1fr))] items-center gap-1">
          <span className="truncate pr-1 text-caption text-ink">{l.label}</span>
          {l.meses.map((estado, i) => (
            <span key={i} className={`h-4 rounded-[4px] ${COR[estado]}`} title={`${MESES[i]}: ${estado}`} />
          ))}
        </div>
      ))}
      {legenda !== false && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-success/70" /> dentro
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-danger/80" /> passou
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-accent/40" /> mês atual
          </span>
        </div>
      )}
    </div>
  );
}
