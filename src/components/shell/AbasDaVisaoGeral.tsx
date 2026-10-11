"use client";

import { Suspense, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { hrefDoMes, periodoDaRota, type AbaComMes } from "@/lib/visao-geral/periodo";
import { ABAS_DA_VISAO_GERAL, abaAtiva } from "./flow-tabs";
import { NavPending } from "./nav-progress";
import { SeletorDeMes } from "./SeletorDeMes";

const ABA_COM_MES: Record<string, AbaComMes | undefined> = { "/mensal/foco": "resumo", "/orcamento": "orcamento", "/mensal": "transacoes" };

/** O endereço de cada aba, levando o mês escolhido (Recorrentes não tem mês). */
function useHrefsDasAbas(): string[] {
  const caminho = usePathname();
  const busca = useSearchParams();
  const agora = nowInBrazil();
  const periodo = periodoDaRota(caminho, busca.get("mes"), agora);
  return ABAS_DA_VISAO_GERAL.map((aba) => {
    const comMes = ABA_COM_MES[aba.href];
    return periodo && comMes ? hrefDoMes(comMes, periodo.mes, agora) : aba.href;
  });
}

/**
 * As quatro abas da Visão geral (Resumo, Orçamento, Transações, Recorrentes) em pílulas que
 * deslizam de lado, e embaixo delas o seletor de mês (protótipo aprovado). A pílula aberta rola
 * para o meio quando troca; tocar perto da borda mostra a próxima inteira ("Recorrentes" não fica
 * mais cortado sem jeito de chegar nele).
 */
export function AbasDaVisaoGeral() {
  return (
    <Suspense fallback={<AbasSemMes />}>
      <AbasComMes />
    </Suspense>
  );
}

function AbasSemMes() {
  return <Pilulas hrefs={ABAS_DA_VISAO_GERAL.map((a) => a.href)} />;
}

function AbasComMes() {
  const hrefs = useHrefsDasAbas();
  return (
    <>
      <Pilulas hrefs={hrefs} />
      <SeletorDeMes />
    </>
  );
}

function Pilulas({ hrefs }: { hrefs: string[] }) {
  const pathname = usePathname();
  const ativa = abaAtiva(pathname);
  const trilho = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});

  // A pílula aberta vai para o meio do trilho (como as abas do protótipo), sem animar na 1ª vez.
  const primeira = useRef(true);
  useEffect(() => {
    const el = ativa ? refs.current[ativa.href] : null;
    const caixa = trilho.current;
    if (!el || !caixa) return;
    const alvo = el.offsetLeft - (caixa.clientWidth - el.offsetWidth) / 2;
    caixa.scrollTo({ left: Math.max(0, alvo), behavior: primeira.current ? "auto" : "smooth" });
    primeira.current = false;
  }, [ativa]);

  return (
    <nav aria-label="Abas da Visão geral" className="-mx-5 mb-4 md:mx-0" data-tour="fluxo">
      <div
        ref={trilho}
        role="tablist"
        aria-label="Visão geral"
        className="flex snap-x gap-1.5 overflow-x-auto scroll-px-5 px-5 py-1 [scrollbar-width:none] sm:justify-center md:px-0"
      >
        {ABAS_DA_VISAO_GERAL.map((aba, i) => {
          const on = aba.href === ativa?.href;
          return (
            <Link
              key={aba.href}
              href={hrefs[i]}
              ref={(el) => {
                refs.current[aba.href] = el;
              }}
              role="tab"
              aria-selected={on}
              scroll={false}
              className={`flex h-10 shrink-0 snap-start items-center whitespace-nowrap rounded-full px-4 text-[15px] transition-colors ${
                on ? "bg-pill font-medium text-on-pill shadow-[inset_0_0_0_1px_var(--color-border-strong),0_6px_14px_-8px_rgba(0,0,0,0.18)]" : "text-ink-muted hover:text-ink"
              }`}
            >
              {aba.label}
              <NavPending />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Algo que rola de lado sozinho (carrossel, gráfico, régua): ali o arrasto é dele, não das abas. */
function rolaDeLado(alvo: EventTarget | null): boolean {
  for (let el = alvo as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
    if (el.dataset?.semDeslizar !== undefined) return true;
    const s = getComputedStyle(el);
    if ((s.overflowX === "auto" || s.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 2) return true;
  }
  return false;
}

/**
 * Arrastar o conteúdo para o lado troca de aba (protótipo: o painel acompanha o dedo). Uns 70 px
 * de dedo levam para a aba do lado, com o mesmo mês; menos que isso, volta ao lugar.
 */
export function DeslizarEntreAbas({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <Deslizar>{children}</Deslizar>
    </Suspense>
  );
}

function Deslizar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hrefs = useHrefsDasAbas();
  const ativa = abaAtiva(pathname);
  const i = ativa ? ABAS_DA_VISAO_GERAL.findIndex((a) => a.href === ativa.href) : -1;
  const caixa = useRef<HTMLDivElement>(null);
  const gesto = useRef<{ x: number; y: number; dx: number; lado: boolean | null } | null>(null);

  useEffect(() => {
    if (i < 0) return;
    // Deixa as abas do lado prontas, para a troca no arrasto ser imediata.
    for (const k of [i - 1, i + 1]) if (k >= 0 && k < hrefs.length) router.prefetch(hrefs[k]);
  }, [i, hrefs, router]);

  useEffect(() => {
    const el = caixa.current;
    if (!el || i < 0) return;
    const mover = (dx: number, animar: boolean) => {
      el.style.transition = animar ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";
      el.style.transform = dx ? `translateX(${dx}px)` : "";
    };
    const inicio = (e: TouchEvent) => {
      if (e.touches.length !== 1 || rolaDeLado(e.target)) {
        gesto.current = null;
        return;
      }
      gesto.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, lado: null };
    };
    const meio = (e: TouchEvent) => {
      const g = gesto.current;
      if (!g) return;
      const dx = e.touches[0].clientX - g.x;
      const dy = e.touches[0].clientY - g.y;
      if (g.lado === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) g.lado = Math.abs(dx) > Math.abs(dy) * 1.3;
      if (!g.lado) return;
      // Na primeira e na última aba o arrasto para fora resiste.
      const semVizinha = (dx > 0 && i === 0) || (dx < 0 && i === ABAS_DA_VISAO_GERAL.length - 1);
      g.dx = semVizinha ? dx * 0.2 : dx * 0.6;
      mover(g.dx, false);
    };
    const fim = () => {
      const g = gesto.current;
      gesto.current = null;
      if (!g || !g.lado) return;
      const alvo = g.dx <= -42 ? i + 1 : g.dx >= 42 ? i - 1 : i;
      if (alvo !== i && alvo >= 0 && alvo < hrefs.length) {
        mover(g.dx > 0 ? window.innerWidth * 0.3 : -window.innerWidth * 0.3, true);
        router.push(hrefs[alvo], { scroll: false });
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
  }, [i, hrefs, router]);

  // Chegou na aba nova: o conteúdo volta ao lugar.
  useEffect(() => {
    const el = caixa.current;
    if (el) {
      el.style.transition = "none";
      el.style.transform = "";
    }
  }, [pathname]);

  return (
    <div ref={caixa}>
      {children}
    </div>
  );
}
