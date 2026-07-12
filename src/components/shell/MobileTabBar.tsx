"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { MOBILE_TABS } from "./nav-sections";

/**
 * Navegação primária no mobile — barra de 5 posições no rodapé:
 * Fluxo | Metas | [ + Registrar ] | Carteira | Mais.
 * O "+" central é o ÚNICO ponto de entrada de registro (abre o RegistrarDrawer, não navega);
 * "Mais" abre a MoreSheet. Os 3 links vêm de MOBILE_TABS (ver nav-sections).
 */
export function MobileTabBar({
  onOpenMore,
  onOpenRegistrar,
  moreActive,
}: {
  onOpenMore: () => void;
  onOpenRegistrar: () => void;
  moreActive: boolean;
}) {
  const pathname = usePathname();

  function tabLink(tab: (typeof MOBILE_TABS)[number]) {
    const isActive = pathname === tab.basePath || pathname.startsWith(`${tab.basePath}/`);
    const Icon = tab.icon;
    return (
      <Link
        key={tab.basePath}
        href={tab.href}
        className={`flex flex-1 flex-col items-center gap-0.5 rounded-[20px] py-2 text-[10px] font-medium transition-all duration-200 active:scale-95 ${
          isActive ? "bg-surface-2 text-ink" : "text-ink-muted"
        }`}
      >
        <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} />
        {tab.label}
      </Link>
    );
  }

  return (
    <nav
      className="fixed inset-x-3 z-40 flex items-stretch gap-1 rounded-[28px] border border-border/60 bg-surface/75 p-1.5 shadow-premium backdrop-blur-xl md:hidden"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      {tabLink(MOBILE_TABS[0])}
      {tabLink(MOBILE_TABS[1])}

      {/* "+" central em destaque (padrão FAB, Nubank/Mobills) — elevado acima da barra. */}
      <div className="flex flex-1 flex-col items-center justify-end">
        <button
          type="button"
          onClick={onOpenRegistrar}
          aria-label="Registrar"
          className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-canvas shadow-premium ring-4 ring-canvas transition-transform active:scale-90"
        >
          <Plus size={26} strokeWidth={2.4} />
        </button>
        <span className="mt-0.5 text-[10px] font-medium text-ink-muted">Registrar</span>
      </div>

      {tabLink(MOBILE_TABS[2])}

      <button
        type="button"
        onClick={onOpenMore}
        className={`flex flex-1 flex-col items-center gap-0.5 rounded-[20px] py-2 text-[10px] font-medium transition-all duration-200 active:scale-95 ${
          moreActive ? "bg-surface-2 text-ink" : "text-ink-muted"
        }`}
      >
        <MoreHorizontal size={20} strokeWidth={moreActive ? 2.2 : 1.75} />
        Mais
      </button>
    </nav>
  );
}
