/**
 * Um anel com a porcentagem no meio: "94% do orçamento usado". SVG puro, sem biblioteca,
 * então serve em componente de servidor. Passa de 100% e o anel fecha inteiro em vermelho.
 */
export function AnelPercentual({ pct, tom = "accent", size = 96, rotulo }: { pct: number; tom?: "accent" | "success" | "danger"; size?: number; rotulo?: string }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const cheio = Math.max(0, Math.min(1, pct));
  const cor = pct > 1 ? "var(--color-danger)" : tom === "success" ? "var(--color-success)" : tom === "danger" ? "var(--color-danger)" : "var(--color-accent)";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(pct * 100)}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={cor}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${c * cheio} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.21} fontWeight={600} fill="var(--color-ink)">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      {rotulo && <span className="text-caption text-ink-muted">{rotulo}</span>}
    </div>
  );
}
