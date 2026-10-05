/**
 * Enquanto a tela seguinte vem do servidor (05/10/2026, "cara de premium"): a forma dela, com um
 * brilho passando, no lugar da tela anterior parada sem resposta ao toque. Fica dentro do app, então a
 * barra de baixo e o topo não piscam. Genérico de propósito: título, o cartão grande do número e
 * os cartões de baixo, que é o desenho da maioria das telas.
 */
export default function Carregando() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando">
      <div className="esqueleto h-8 w-2/3 rounded-xl" />
      <div className="esqueleto h-44 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        <div className="esqueleto h-24 rounded-2xl" />
        <div className="esqueleto h-24 rounded-2xl" />
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="esqueleto size-10 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="esqueleto h-3.5 w-3/4 rounded-full" />
              <div className="esqueleto h-3 w-1/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
