"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Ajuda "?" que funciona no desktop E no toque: abre no clique (toggle) e também no hover do
 * mouse; fecha ao clicar fora ou apertar Esc. Antes era só hover — no desktop, dependendo do
 * navegador/gesto, o balão às vezes não aparecia, e no celular (sem hover) nunca abria.
 */
export function HelpTooltip({ text }: { text: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className="relative ml-1 inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Ajuda"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          // Não deixa o clique submeter o form nem acionar o container clicável ao redor.
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface-2 text-[10px] text-ink-faint transition-colors hover:bg-border-strong hover:text-ink"
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-1 w-56 -translate-x-1/2 rounded-lg border border-border-strong bg-surface-2 px-2.5 py-2 text-xs leading-snug text-ink shadow-premium-sm"
        >
          {text}
        </span>
      )}
    </span>
  );
}
