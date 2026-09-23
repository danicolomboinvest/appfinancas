"use client";

import { RefreshCw } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

/**
 * Tela de erro amigável em pt-BR, sem ela, qualquer exceção de servidor (banco fora do ar,
 * sessão expirada no meio de uma action) mostrava o "Application error" padrão do Next em
 * inglês, a pior tela possível pra quem não é técnico. Os dados da pessoa não são afetados;
 * na maioria dos casos recarregar resolve.
 *
 * As frases vêm da voz do tema. Esta tela mora na raiz do app, fora do shell que monta o
 * Provider — então, enquanto não existir um `error.tsx` dentro de `(app)`, ela fala como o
 * Padrão. Já lê do catálogo pra, no dia que existir, mudar de voz sem mexer aqui.
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { voz } = useProfileTheme();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-5xl" aria-hidden>
        😵‍💫
      </span>
      <h1 className="text-xl font-semibold tracking-tight text-ink">{voz.titulos.uiErroTitulo}</h1>
      <p className="max-w-sm text-sm leading-relaxed text-ink-muted">{voz.titulos.uiErroTexto}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-on-accent transition-transform active:scale-95"
      >
        <RefreshCw size={16} strokeWidth={2} />
        {voz.titulos.uiErroTentarDeNovo}
      </button>
    </div>
  );
}
