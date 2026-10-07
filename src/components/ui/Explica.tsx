"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * O "?" pequenininho ao lado de um número ou título (07/10/2026). A Dani: "não precisa se
 * justificar em tudo; coloca um pontinho de interrogação do lado dos números, bem pequenininho, e
 * a pessoa clica e explica". A explicação abre num balão ao tocar e fecha ao tocar fora.
 *
 * O balão vai para o fim da página (portal), com posição fixa: dentro dos cartões (`.glass` tem
 * overflow hidden) ele seria cortado.
 */
/** `noHeroi`: dentro do bloco pintado do número, o "?" usa a cor de texto do bloco. */
export function Explica({ children, rotulo = "O que é isso?", noHeroi = false }: { children: ReactNode; rotulo?: string; noHeroi?: boolean }) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const balao = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pos) return;
    const fechar = (e: Event) => {
      const alvo = e.target as Node;
      if (botao.current?.contains(alvo) || balao.current?.contains(alvo)) return;
      setPos(null);
    };
    const fecharSempre = () => setPos(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPos(null);
    document.addEventListener("pointerdown", fechar);
    document.addEventListener("keydown", esc);
    // Posição fixa: rolar a tela com o balão aberto o deixaria solto no ar. Fecha.
    window.addEventListener("scroll", fecharSempre, true);
    window.addEventListener("resize", fecharSempre);
    return () => {
      document.removeEventListener("pointerdown", fechar);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", fecharSempre, true);
      window.removeEventListener("resize", fecharSempre);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={botao}
        type="button"
        aria-label={rotulo}
        aria-expanded={pos !== null}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (pos) return setPos(null);
          const r = e.currentTarget.getBoundingClientRect();
          // O balão começa perto do "?" mas nunca passa da borda da tela (12px de folga dos dois lados).
          const largura = Math.min(256, window.innerWidth - 24);
          const esquerda = Math.min(Math.max(12, r.left - 8), window.innerWidth - largura - 12);
          setPos({ top: r.bottom + 6, left: esquerda, width: largura });
        }}
        // A área de toque é maior que o desenho: o círculo tem 18px, o botão 28px.
        className={`-m-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full align-middle transition-colors ${noHeroi ? "text-heroi-suave hover:text-heroi-tinta" : "text-ink-faint hover:text-ink"}`}
      >
        <span className="flex size-[18px] items-center justify-center rounded-full border border-current text-xs font-bold leading-none">?</span>
      </button>
      {pos &&
        createPortal(
          <span
            ref={balao}
            role="tooltip"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
            className="z-[110] block rounded-xl border border-border bg-surface p-3 text-left text-caption font-normal normal-case leading-snug tracking-normal text-ink shadow-premium"
          >
            {children}
          </span>,
          document.body,
        )}
    </>
  );
}
