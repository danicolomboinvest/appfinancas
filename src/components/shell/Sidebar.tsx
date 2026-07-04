"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Gem, LogOut } from "lucide-react";
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

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface transition-all duration-200 ease-out md:static ${
        collapsed ? "w-[76px]" : "w-64"
      } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
    >
      <div className={`flex items-center gap-2.5 px-4 pb-2 pt-5 ${collapsed ? "justify-center px-0" : ""}`}>
        <Link href="/inicio" onClick={onCloseMobile} className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-gold-strong">
            <Gem size={17} strokeWidth={1.75} />
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight text-ink">Planejamento Financeiro</span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-0.5">
          {sections.map((section) => {
            const isActive = pathname === section.basePath || pathname.startsWith(`${section.basePath}/`);
            const Icon = section.icon;
            return (
              <li key={section.basePath}>
                <Link
                  href={section.href}
                  onClick={onCloseMobile}
                  title={collapsed ? section.label : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    collapsed ? "justify-center px-0" : ""
                  } ${
                    isActive
                      ? "bg-gold-soft text-gold-strong font-medium"
                      : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} className="shrink-0" />
                  {!collapsed && <span className="truncate">{section.label}</span>}
                </Link>

                {!collapsed && isActive && section.children && (
                  <ul className="mt-0.5 flex flex-col gap-0.5 border-l border-border-strong pl-4">
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
          className={`mb-2 hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink md:flex ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          {!collapsed && <span>Recolher</span>}
        </button>

        {!collapsed && userEmail && <p className="mb-2 truncate px-3 text-xs text-ink-faint">{userEmail}</p>}

        <button
          onClick={onLogout}
          title={collapsed ? "Sair" : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <LogOut size={18} strokeWidth={1.75} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
