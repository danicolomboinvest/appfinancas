/**
 * "Nenhuma transação · Nesse período" (protótipo, estados vazios): o desenho do recibo e duas
 * linhas curtas, sem parágrafo nem botões (o + do Registrar já está na tela).
 */
export function VazioDeTransacoes() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center" data-vazio-transacoes>
      <svg viewBox="0 0 64 72" className="h-16 w-14 text-ink-faint" aria-hidden>
        <path d="M10 4h44v62l-7-5-7 5-8-5-8 5-7-5-7 5z" fill="var(--color-surface)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M20 20h24M20 30h24M20 40h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <b className="text-[17px] font-medium text-ink">Nenhuma transação</b>
      <span className="text-sm text-ink-muted">Nesse período</span>
    </div>
  );
}
