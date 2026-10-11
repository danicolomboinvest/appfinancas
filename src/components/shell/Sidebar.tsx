"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Lock, LogOut, MessageCircleQuestion, Plus } from "lucide-react";
import { linkDoSuporte } from "@/lib/support/whatsapp-link";
import { BrandMark } from "@/components/brand/BrandMark";
import { ADMIN_NAV_SECTION, NAV_SECTIONS, withNavFlags, sectionMatches, filhosVisiveis, secoesVisiveis, rotuloDoMenu } from "./nav-sections";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

/** Liga cada seção ao passo do tour de boas-vindas (WelcomeTour destaca por data-tour). */
const SIDEBAR_TOUR: Record<string, string> = {
  "/mensal": "fluxo",
  "/planejamento": "metas",
  "/carteira": "carteira",
};

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  isAdmin,
  isPremium,
  userEmail,
  onLogout,
  onOpenRegistrar,
  openFinance,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isAdmin: boolean;
  /** Acesso à área de investimentos (curso) — sem isso, seções premium ganham um cadeado
   * no menu (o conteúdo abre igual, mas mostra o convite pra assinar em vez da tela real). */
  isPremium: boolean;
  userEmail?: string;
  onLogout: () => void;
  onOpenRegistrar: () => void;
  /** Open Finance ligado no servidor (chaves da Pluggy); sem isso, "Conexões" some do menu. */
  openFinance: boolean;
}) {
  const pathname = usePathname();
  const { voz, empresa, casal } = useProfileTheme();
  const sections = secoesVisiveis(withNavFlags(isAdmin ? [...NAV_SECTIONS, ADMIN_NAV_SECTION] : NAV_SECTIONS, { openFinance }), { empresa, casal });

  const activeSection = sections.find(
    (section) => sectionMatches(section, pathname),
  );

  // Expande o submenu na hora do clique (sem esperar a navegação terminar) para o
  // primeiro clique já navegar E revelar as subpáginas, evita a sensação de precisar
  // clicar duas vezes em conexões mais lentas. Sincroniza com a rota real durante a
  // renderização (em vez de um efeito), cobrindo navegação direta por URL ou pelo
  // botão voltar/avançar do navegador.
  const [prevActiveBasePath, setPrevActiveBasePath] = useState(activeSection?.basePath ?? null);
  const [expandedBasePath, setExpandedBasePath] = useState<string | null>(activeSection?.basePath ?? null);

  if ((activeSection?.basePath ?? null) !== prevActiveBasePath) {
    setPrevActiveBasePath(activeSection?.basePath ?? null);
    setExpandedBasePath(activeSection?.basePath ?? null);
  }

  // "collapsed" (ícones apenas) é uma preferência só de desktop, no mobile a gaveta
  // sempre mostra os rótulos completos, então as classes abaixo usam o prefixo md:.
  const collapsedDesktopOnly = collapsed ? "md:justify-center md:px-0" : "";
  const hideLabelDesktopOnly = collapsed ? "md:hidden" : "";

  return (
    <aside
      aria-label="Menu"
      className={`fixed inset-y-0 left-0 z-[70] flex w-[min(19rem,82vw)] flex-col rounded-r-[28px] border-r border-border bg-canvas pt-[var(--safe-top)] transition-all duration-200 ease-out md:static md:z-auto md:rounded-none md:bg-surface md:pt-0 ${
        collapsed ? "md:w-[76px]" : "md:w-64"
      } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
    >
      <div className={`flex items-center gap-2.5 px-4 pb-2 pt-5 ${collapsedDesktopOnly}`}>
        <Link href="/mensal/foco" onClick={onCloseMobile} className="flex items-center gap-3 overflow-hidden">
          <BrandMark size={32} className="shrink-0" />
          <span className={`truncate text-[17px] font-medium tracking-tight text-ink md:text-sm ${hideLabelDesktopOnly}`}>
            SPI Finance
          </span>
        </Link>
      </div>

      {/* Registro no desktop: substitui o antigo FAB flutuante. Abre o mesmo RegistrarDrawer
          usado pelo "+" central do mobile. */}
      <div className="hidden px-3 pb-1 pt-1 md:block">
        <button
          type="button"
          onClick={onOpenRegistrar}
          title={collapsed ? voz.titulos.registrar : undefined}
          data-tour="registrar"
          className={`flex w-full items-center gap-3 rounded-lg bg-pill px-3 py-2.5 text-sm font-medium text-on-pill transition-opacity hover:opacity-90 active:scale-[0.98] ${collapsedDesktopOnly}`}
        >
          <Plus size={18} strokeWidth={2.2} className="shrink-0" />
          <span className={`truncate ${hideLabelDesktopOnly}`}>{voz.titulos.registrar}</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-0.5">
          {sections.map((section) => {
            const isActive = sectionMatches(section, pathname);
            const isExpanded = expandedBasePath === section.basePath;
            const Icon = section.icon;
            const filhos = filhosVisiveis(section, empresa);
            return (
              <li key={section.basePath}>
                <Link
                  href={section.href}
                  onClick={() => {
                    setExpandedBasePath(section.basePath);
                    onCloseMobile();
                  }}
                  title={collapsed ? section.label : undefined}
                  data-tour={SIDEBAR_TOUR[section.basePath]}
                  className={`flex min-h-12 items-center gap-3.5 rounded-2xl px-3.5 py-2 text-[16px] transition-colors md:min-h-0 md:rounded-lg md:px-3 md:text-sm ${collapsedDesktopOnly} ${
                    isActive
                      ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.14)] md:bg-surface-2 md:shadow-none"
                      : "text-ink hover:bg-surface-2 md:text-ink-muted md:hover:text-ink"
                  }`}
                >
                  <Icon size={20} strokeWidth={1.5} className="shrink-0" />
                  <span className={`truncate ${hideLabelDesktopOnly}`}>{rotuloDoMenu(section, empresa)}</span>
                  {section.premium && !isPremium && (
                    <>
                      <Lock size={13} strokeWidth={2} aria-hidden className={`ml-auto shrink-0 text-ink-faint ${hideLabelDesktopOnly}`} />
                      {/* Quem usa leitor de tela ouvia só o nome da seção, sem saber do cadeado. */}
                      <span className="sr-only">(área do curso de investimentos)</span>
                    </>
                  )}
                </Link>

                {isExpanded && filhos.length > 0 && (
                  <ul className={`mt-0.5 flex flex-col gap-0.5 border-l border-border-strong pl-4 ${hideLabelDesktopOnly}`}>
                    {filhos.map((child) => {
                      const childActive = pathname === child.href;
                      const locked = child.premium && !isPremium;
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={onCloseMobile}
                            className={`flex items-center gap-1.5 truncate rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                              childActive ? "text-ink font-medium" : "text-ink-faint hover:text-ink"
                            }`}
                          >
                            <span className="truncate">{child.label}</span>
                            {locked && (
                              <>
                                <Lock size={11} strokeWidth={2} aria-hidden className="shrink-0" />
                                <span className="sr-only">(área do curso de investimentos)</span>
                              </>
                            )}
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

      {/* No celular, o fim da gaveta: falar com a gente (a conta e o Sair moram na foto). */}
      <div className="px-3 pb-[calc(1rem+var(--safe-bottom))] md:hidden">
        <a href={linkDoSuporte("Oi! Preciso de ajuda com o SPI Finance.")} className="flex min-h-12 items-center gap-3.5 rounded-2xl px-3.5 py-2 text-[16px] text-ink hover:bg-surface-2">
          <MessageCircleQuestion size={20} strokeWidth={1.5} className="shrink-0" />
          Fale com a gente
        </a>
      </div>

      <div className="hidden border-t border-border p-3 md:block">
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
