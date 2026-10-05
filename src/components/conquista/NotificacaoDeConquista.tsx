"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { celebrar } from "@/lib/celebrar";
import { marcarConquistaVistaAction } from "./actions";

export type ConquistaParaMostrar = { chave: string; icone: string; titulo: string; texto: string };

/**
 * A notificação de uma conquista rara (05/10/2026): um cartão no meio da tela dizendo o que ela
 * conquistou, e o confete caindo quando ele abre. A Dani: "não é para ser do nada na tela, é
 * para quando abrir a notificação aparecer o confete". Mostra uma conquista por vez; ao fechar,
 * marca como comemorada e não volta mais.
 */
export function NotificacaoDeConquista({ conquistas, onFim }: { conquistas: ConquistaParaMostrar[]; onFim?: () => void }) {
  const { voz } = useProfileTheme();
  const [i, setI] = useState(0);
  const [, startTransition] = useTransition();
  const [montado, setMontado] = useState(false);
  const atual = conquistas[i] ?? null;

  useEffect(() => {
    // Portal em document.body (como o Modal): dentro da página, o cartão ficava preso abaixo da
    // barra de baixo. document.body só existe no cliente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMontado(true);
  }, []);

  // O confete vem junto com o cartão, uma vez por conquista (pela chave: a tela de trás pode
  // redesenhar e mandar a mesma conquista num objeto novo).
  const chave = atual?.chave;
  useEffect(() => {
    if (chave) celebrar();
  }, [chave]);

  if (!atual || !montado) return null;

  const fechar = () => {
    startTransition(() => {
      void marcarConquistaVistaAction(atual.chave);
    });
    if (i + 1 >= conquistas.length) onFim?.();
    setI(i + 1);
  };

  return createPortal(
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="conquista-titulo">
      <div className="glass animate-fade-in w-full max-w-sm rounded-3xl p-6 text-center">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-accent-soft text-4xl" aria-hidden>
          {atual.icone}
        </span>
        <h2 id="conquista-titulo" className="mt-4 text-h2 font-bold tracking-tight text-ink">
          {atual.titulo}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{atual.texto}</p>
        <button
          type="button"
          onClick={fechar}
          autoFocus
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent-gradient px-5 text-sm font-semibold text-on-accent shadow-premium-sm"
        >
          {voz.titulos.conqBotao}
        </button>
      </div>
    </div>,
    document.body,
  );
}
