"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                fit ? "flex-1 text-center" : ""
              } ${isActive ? "bg-ink text-canvas shadow-premium-sm" : "text-ink-muted hover:text-ink"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
