"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

/**
 * Erro dentro das telas logadas. Sem este arquivo quem pegava era o `src/app/error.tsx` da raiz,
 * que fica FORA do shell: um erro numa ação (internet caiu, sessão expirou) trocava o app
 * inteiro — menu, abas, perfil — por "deu erro". Aqui o erro fica só na área da página, o menu
 * continua, e a frase sai na voz do tema (o Provider do tema está no shell, acima deste arquivo).
 *
 * "Tentar de novo" usa `unstable_retry`, que busca a página de novo no servidor. O `reset` só
 * redesenhava com os mesmos dados e caía no mesmo erro.
 */
export default function AppErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { voz } = useProfileTheme();
  useEffect(() => {
    console.error("Erro numa tela do app", error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-5xl" aria-hidden>
        😵‍💫
      </span>
      <h1 className="text-xl font-semibold tracking-tight text-ink">{voz.titulos.uiErroTitulo}</h1>
      <p className="max-w-sm text-sm leading-relaxed text-ink-muted">{voz.titulos.uiErroTexto}</p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-on-accent transition-transform active:scale-95"
      >
        <RefreshCw size={16} strokeWidth={2} />
        {voz.titulos.uiErroTentarDeNovo}
      </button>
    </div>
  );
}
