"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { NavPending } from "./nav-progress";

export type ItemDoCarrossel = { chave: string; rotulo: string; href?: string };

function semMovimento(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Roleta de verdade (pedido da dona, 12/10/2026): a pílula NUNCA sai do centro. Ela é uma lente
 * parada no meio da faixa, e os nomes das abas passam por baixo dela ao arrastar. A que para no
 * centro abre, com encaixe e uma vibração leve onde o navegador deixa. As abas de rota vêm com
 * prefetch completo: a troca usa o que já está no aparelho, sem esperar o servidor.
 *
 * Faixa de abas em carrossel, "uma roleta deitada" (pedido da dona, 11/10/2026): a aba aberta fica
 * sempre no centro, em pílula; as vizinhas, menores e mais claras, aparecem pela metade nas bordas.
 * Arrastar a faixa gira a roleta e a aba que para no centro (encaixe) abre; tocar numa vizinha a
 * traz para o centro. A primeira e a última também param no centro (há espaço dos dois lados).
 * Vale para abas que são rotas (`href`) e para abas de estado (`onEscolher`).
 */
export function CarrosselDeAbas({ itens, ativa, rotulo, onEscolher, className = "" }: { itens: ItemDoCarrossel[]; ativa: string | null; rotulo: string; onEscolher?: (chave: string) => void; className?: string }) {
  const router = useRouter();
  const trilho = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const primeira = useRef(true);
  const programatico = useRef(false);
  // A lente: a aba que está passando pelo centro agora e a largura dela.
  const [noCentro, setNoCentro] = useState<string | null>(ativa);
  const [lente, setLente] = useState(0);
  const centroAnterior = useRef<string | null>(ativa);
  const medir = () => {
    const caixa = trilho.current;
    if (!caixa) return;
    const meio = caixa.scrollLeft + caixa.clientWidth / 2;
    let perto: { chave: string; d: number; w: number } | null = null;
    for (const it of itens) {
      const el = refs.current[it.chave];
      if (!el) continue;
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - meio);
      if (!perto || d < perto.d) perto = { chave: it.chave, d, w: el.offsetWidth };
    }
    if (!perto) return;
    setLente(perto.w);
    if (perto.chave !== centroAnterior.current) {
      centroAnterior.current = perto.chave;
      setNoCentro(perto.chave);
      // Um "clique" leve a cada nome que passa pela lente, só quando é o dedo que gira.
      if (!programatico.current) {
        try {
          navigator.vibrate?.(6);
        } catch {}
      }
    }
  };
  const medirRef = useRef(medir);
  useEffect(() => {
    medirRef.current = medir;
  });
  const escolher = (chave: string) => {
    if (chave === ativa) return;
    const item = itens.find((i) => i.chave === chave);
    if (onEscolher) onEscolher(chave);
    else if (item?.href) router.push(item.href, { scroll: false });
  };

  // A aba aberta vai para o centro (sem animar na primeira vez nem para quem pediu menos movimento).
  useEffect(() => {
    const el = ativa ? refs.current[ativa] : null;
    const caixa = trilho.current;
    if (!el || !caixa) return;
    const alvo = el.offsetLeft + el.offsetWidth / 2 - caixa.clientWidth / 2;
    programatico.current = true;
    caixa.scrollTo({ left: alvo, behavior: primeira.current || semMovimento() ? "auto" : "smooth" });
    primeira.current = false;
    requestAnimationFrame(() => medirRef.current());
    const t = setTimeout(() => (programatico.current = false), 450);
    return () => clearTimeout(t);
  }, [ativa]);

  // Ela girou a faixa com o dedo: quando parar, a aba do centro abre. O ouvinte é um só (sem
  // reinscrever a cada render: a lente muda o estado durante o giro, e a reinscrição apagava o
  // "parou" e a aba nunca abria). O que muda entre renders vem por referência.
  const atual = useRef({ itens, ativa, escolher });
  useEffect(() => {
    atual.current = { itens, ativa, escolher };
  });
  useEffect(() => {
    const caixa = trilho.current;
    if (!caixa) return;
    let parou: ReturnType<typeof setTimeout> | null = null;
    let quadro = 0;
    const noScroll = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => medirRef.current());
      if (parou) clearTimeout(parou);
      parou = setTimeout(() => {
        if (programatico.current) return;
        const { itens: lista, ativa: aberta, escolher: abrir } = atual.current;
        const meio = caixa.scrollLeft + caixa.clientWidth / 2;
        let perto: { chave: string; d: number } | null = null;
        for (const it of lista) {
          const el = refs.current[it.chave];
          if (!el) continue;
          const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - meio);
          if (!perto || d < perto.d) perto = { chave: it.chave, d };
        }
        if (perto && perto.chave !== aberta) abrir(perto.chave);
      }, 140);
    };
    caixa.addEventListener("scroll", noScroll, { passive: true });
    return () => {
      caixa.removeEventListener("scroll", noScroll);
      cancelAnimationFrame(quadro);
      if (parou) clearTimeout(parou);
    };
  }, []);

  const centro = noCentro ?? ativa;
  return (
    <nav aria-label={rotulo} className={`relative -mx-5 md:mx-0 ${className}`} data-roleta>
      {/* A lente parada no centro: a pílula. Os nomes passam por baixo dela. */}
      <span
        aria-hidden
        data-lente
        className="pointer-events-none absolute left-1/2 top-1/2 h-10 -translate-x-1/2 md:hidden -translate-y-1/2 rounded-full bg-pill shadow-[inset_0_0_0_1px_var(--color-border-strong),0_6px_14px_-8px_rgba(0,0,0,0.18)] transition-[width] duration-150 motion-reduce:transition-none"
        style={{ width: lente || undefined, opacity: lente ? 1 : 0 }}
      />
      <div
        ref={trilho}
        role="tablist"
        aria-label={rotulo}
        // Metade da faixa de cada lado: a primeira e a última aba também chegam ao centro. No
        // computador (13/10/2026) não tem roleta: as abas ficam paradas no centro e a pílula vai
        // na aba aberta. A lente fixa no meio da tela grande ficava fora do nome ("Resumo" torto).
        className="relative flex snap-x snap-mandatory items-center gap-1 overflow-x-auto px-[50%] py-1 [scrollbar-width:none] md:justify-center md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {itens.map((it) => {
          const on = it.chave === ativa;
          const naLente = it.chave === centro;
          const classe = `flex h-10 shrink-0 snap-center items-center whitespace-nowrap rounded-full px-4 text-[15px] transition-[color,opacity] duration-150 motion-reduce:transition-none ${
            naLente ? "font-medium text-on-pill opacity-100" : "text-ink-muted opacity-60 hover:opacity-90"
          } md:font-normal md:text-ink-muted md:opacity-70 md:hover:opacity-100 md:aria-selected:bg-pill md:aria-selected:font-medium md:aria-selected:text-on-pill md:aria-selected:opacity-100 md:aria-selected:shadow-[inset_0_0_0_1px_var(--color-border-strong),0_6px_14px_-8px_rgba(0,0,0,0.18)]`;
          const ref = (el: HTMLElement | null) => {
            refs.current[it.chave] = el;
          };
          return it.href && !onEscolher ? (
            <Link key={it.chave} href={it.href} ref={ref} role="tab" aria-selected={on} scroll={false} prefetch className={classe}>
              {it.rotulo}
              <NavPending />
            </Link>
          ) : (
            <button key={it.chave} type="button" ref={ref} role="tab" aria-selected={on} onClick={() => escolher(it.chave)} className={classe}>
              {it.rotulo}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Algo que rola de lado sozinho (carrossel, gráfico, régua, campo): ali o arrasto é dele. */
function rolaDeLado(alvo: EventTarget | null): boolean {
  for (let el = alvo as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
    if (el.dataset?.semDeslizar !== undefined || el.getAttribute?.("role") === "tablist") return true;
    const s = getComputedStyle(el);
    if ((s.overflowX === "auto" || s.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 2) return true;
  }
  return false;
}

/**
 * Arrastar o conteúdo para o lado troca de aba: o conteúdo acompanha o dedo e, passando de uns
 * 70 px, vai para a aba do lado (`onLado(-1 | 1)`); menos que isso, volta ao lugar. Nas pontas,
 * o arrasto para fora resiste.
 */
export function useArrastoEntreAbas<T extends HTMLElement>({ indice, total, onLado, chave }: { indice: number; total: number; onLado: (passo: -1 | 1) => void; chave?: string }): RefObject<T | null> {
  const caixa = useRef<T>(null);
  useEffect(() => {
    const el = caixa.current;
    if (!el || indice < 0) return;
    let gesto: { x: number; y: number; dx: number; lado: boolean | null } | null = null;
    const mover = (dx: number, animar: boolean) => {
      el.style.transition = animar && !semMovimento() ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";
      el.style.transform = dx ? `translateX(${dx}px)` : "";
    };
    // Chegou na aba nova: o conteúdo volta ao lugar.
    mover(0, false);
    const inicio = (e: TouchEvent) => {
      gesto = e.touches.length === 1 && !rolaDeLado(e.target) ? { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, lado: null } : null;
    };
    const meio = (e: TouchEvent) => {
      if (!gesto) return;
      const dx = e.touches[0].clientX - gesto.x;
      const dy = e.touches[0].clientY - gesto.y;
      if (gesto.lado === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) gesto.lado = Math.abs(dx) > Math.abs(dy) * 1.3;
      if (!gesto.lado) return;
      const semVizinha = (dx > 0 && indice === 0) || (dx < 0 && indice === total - 1);
      gesto.dx = semVizinha ? dx * 0.2 : dx * 0.6;
      mover(gesto.dx, false);
    };
    const fim = () => {
      const g = gesto;
      gesto = null;
      if (!g || !g.lado) return;
      const passo = g.dx <= -42 ? 1 : g.dx >= 42 ? -1 : 0;
      const alvo = indice + passo;
      if (passo !== 0 && alvo >= 0 && alvo < total) {
        mover(g.dx > 0 ? window.innerWidth * 0.3 : -window.innerWidth * 0.3, true);
        onLado(passo as -1 | 1);
        // Aba de estado (sem navegação): volta ao lugar logo depois.
        setTimeout(() => mover(0, false), 230);
      } else {
        mover(0, true);
      }
    };
    el.addEventListener("touchstart", inicio, { passive: true });
    el.addEventListener("touchmove", meio, { passive: true });
    el.addEventListener("touchend", fim);
    el.addEventListener("touchcancel", fim);
    return () => {
      el.removeEventListener("touchstart", inicio);
      el.removeEventListener("touchmove", meio);
      el.removeEventListener("touchend", fim);
      el.removeEventListener("touchcancel", fim);
    };
  }, [indice, total, onLado, chave]);
  return caixa;
}

/** O conteúdo de uma área com abas de rota: arrastar troca de aba (com a navegação do Next). */
export function ConteudoQueDesliza({ hrefs, indice, children }: { hrefs: string[]; indice: number; children: ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    for (const k of [indice - 1, indice + 1]) if (k >= 0 && k < hrefs.length) router.prefetch(hrefs[k]);
  }, [indice, hrefs, router]);
  const caixa = useArrastoEntreAbas<HTMLDivElement>({ indice, total: hrefs.length, chave: hrefs[indice], onLado: (p) => router.push(hrefs[indice + p], { scroll: false }) });
  return <div ref={caixa}>{children}</div>;
}
