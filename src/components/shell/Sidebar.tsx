"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, LogOut, TrendingUp } from "lucide-react";
import { ADMIN_NAV_SECTION, NAV_SECTIONS } from "./nav-sections";

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  isAdmin,
  userEmail,
  onLogout,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isAdmin: boolean;
  userEmail?: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const sections = isAdmin ? [...NAV_SECTIONS, ADMIN_NAV_SECTION] : NAV_SECTIONS;

  const activeSection = sections.find(
    (section) => pathname === section.basePath || pathname.startsWith(`${section.basePath}/`),
  );

  // Expande o submenu na hora do clique (sem esperar a navegação terminar) para o
  // primeiro clique já navegar E revelar as subpáginas — evita a sensação de precisar
  // clicar duas vezes em conexões mais lentas. Sincroniza com a rota real durante a
  // renderização (em vez de um efeito), cobrindo navegação direta por URL ou pelo
  // botão voltar/avançar do navegador.
  const [prevActiveBasePath, setPrevActiveBasePath] = useState(activeSection?.basePath ?? null);
  const [expandedBasePath, setExpandedBasePath] = useState<string | null>(activeSection?.basePath ?? null);

  if ((activeSection?.basePath ?? null) !== prevActiveBasePath) {
    setPrevActiveBasePath(activeSection?.basePath ?? null);
    setExpandedBasePath(activeSection?.basePath ?? null);
  }

  // "collapsed" (ícones apenas) é uma preferência só de desktop — no mobile a gaveta
  // sempre mostra os rótulos completos, então as classes abaixo usam o prefixo md:.
  const collapsedDesktopOnly = collapsed ? "md:justify-center md:px-0" : "";
  const hideLabelDesktopOnly = collapsed ? "md:hidden" : "";

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface transition-all duration-200 ease-out md:static ${
        collapsed ? "md:w-[76px]" : "md:w-64"
      } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
    >
      <div className={`flex items-center gap-2.5 px-4 pb-2 pt-5 ${collapsedDesktopOnly}`}>
        <Link href="/inicio" onClick={onCloseMobile} className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-gold-strong">
            <TrendingUp size={17} strokeWidth={1.75} />
          </span>
          <span className={`truncate text-sm font-semibold tracking-tight text-ink ${hideLabelDesktopOnly}`}>
            Planejamento Financeiro
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-0.5">
          {sections.map((section) => {
            const isActive = pathname === section.basePath || pathname.startsWith(`${section.basePath}/`);
            const isExpanded = expandedBasePath === section.basePath;
            const Icon = section.icon;
            return (
              <li key={section.basePath}>
                <Link
                  href={section.href}
                  onClick={() => {
                    setExpandedBasePath(section.basePath);
                    onCloseMobile();
                  }}
                  title={collapsed ? section.label : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${collapsedDesktopOnly} ${
                    isActive
                      ? "bg-gold-soft text-gold-strong font-medium"
                      : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} className="shrink-0" />
                  <span className={`truncate ${hideLabelDesktopOnly}`}>{section.label}</span>
                </Link>

                {isExpanded && section.children && (
                  <ul className={`mt-0.5 flex flex-col gap-0.5 border-l border-border-strong pl-4 ${hideLabelDesktopOnly}`}>
                    {section.children.map((child) => {
                      const childActive = pathname === child.href;
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={onCloseMobile}
                            className={`block truncate rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                              childActive ? "text-gold-strong font-medium" : "text-ink-faint hover:text-ink"
                            }`}
                          >
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={onToggleCollapsed}
          className={`mb-2 hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink md:flex ${collapsedDesktopOnly}`}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          <span className={hideLabelDesktopOnly}>Recolher</span>
        </button>

        {userEmail && <p className={`mb-2 truncate px-3 text-xs text-ink-faint ${hideLabelDesktopOnly}`}>{userEmail}</p>}

        <button
          onClick={onLogout}
          title={collapsed ? "Sair" : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger ${collapsedDesktopOnly}`}
        >
          <LogOut size={18} strokeWidth={1.75} />
          <span className={hideLabelDesktopOnly}>Sair</span>
        </button>
      </div>
    </aside>
  );
}
