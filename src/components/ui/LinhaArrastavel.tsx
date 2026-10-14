"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Arrastar para o lado (13/10/2026, parcelas de Recorrentes): a linha anda para a esquerda e
 * mostra os botões que estavam atrás ("Editar", "Apagar"), como no Mail do iPhone.
 *
 * - Só o gesto de lado: a linha tem touch-action pan-y, então rolar a tela para cima e para baixo
 *   continua do navegador, e o arrastar só começa quando o dedo anda mais de lado que de pé.
 * - Soltou além da metade: fica aberta; antes disso, volta. Tocar na linha aberta fecha.
 * - Uma aberta por vez: abrir outra fecha esta. Tocar fora também fecha.
 * - Os botões de trás não recebem foco com a linha fechada (o "…" faz o mesmo pelo teclado).
 */

export type AcaoDaLinha = { rotulo: string; icone: LucideIcon; onClick: () => void; tom?: "neutro" | "perigo" };

const LARGURA_DO_BOTAO = 76;
const EVENTO = "linha-arrastavel:abriu";

export function LinhaArrastavel({ acoes, children, className = "" }: { acoes: AcaoDaLinha[]; children: ReactNode; className?: string }) {
  const id = useId();
  const largura = LARGURA_DO_BOTAO * acoes.length;
  const raiz = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const g = useRef<{ x0: number; y0: number; base: number; lado: "h" | "v" | null; arrastou: boolean; ponteiro: number | null }>({ x0: 0, y0: 0, base: 0, lado: null, arrastou: false, ponteiro: null });
  const aberta = x < 0 && !arrastando;

  // Outra linha abriu, ou tocou fora: fecha.
  useEffect(() => {
    if (!aberta) return;
    const outra = (e: Event) => (e as CustomEvent<string>).detail !== id && setX(0);
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setX(0);
    };
    window.addEventListener(EVENTO, outra);
    document.addEventListener("pointerdown", fora, true);
    return () => {
      window.removeEventListener(EVENTO, outra);
      document.removeEventListener("pointerdown", fora, true);
    };
  }, [aberta, id]);

  const soltar = (e: React.PointerEvent) => {
    const s = g.current;
    if (s.ponteiro !== e.pointerId) return;
    s.ponteiro = null;
    if (s.lado !== "h") return;
    setArrastando(false);
    const abrir = x < -largura / 2;
    setX(abrir ? -largura : 0);
    if (abrir) window.dispatchEvent(new CustomEvent(EVENTO, { detail: id }));
  };

  return (
    <div ref={raiz} className={`relative overflow-hidden ${className}`}>
      <div className={`absolute inset-y-0 right-0 flex ${x === 0 && !arrastando ? "invisible" : ""}`} style={{ width: largura }} aria-hidden={!aberta}>
        {acoes.map((a) => (
          <button
            key={a.rotulo}
            type="button"
            tabIndex={aberta ? 0 : -1}
            onClick={() => {
              setX(0);
              a.onClick();
            }}
            className={`flex h-full flex-1 flex-col items-center justify-center gap-1 text-[13px] font-medium ${a.tom === "perigo" ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink"}`}
          >
            <a.icone size={20} strokeWidth={1.8} aria-hidden />
            {a.rotulo}
          </button>
        ))}
      </div>
      <div
        data-linha-arrastavel
        className={`relative bg-surface [touch-action:pan-y] ${arrastando ? "" : "transition-transform duration-200 ease-out"}`}
        style={{ transform: x ? `translateX(${x}px)` : undefined }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          g.current = { x0: e.clientX, y0: e.clientY, base: x, lado: null, arrastou: false, ponteiro: e.pointerId };
        }}
        onPointerMove={(e) => {
          const s = g.current;
          if (s.ponteiro !== e.pointerId) return;
          const dx = e.clientX - s.x0;
          const dy = e.clientY - s.y0;
          if (s.lado === null) {
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
              s.lado = "h";
              s.arrastou = true;
              setArrastando(true);
              e.currentTarget.setPointerCapture?.(e.pointerId);
            } else if (Math.abs(dy) > 8) {
              s.lado = "v";
            }
          }
          if (s.lado === "h") setX(Math.max(-largura - 16, Math.min(0, s.base + dx)));
        }}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        // Depois de arrastar, o clique não abre a linha. Com ela aberta, tocar só fecha.
        onClickCapture={(e) => {
          if (g.current.arrastou || x < 0) {
            g.current.arrastou = false;
            e.preventDefault();
            e.stopPropagation();
            if (!arrastando && x < 0 && g.current.lado !== "h") setX(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
