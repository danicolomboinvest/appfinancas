import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-4 text-center">
      <p className="text-label text-ink-faint">Erro 404</p>
      <h1 className="text-h1 font-semibold tracking-tight text-ink">Essa página não existe.</h1>
      <p className="max-w-sm text-body text-ink-muted">
        Verifique o endereço ou volte para o início — sua vida financeira está te esperando lá.
      </p>
      <Link
        href="/inicio"
        className="mt-2 inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink shadow-premium-sm transition-all duration-150 ease-out hover:bg-accent-strong"
      >
        Voltar para o início
      </Link>
    </div>
  );
}
