/** O anel do progresso: quantas das 21 missões já foram feitas. */
export function AnelDoReset({ feitas, tamanho = 56 }: { feitas: number; tamanho?: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, feitas / 21));
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: tamanho, height: tamanho }}>
      <svg viewBox="0 0 52 52" width={tamanho} height={tamanho} aria-hidden>
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--color-border)" strokeWidth="5" />
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 26 26)" />
      </svg>
      <span className="absolute text-caption font-bold tabular-nums text-ink">
        {feitas}/21
      </span>
    </span>
  );
}
