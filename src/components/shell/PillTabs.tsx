"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type PillTab = { href: string; label: string };

/**
 * Segmented control em pílula (item 4): fundo suave, aba ativa como pílula preenchida com
 * transição suave. Mais elegante que a aba sublinhada do ModuleTabs — usado no módulo de
 * planejamento (Metas). Rolável em telas estreitas.
 */
export function PillTabs({ tabs }: { tabs: PillTab[] }) {
  const pathname = usePathname();
  const activeHref = tabs
    .filter((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="-mx-5 mb-6 overflow-x-auto px-5 md:mx-0 md:px-0">
      <div className="inline-flex gap-1 rounded-full border border-border bg-surface-2 p-1">
        {tabs.map((tab) => {
          const isActive = tab.href === activeHref;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                isActive ? "bg-ink text-canvas shadow-premium-sm" : "text-ink-muted hover:text-ink"
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
