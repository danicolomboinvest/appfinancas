"use client";

import { RefreshCw } from "lucide-react";

/**
 * Tela de erro amigável em pt-BR, sem ela, qualquer exceção de servidor (banco fora do ar,
 * sessão expirada no meio de uma action) mostrava o "Application error" padrão do Next em
 * inglês, a pior tela possível pra quem não é técnico. Os dados da pessoa não são afetados;
 * na maioria dos casos recarregar resolve.
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-5xl" aria-hidden>
        😵‍💫
      </span>
      <h1 className="text-xl font-semibold tracking-tight text-ink">Ops, algo deu errado por aqui</h1>
      <p className="max-w-sm text-sm leading-relaxed text-ink-muted">
        Foi um erro nosso, não seu, seus dados estão seguros. Tente recarregar; se continuar, saia e entre de novo.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-on-accent transition-transform active:scale-95"
      >
        <RefreshCw size={16} strokeWidth={2} />
        Tentar de novo
      </button>
    </div>
  );
}
