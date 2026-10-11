"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { lerAtivoAction } from "../analises-actions";
import { AnelDePerguntas } from "./aneis";

/** Primeira leitura de um código que ainda não tem análise: lê agora e abre. Falhou, diz isso. */
export function LerEAbrir({ ticker }: { ticker: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    lerAtivoAction(ticker)
      .then((r) => {
        if (!vivo) return;
        if (r.ok) router.refresh();
        else setErro(r.erro);
      })
      .catch(() => vivo && setErro(`Não consegui ler ${ticker} agora.`));
    return () => {
      vivo = false;
    };
  }, [ticker, router]);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Link href="/fichas" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start px-1 text-sm text-ink-muted">
        <ChevronLeft size={18} strokeWidth={1.8} aria-hidden />
        Análises
      </Link>
      <div className="flex flex-col items-center gap-4 py-6 text-center" aria-live="polite">
        <AnelDePerguntas forcas={[null, null, null, null]} tamanho={160} espessura={11} meio={<b className="text-lg font-semibold text-ink">{ticker}</b>} />
        {erro ? (
          <>
            <p className="text-[15px] text-ink">{erro}</p>
            <p className="max-w-xs text-sm text-ink-muted">Confira o código ou tente de novo em instantes.</p>
            <button type="button" onClick={() => location.reload()} className="min-h-11 px-3 text-sm font-medium text-accent-strong">Tentar de novo</button>
          </>
        ) : (
          <p className="an-lendo text-sm text-ink-muted">Lendo os números de hoje</p>
        )}
      </div>
    </div>
  );
}
