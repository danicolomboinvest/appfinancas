"use client";

import { useEffect } from "react";
import { vibrar } from "@/lib/celebrar";

const ALVO = 'button, a[href], summary, [role="button"], [role="tab"]';
/** O botão de ação (o pill escuro, o dourado): esses vibram de leve no celular. */
const PRINCIPAL = /(^|\s)bg-(pill|accent|accent-gradient)(\s|$)/;
/** Quanto tempo o "apertado" fica no mínimo: num toque rápido o dedo sai antes de a tela mostrar. */
const SEGURA_MS = 110;
/** A volta com um pulinho, como mola. */
const MOLA = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/**
 * Toque que responde (07/10/2026). A Dani: "quando as pessoas clicarem em botão, ele precisa ser
 * mais responsivo". O app já encolhia o botão no `:active`, mas no iPhone (Safari e o app da loja,
 * que usa o mesmo motor) o `:active` quase não aparece num toque rápido: o dedo sai antes da tela
 * desenhar. Aqui o aperto é desenhado por animação, fica no mínimo um instante e volta com mola;
 * os botões principais ainda vibram de leve. Um componente só, no layout, vale para o app inteiro.
 */
export function ToqueVivo() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let atual: { el: HTMLElement; desde: number; aperto: Animation; escala: number } | null = null;

    const apertar = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const el = (e.target as Element | null)?.closest?.(ALVO) as HTMLElement | null;
      if (!el || el.matches(':disabled, [aria-disabled="true"]')) return;
      // Quem já tem o próprio encolher (a barra de baixo, o "+") continua com o dele.
      if (/(^|\s)active:scale-/.test(el.className)) return;
      soltarJa();
      // Cartão largo encolhe menos: 5% num cartão da largura da tela pula demais.
      const largo = el.getBoundingClientRect().width > 260;
      const escala = el.tagName === "A" || largo ? 0.975 : 0.94;
      const aperto = el.animate([{ scale: "1" }, { scale: String(escala) }], { duration: 90, easing: "ease-out", fill: "forwards" });
      atual = { el, desde: performance.now(), aperto, escala };
      if (e.pointerType !== "mouse" && typeof el.className === "string" && PRINCIPAL.test(el.className)) vibrar("leve");
    };

    const voltar = (alvo: NonNullable<typeof atual>) => {
      alvo.aperto.cancel();
      alvo.el.animate([{ scale: String(alvo.escala) }, { scale: "1" }], { duration: 320, easing: MOLA });
    };
    const soltarJa = () => {
      if (!atual) return;
      voltar(atual);
      atual = null;
    };
    const soltar = () => {
      if (!atual) return;
      const alvo = atual;
      atual = null;
      const falta = SEGURA_MS - (performance.now() - alvo.desde);
      if (falta > 0) window.setTimeout(() => voltar(alvo), falta);
      else voltar(alvo);
    };

    document.addEventListener("pointerdown", apertar, { passive: true });
    document.addEventListener("pointerup", soltar, { passive: true });
    // Rolar a tela com o dedo em cima de um botão cancela o toque: o botão volta na hora.
    document.addEventListener("pointercancel", soltarJa, { passive: true });
    window.addEventListener("blur", soltarJa);
    return () => {
      document.removeEventListener("pointerdown", apertar);
      document.removeEventListener("pointerup", soltar);
      document.removeEventListener("pointercancel", soltarJa);
      window.removeEventListener("blur", soltarJa);
    };
  }, []);
  return null;
}
