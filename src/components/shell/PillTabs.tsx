"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavPending } from "./nav-progress";

export type PillTab = { href: string; label: string };

/**
 * Segmented control em pílula: fundo suave, aba ativa como pílula preenchida com transição
 * suave. É o padrão de sub-navegação de TODOS os módulos (Fluxo, Metas, Carteira, Análises) —
 * substituiu a antiga aba sublinhada. Rolável em telas estreitas (`overflow-x-auto`).
 */
export function PillTabs({ tabs, fit = false }: { tabs: PillTab[]; fit?: boolean }) {
  const pathname = usePathname();
  const activeHref = tabs
    .filter((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // `fit`: abas ocupam a largura toda; quando os nomes não cabem (celular de 320px), o trilho
  // rola de lado em vez de cortar o nome com reticências (versão nova: nada cortado).
  return (
    <div className="-mx-5 mb-6 overflow-x-auto px-5 md:mx-0 md:px-0">
      <div className={`gap-1 rounded-full border border-border bg-surface-2 p-1 ${fit ? "flex w-max min-w-full" : "inline-flex"}`}>
        {tabs.map((tab) => {
          const isActive = tab.href === activeHref;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              // No modo `fit` as abas podem ENCOLHER (min-w-0 + truncate + padding menor no
              // mobile): com 3 rótulos a soma das larguras mínimas ficava no limite dos 375px
              // e estourava em aparelhos de 320-360px.
              // py-3 no celular: 20px de linha + 24px = 44px de alvo de toque, o mínimo pra quem
              // tem dedo menos certeiro. No computador, com mouse, volta ao py-2 de antes.
              className={`whitespace-nowrap rounded-full py-3 text-sm font-medium transition-all duration-300 md:py-2 ${
                // flex-auto (e não flex-1): cada aba cresce a partir da largura do próprio nome,
                // então "Foco" cede espaço pra "Visão mensal" em vez de todas terem o mesmo tamanho.
                // Celular bem estreito (320–359px): letra e respiro um tico menores, pra quatro
                // nomes caberem inteiros em vez de virarem "Foco ...".
                fit ? "shrink-0 flex-auto px-3 text-center sm:px-4" : "px-4"
              } ${isActive ? "bg-pill text-on-pill shadow-premium-sm" : "text-ink-muted hover:text-ink"}`}
            >
              {tab.label}
              <NavPending />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
