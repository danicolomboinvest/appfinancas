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

  // `fit`: abas dividem a largura em partes iguais e SEM rolagem horizontal (cabem todas na
  // tela). Sem `fit`, mantém o comportamento antigo (rolável em telas estreitas).
  return (
    <div className={fit ? "mb-6" : "-mx-5 mb-6 overflow-x-auto px-5 md:mx-0 md:px-0"}>
      <div className={`gap-1 rounded-full border border-border bg-surface-2 p-1 ${fit ? "flex w-full" : "inline-flex"}`}>
        {tabs.map((tab) => {
          const isActive = tab.href === activeHref;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              // No modo `fit` as abas podem ENCOLHER (min-w-0 + truncate + padding menor no
              // mobile): com 3 rótulos a soma das larguras mínimas ficava no limite dos 375px
              // e estourava em aparelhos de 320-360px.
              className={`whitespace-nowrap rounded-full py-2 text-sm font-medium transition-all duration-300 ${
                fit ? "min-w-0 flex-1 truncate px-2 text-center sm:px-4" : "px-4"
              } ${isActive ? "bg-ink text-canvas shadow-premium-sm" : "text-ink-muted hover:text-ink"}`}
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
