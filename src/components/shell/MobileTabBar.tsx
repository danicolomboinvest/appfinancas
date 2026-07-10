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
      className="fixed inset-x-3 z-40 flex items-stretch gap-1 rounded-[28px] border border-border/60 bg-surface/75 p-1.5 shadow-premium backdrop-blur-xl md:hidden"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      {MOBILE_TABS.map((tab) => {
        const isActive = pathname === tab.basePath || pathname.startsWith(`${tab.basePath}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.basePath}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-[20px] py-2 text-[10px] font-medium transition-all duration-200 active:scale-95 ${
              isActive ? "bg-accent-soft text-accent-strong" : "text-ink-muted"
            }`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} />
            {tab.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOpenMore}
        className={`flex flex-1 flex-col items-center gap-0.5 rounded-[20px] py-2 text-[10px] font-medium transition-all duration-200 active:scale-95 ${
          moreActive ? "bg-accent-soft text-accent-strong" : "text-ink-muted"
        }`}
      >
        <MoreHorizontal size={20} strokeWidth={moreActive ? 2.2 : 1.75} />
        Mais
      </button>
    </nav>
  );
}
