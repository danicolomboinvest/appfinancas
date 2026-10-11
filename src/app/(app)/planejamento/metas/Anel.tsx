/** O anel de porcentagem das Metas (protótipo, "proposta A"): trilho e o caminho já guardado. */
export function Anel({
  pct,
  tamanho,
  espessura,
  atras = false,
  naFoto = false,
  textoClasse = "text-sm font-semibold",
  rotulo,
  trilho,
}: {
  pct: number;
  tamanho: number;
  espessura: number;
  atras?: boolean;
  naFoto?: boolean;
  textoClasse?: string;
  rotulo?: string;
  /** Cor do trilho, quando o anel fica em cima de um fundo pintado (herói). */
  trilho?: string;
}) {
  const r = (tamanho - espessura) / 2;
  const c = 2 * Math.PI * r;
  const cheio = (c * Math.min(Math.max(pct, 1), 100)) / 100;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: tamanho, height: tamanho }} role="img" aria-label={rotulo ?? `${pct}% guardado`}>
      <svg viewBox={`0 0 ${tamanho} ${tamanho}`} className={`mt-anel size-full -rotate-90 ${atras ? "atras" : ""} ${naFoto ? "na-foto" : ""}`} aria-hidden>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} className="tr" strokeWidth={espessura} style={trilho ? { stroke: trilho } : undefined} />
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} className="ch" strokeWidth={espessura} strokeDasharray={`${cheio.toFixed(1)} ${c.toFixed(1)}`} />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center tabular-nums ${textoClasse}`} aria-hidden>
        {pct}%
      </span>
    </span>
  );
}
