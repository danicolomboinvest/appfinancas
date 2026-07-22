/** Skeleton exibido enquanto qualquer tela do app carrega no servidor, evita a tela branca
 * em conexões lentas (especialmente no celular/PWA). */
export default function AppLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Carregando">
      <div className="h-8 w-56 rounded-lg bg-surface-2" />
      <div className="h-4 w-72 rounded bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface-2" />
        ))}
      </div>
      <div className="h-48 rounded-2xl bg-surface-2" />
    </div>
  );
}
