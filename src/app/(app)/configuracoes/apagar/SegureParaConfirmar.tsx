"use client";

import { useEffect, useRef, useState } from "react";
import { Hand } from "lucide-react";

const TEMPO_MS = 1600;

/**
 * Confirmar segurando o botão (proposta A, 12/10/2026): firme sem assustar, sem palavra para
 * digitar. Segura com o dedo, o mouse ou o teclado (Espaço ou Enter apertados).
 *
 * Quem usa leitor de tela ou só o teclado tem o botão de confirmar normal logo depois: ele é
 * invisível até receber o foco, e o leitor de tela lê os dois.
 */
export function SegureParaConfirmar({
  rotulo,
  rotuloSemSegurar,
  aoConfirmar,
  desabilitado = false,
}: {
  rotulo: string;
  rotuloSemSegurar: string;
  aoConfirmar: () => void;
  desabilitado?: boolean;
}) {
  const [indo, setIndo] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parar = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setIndo(false);
  };
  const comecar = () => {
    if (desabilitado || timer.current) return;
    setIndo(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setIndo(false);
      aoConfirmar();
    }, TEMPO_MS);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={desabilitado}
        onPointerDown={(e) => {
          e.preventDefault();
          comecar();
        }}
        onPointerUp={parar}
        onPointerLeave={parar}
        onPointerCancel={parar}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            comecar();
          }
        }}
        onKeyUp={parar}
        onBlur={parar}
        className="relative min-h-[60px] w-full touch-none select-none overflow-hidden rounded-full bg-surface-2 text-base font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-border-strong)] [-webkit-touch-callout:none] disabled:opacity-40"
      >
        <span
          aria-hidden
          className="absolute inset-0 origin-left [background:var(--botao-fundo,var(--color-ink))]"
          style={{ transform: indo ? "scaleX(1)" : "scaleX(0)", transition: `transform ${indo ? TEMPO_MS : 200}ms linear` }}
        />
        <span className={`relative z-10 flex items-center justify-center gap-2 px-4 ${indo ? "[color:var(--botao-tinta,var(--color-canvas))]" : ""}`}>
          <Hand size={20} strokeWidth={1.8} aria-hidden />
          {rotulo}
        </span>
      </button>
      <button
        type="button"
        disabled={desabilitado}
        onClick={aoConfirmar}
        className="sr-only rounded-full text-sm font-medium text-ink underline underline-offset-4 focus:not-sr-only focus:min-h-11 focus:w-full"
      >
        {rotuloSemSegurar}
      </button>
    </div>
  );
}
