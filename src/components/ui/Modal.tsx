"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Modal centralizado no desktop, vira um drawer que sobe da base no mobile. Renderiza via
 * portal em document.body, evita ficar preso dentro de um <form> ou de qualquer ancestral com
 * overflow/transform (ver histórico de bugs de FAB "preso" nesse mesmo tipo de problema). */
export function Modal({
  open,
  onClose,
  title,
  acoes,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Botões pequenos no cabeçalho, antes do X (ex.: ajuda e configurações no Mais). */
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // document.body só existe no cliente, este efeito detecta a montagem pra evitar
    // createPortal durante o render no servidor, não sincroniza com nenhum estado do React.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Leitor de tela e teclado: ao abrir, o foco entra no painel (antes ficava no botão que abriu,
  // atrás do fundo escuro); ao fechar, volta pra esse botão, pra ela não se perder na página.
  useEffect(() => {
    if (!open || !mounted) return;
    const anterior = document.activeElement as HTMLElement | null;
    // Se um campo de dentro já pegou o foco (autoFocus do valor, por exemplo), não rouba, e aí
    // não há botão de fora pra devolver o foco depois.
    const jaDentro = painelRef.current?.contains(anterior) ?? false;
    if (!jaDentro) painelRef.current?.focus({ preventScroll: true });
    const volta = jaDentro ? null : anterior;
    return () => volta?.focus?.({ preventScroll: true });
  }, [open, mounted]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      {/* O fundo escuro fecha no toque, mas fica fora do Tab e do leitor de tela: antes ele era o
          1º "Fechar" da fila, seguido de outro "Fechar" (o X). */}
      <button aria-hidden tabIndex={-1} onClick={onClose} className="fixed inset-0 bg-black/60" />
      {/* 90dvh (não vh) porque no Safari o vh ignora a barra de endereço e o fim do painel
          ficava escondido; o padding de baixo soma a área segura do iPhone, senão o último botão
          fica colado na barrinha de gesto no app instalado. */}
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 max-h-[90dvh] w-full max-w-lg animate-fade-in overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface px-6 pt-6 pb-[calc(1.5rem+var(--safe-bottom))] shadow-premium outline-none sm:rounded-2xl sm:pb-6"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          {acoes && <div className="ml-auto flex items-center gap-1">{acoes}</div>}
          {/* 44px de toque (size-11); o -mr-2 mantém o X alinhado à borda como antes. */}
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Fechar"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
