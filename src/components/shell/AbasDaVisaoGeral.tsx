"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ABAS_DA_VISAO_GERAL, abaAtiva } from "./flow-tabs";
import { NavPending } from "./nav-progress";

/**
 * As quatro abas da Visão geral (Resumo, Orçamento, Transações, Recorrentes) em pílulas que
 * deslizam de lado: começam na margem esquerda, a aberta fica numa pílula clara e o trilho só rola
 * quando a aberta sairia da tela (11/10/2026: antes começavam no meio, com um vazio à esquerda e a
 * última cortada). Em tela larga cabem todas e nada rola.
 */
export function AbasDaVisaoGeral() {
  const pathname = usePathname();
  const ativa = abaAtiva(pathname);
  const trilho = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});

  // Rola só o necessário para a aba aberta aparecer inteira (sem animar na primeira vez).
  const primeira = useRef(true);
  useEffect(() => {
    const el = ativa ? refs.current[ativa.href] : null;
    const caixa = trilho.current;
    if (!el || !caixa) return;
    const fim = el.offsetLeft + el.offsetWidth + 20 - caixa.clientWidth;
    const inicio = el.offsetLeft - 20;
    const alvo = caixa.scrollLeft > inicio ? Math.max(0, inicio) : caixa.scrollLeft < fim ? fim : caixa.scrollLeft;
    caixa.scrollTo({ left: alvo, behavior: primeira.current ? "auto" : "smooth" });
    primeira.current = false;
  }, [ativa]);

  return (
    <nav aria-label="Abas da Visão geral" className="-mx-5 mb-4 md:mx-0" data-tour="fluxo">
      <div
        ref={trilho}
        role="tablist"
        aria-label="Visão geral"
        className="flex gap-1.5 overflow-x-auto px-5 py-1 [mask-image:linear-gradient(90deg,#000_86%,transparent_100%)] [scrollbar-width:none] sm:justify-center sm:[mask-image:none] md:px-0"
      >
        {ABAS_DA_VISAO_GERAL.map((aba) => {
          const on = aba.href === ativa?.href;
          return (
            <Link
              key={aba.href}
              href={aba.href}
              ref={(el) => {
                refs.current[aba.href] = el;
              }}
              role="tab"
              aria-selected={on}
              className={`flex h-10 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[15px] transition-colors ${
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
