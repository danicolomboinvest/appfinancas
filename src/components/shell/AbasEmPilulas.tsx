"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavPending } from "./nav-progress";

export type AbaEmPilula = { href: string; label: string; /** Prefixos que também acendem a aba. */ rotas?: string[] };

/**
 * Abas em pílulas que deslizam de lado, iguais às da Visão geral (AbasDaVisaoGeral), para as
 * áreas com abas próprias (a Carteira: Meus ativos, Proventos, Estratégia, Oportunidades).
 * Começam na margem esquerda; o trilho só rola quando a aba aberta sairia da tela.
 * A aba acesa é a de rota mais específica que casa ("/carteira/proventos" não acende "/carteira").
 */
export function abaAcesa(pathname: string, abas: AbaEmPilula[]): AbaEmPilula | null {
  let melhor: { aba: AbaEmPilula; tamanho: number } | null = null;
  for (const aba of abas) {
    for (const rota of aba.rotas ?? [aba.href]) {
      const casa = pathname === rota || pathname.startsWith(`${rota}/`);
      if (casa && (!melhor || rota.length > melhor.tamanho)) melhor = { aba, tamanho: rota.length };
    }
  }
  return melhor?.aba ?? null;
}

export function AbasEmPilulas({ abas, rotulo }: { abas: AbaEmPilula[]; rotulo: string }) {
  const pathname = usePathname();
  const ativa = abaAcesa(pathname, abas);
  const trilho = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});
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
    <nav aria-label={rotulo} className="-mx-5 mb-4 md:mx-0">
      <div
        ref={trilho}
        role="tablist"
        aria-label={rotulo}
        className="flex gap-1.5 overflow-x-auto px-5 py-1 [mask-image:linear-gradient(90deg,#000_86%,transparent_100%)] [scrollbar-width:none] sm:justify-center sm:[mask-image:none] md:px-0"
      >
        {abas.map((aba) => {
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
