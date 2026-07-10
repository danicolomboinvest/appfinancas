"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ModuleTab = { href: string; label: string };

/**
 * Sub-navegação de um módulo (Fluxo, Carteira, Planejamento, Orçamento) em abas horizontais
 * sempre visíveis no topo — substitui a lista de sub-páginas que antes só aparecia dentro da
 * gaveta lateral. Rolável em telas estreitas (`overflow-x-auto`).
 */
export function ModuleTabs({ tabs }: { tabs: ModuleTab[] }) {
  const pathname = usePathname();

  // Escolhe o href mais específico (mais longo) entre os que combinam com a rota atual —
  // evita que "/carteira" e "/carteira/estrategia" fiquem ativos ao mesmo tempo.
  const activeHref = tabs
    .filter((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="-mx-5 mb-6 overflow-x-auto border-b border-border px-5 md:mx-0 md:px-0">
      <div className="flex w-max gap-1 md:w-full">
        {tabs.map((tab) => {
          const isActive = tab.href === activeHref;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
