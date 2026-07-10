"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { MOBILE_TABS } from "./nav-sections";

/**
 * Navegação primária no mobile — 5 destinos sempre visíveis no rodapé, substituindo a
 * gaveta hambúrguer. "Mais" abre a MoreSheet em vez de navegar (ver AppShell).
 */
export function MobileTabBar({ onOpenMore, moreActive }: { onOpenMore: () => void; moreActive: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-surface md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {MOBILE_TABS.map((tab) => {
        const isActive = pathname === tab.basePath || pathname.startsWith(`${tab.basePath}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.basePath}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
              isActive ? "text-accent-strong" : "text-ink-muted"
            }`}
          >
            <Icon size={21} strokeWidth={isActive ? 2.1 : 1.75} />
            {tab.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOpenMore}
        className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
          moreActive ? "text-accent-strong" : "text-ink-muted"
        }`}
      >
        <MoreHorizontal size={21} strokeWidth={moreActive ? 2.1 : 1.75} />
        Mais
      </button>
    </nav>
  );
}
