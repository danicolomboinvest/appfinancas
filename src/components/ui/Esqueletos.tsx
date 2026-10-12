/**
 * Esqueletos com a forma de cada área (12/10/2026): aparecem no mesmo instante do toque, enquanto
 * a tela vem do servidor. O brilho é a classe `esqueleto` (globals.css).
 */
export function EsqueletoDeLista({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando">
      <div className="esqueleto h-12 w-full rounded-full" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="esqueleto h-10 w-20 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <div className="esqueleto size-10 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="esqueleto h-3.5 w-2/3 rounded-full" />
              <div className="esqueleto h-3 w-1/3 rounded-full" />
            </div>
            <div className="esqueleto h-3.5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EsqueletoDeHeroi() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando">
      <div className="esqueleto h-40 w-full rounded-3xl" />
      <div className="esqueleto h-24 w-full rounded-3xl" />
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="esqueleto size-9 shrink-0 rounded-full" />
            <div className="esqueleto h-3.5 flex-1 rounded-full" />
            <div className="esqueleto h-3.5 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
