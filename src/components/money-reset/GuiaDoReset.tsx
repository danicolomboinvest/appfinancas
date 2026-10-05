"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { GUIAS } from "@/lib/money-reset/guias";
import { naVoz, vocabularioDaVoz } from "@/lib/money-reset/missoes";
import { EVENTO_REGISTRAR } from "@/components/shell/registrar-eventos";
import { EVENTO_DO_GUIA, gravarGuia, lerGuia, type EstadoDoGuia } from "./guia-estado";

/** Do tamanho em que a barra de baixo some e o menu ao lado aparece (o `md` do Tailwind). */
const COMPUTADOR = 768;

/**
 * O elemento que está DE FATO na tela (a tab bar do celular e a sidebar do computador têm o mesmo
 * marcador; a sidebar escondida fica fora, à esquerda). Abaixo da dobra vale: o guia rola até ele.
 */
function visivel(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4 && r.right > 0 && r.left < window.innerWidth;
}

/**
 * O guia do Money Reset (05/10/2026): o mesmo foco iluminado do tour de boas-vindas, só que nas
 * telas de verdade e atravessando telas. Acende o botão do passo; quando ela toca nele, vai pro
 * próximo (mesmo que o toque abra a gaveta ou troque de página). Nada bloqueia a tela: o escuro
 * em volta deixa o toque passar, então ela nunca fica presa no guia.
 */
export function GuiaDoReset() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const v = vocabularioDaVoz(voz);
  const [guia, setGuia] = useState<EstadoDoGuia | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Procurou e não achou o botão: o balão oferece o atalho ("Abrir para mim", "Ir direto").
  const [semAlvo, setSemAlvo] = useState(false);
  // O botão aceso pode trazer a própria frase (data-guia-txt), quando o mesmo passo cai em
  // botões diferentes conforme a tela ("Dividir" sem plano, "Ajustar as categorias" com plano).
  const [textoDoAlvo, setTextoDoAlvo] = useState<string | null>(null);
  const alvoRef = useRef<HTMLElement | null>(null);
  const rolouRef = useRef<string>("");

  useEffect(() => {
    const ler = () => setGuia(lerGuia());
    ler();
    window.addEventListener(EVENTO_DO_GUIA, ler);
    return () => window.removeEventListener(EVENTO_DO_GUIA, ler);
  }, []);

  const passos = guia ? (GUIAS[guia.dia] ?? null) : null;
  const passo = guia && passos ? (passos[guia.passo] ?? null) : null;

  // Ela está fora da tela do passo: o guia leva.
  useEffect(() => {
    if (passo?.rota && passo.ir && !pathname.startsWith(passo.rota)) router.push(passo.ir);
  }, [passo, pathname, router]);

  // Acha e mede o botão do passo. A gaveta e as telas carregam depois: procura de novo até achar.
  useEffect(() => {
    // Sem passo o guia nem desenha (o retorno lá embaixo), então não precisa limpar a medida.
    if (!passo) {
      alvoRef.current = null;
      return;
    }
    const achar = () => {
      const el = Array.from(document.querySelectorAll<HTMLElement>(passo.alvo)).find(visivel) ?? null;
      // A tela já está um passo à frente (sem plano, o Orçamento abre direto no assistente): pula.
      if (!el && guia && passos) {
        for (let j = guia.passo + 1; j < passos.length; j++) {
          if (Array.from(document.querySelectorAll<HTMLElement>(passos[j].alvo)).some(visivel)) {
            gravarGuia({ dia: guia.dia, passo: j });
            return;
          }
        }
      }
      alvoRef.current = el;
      setTextoDoAlvo(el?.dataset.guiaTxt ?? null);
      if (el && rolouRef.current !== `${guia?.dia}|${guia?.passo}`) {
        rolouRef.current = `${guia?.dia}|${guia?.passo}`;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      setRect(el ? el.getBoundingClientRect() : null);
    };
    achar();
    const id = window.setInterval(achar, 300);
    const desistiu = window.setTimeout(() => setSemAlvo(!alvoRef.current), 2000);
    window.addEventListener("resize", achar);
    window.addEventListener("scroll", achar, true);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(desistiu);
      setSemAlvo(false);
      window.removeEventListener("resize", achar);
      window.removeEventListener("scroll", achar, true);
    };
  }, [passo, pathname, guia, passos]);

  // O toque no botão aceso avança (na fase de captura: antes do botão trocar a tela).
  useEffect(() => {
    if (!guia || !passos) return;
    const aoTocar = (e: MouseEvent) => {
      const el = alvoRef.current;
      if (!el || !(e.target instanceof Node) || !el.contains(e.target)) return;
      const prox = guia.passo + 1;
      // O último passo deixa ela terminar sozinha: a tela seguinte já se explica.
      gravarGuia(prox >= passos.length ? null : { dia: guia.dia, passo: prox });
    };
    document.addEventListener("click", aoTocar, true);
    return () => document.removeEventListener("click", aoTocar, true);
  }, [guia, passos]);

  if (!guia || !passos || !passo) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 375;
  const computador = vw >= COMPUTADOR;
  // O que o balão diz bate com o que está na tela: "toque" no celular, "clique" no computador.
  const base = textoDoAlvo ?? (computador && passo.txtComputador ? passo.txtComputador : passo.txt);
  const texto = naVoz(computador ? base.replace(/\bToque\b/g, "Clique").replace(/\btoque\b/g, "clique") : base, v);
  const atalho = semAlvo && !rect && (passo.abrir || passo.ir);
  const usarAtalho = () => {
    if (passo.abrir === "registrar") window.dispatchEvent(new CustomEvent(EVENTO_REGISTRAR, { detail: { modo: "choice" } }));
    else if (passo.ir) router.push(passo.ir);
    gravarGuia(guia.passo + 1 >= passos.length ? null : { dia: guia.dia, passo: guia.passo + 1 });
  };
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const largura = Math.min(340, vw - 32);
  const pad = 8;
  let estiloBalao: React.CSSProperties;
  if (rect) {
    const left = Math.max(16, Math.min(rect.left + rect.width / 2 - largura / 2, vw - 16 - largura));
    estiloBalao = rect.top > vh / 2 ? { left, width: largura, bottom: vh - rect.top + pad + 12 } : { left, width: largura, top: rect.bottom + pad + 12 };
  } else {
    estiloBalao = { left: (vw - largura) / 2, width: largura, bottom: 120 };
  }

  return (
    <>
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[170]"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            borderRadius: passo.redondo && !computador ? 999 : 16,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.62), 0 0 0 3px var(--color-accent)",
            transition: "all 0.25s ease",
          }}
        />
      )}
      {/* position no style, como no tour: a classe glass põe position: relative e venceria o "fixed". */}
      <div role="dialog" aria-live="polite" className="glass z-[171] rounded-2xl p-4" style={{ position: "fixed", ...estiloBalao }}>
        <p className="text-sm font-semibold text-ink">{texto}</p>
        {passo.dica && <p className="mt-1 text-caption text-ink-muted">{naVoz(passo.dica, v)}</p>}
        {atalho && (
          <button type="button" onClick={usarAtalho} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent-gradient px-4 text-sm font-semibold text-on-accent">
            {passo.abrir ? t.mrAbrirParaMim : t.mrIrDireto}
          </button>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-caption font-semibold tabular-nums text-accent-strong">{t.mrPassoDe(guia.passo + 1, passos.length)}</span>
          <button type="button" onClick={() => gravarGuia(null)} className="min-h-11 px-1 text-caption font-medium text-ink-faint underline-offset-2 hover:underline">
            {t.mrSairGuia}
          </button>
        </div>
      </div>
    </>
  );
}
