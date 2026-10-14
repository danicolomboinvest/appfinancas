"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Lock, LogOut, MessageCircle, Plus, Repeat } from "lucide-react";
import { linkDoSuporte } from "@/lib/support/whatsapp-link";
import { BrandMark } from "@/components/brand/BrandMark";
import { abrirComoFunciona } from "./ComoFuncionaSheet";
import { ADMIN_NAV_SECTION, NAV_SECTIONS, MAIS_DA_EMPRESA, menuDaEmpresa, itemDaEmpresaAtivo, withNavFlags, sectionMatches, secoesVisiveis, rotuloDoMenu, type ItemDaEmpresa, type NavSection } from "./nav-sections";
import type { FerramentasDoMei } from "@/lib/empresa/legal";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { PerfilResumo } from "@/components/profiles/perfil-resumo";
import { trocarPerfilAction } from "@/app/(app)/perfis/actions";
import { useToast } from "@/components/ui/toast-context";

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
  comMoneyReset = false,
  userEmail,
  onLogout,
  onOpenRegistrar,
  openFinance,
  secoesFixas,
  perfis = [],
  nomeDaConta = null,
  ferramentasDoMei = { limite: false, impostos: false },
}: {
  /** Empresa: Limite do MEI e Impostos só entram no menu quando têm o que mostrar. */
  ferramentasDoMei?: FerramentasDoMei;
  /** Os perfis da conta: na Empresa, o "Ir para Ana, pessoal" do topo do menu. */
  perfis?: PerfilResumo[];
  nomeDaConta?: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isAdmin: boolean;
  /** Acesso à área de investimentos (curso) — sem isso, seções premium ganham um cadeado
   * no menu (o conteúdo abre igual, mas mostra o convite pra assinar em vez da tela real). */
  isPremium: boolean;
  comMoneyReset?: boolean;
  userEmail?: string;
  onLogout: () => void;
  onOpenRegistrar: () => void;
  /** Open Finance ligado no servidor (chaves da Pluggy); sem isso, "Conexões" some do menu. */
  openFinance: boolean;
  /** Menu fechado de fora (login do par: só o Nós dois). Sem o botão de registrar. */
  secoesFixas?: NavSection[];
}) {
  const pathname = usePathname();
  const { voz, empresa, casal } = useProfileTheme();
  const sections = secoesFixas ?? secoesVisiveis(withNavFlags(isAdmin ? [...NAV_SECTIONS, ADMIN_NAV_SECTION] : NAV_SECTIONS, { openFinance }), { empresa, casal, moneyReset: comMoneyReset });

  const router = useRouter();
  const { showError } = useToast();
  const [trocando, iniciarTroca] = useTransition();
  const ativo = perfis.find((p) => p.isDefault) ?? null;
  const pessoal = perfis.find((p) => p.kind === "PESSOAL") ?? null;
  const itemAtivo = empresa ? itemDaEmpresaAtivo(pathname) : null;

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
        <Link href={secoesFixas?.[0]?.href ?? "/mensal/foco"} onClick={onCloseMobile} className="flex items-center gap-3 overflow-hidden">
          <BrandMark size={32} className="shrink-0" />
          <span className={`truncate text-[17px] font-medium tracking-tight text-ink md:text-sm ${hideLabelDesktopOnly}`}>
            SPI Finance
          </span>
        </Link>
      </div>

      {/* Registro no desktop: substitui o antigo FAB flutuante. Abre o mesmo RegistrarDrawer
          usado pelo "+" central do mobile. */}
      <div className={`hidden px-3 pb-1 pt-1 ${secoesFixas ? "" : "md:block"}`}>
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

      {empresa ? (
        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label={ativo?.name ?? "Empresa"}>
          {/* O topo do menu da Empresa (protótipo aprovado): o negócio e a volta para o Pessoal. */}
          <div className={`mb-3 flex flex-col gap-2 ${hideLabelDesktopOnly}`}>
            <div className="flex items-center gap-3 px-2">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-[17px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border)]" aria-hidden>
                {(ativo?.name ?? "E").trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <b className="block truncate text-[16px] font-medium text-ink">{ativo?.name ?? "Empresa"}</b>
                <small className="text-xs text-ink-muted">Empresa</small>
              </span>
            </div>
            {pessoal && (
              <button
                type="button"
                disabled={trocando}
                onClick={() =>
                  iniciarTroca(async () => {
                    const r = await trocarPerfilAction(pessoal.id);
                    if (!r.ok) return showError(r.error);
                    onCloseMobile();
                    router.push("/mensal/foco");
                  })
                }
                className="flex min-h-11 items-center gap-2 rounded-2xl bg-surface-2 px-3 text-left text-sm text-ink-muted disabled:opacity-60"
              >
                <Repeat size={16} strokeWidth={1.7} aria-hidden />
                <span className="truncate">
                  Ir para <b className="font-medium text-ink">{(nomeDaConta ?? "você").split(" ")[0]}, {pessoal.name.toLowerCase()}</b>
                </span>
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-0.5">
            {menuDaEmpresa(ferramentasDoMei).map((item) => (
              <ItemDoMenuDaEmpresa key={item.href} item={item} on={itemAtivo?.href === item.href} collapsed={collapsedDesktopOnly} esconder={hideLabelDesktopOnly} onClick={onCloseMobile} />
            ))}
          </ul>
          <p className={`mb-1 mt-4 px-3.5 text-xs text-ink-faint ${hideLabelDesktopOnly}`}>Mais</p>
          <ul className="flex flex-col gap-0.5">
            {MAIS_DA_EMPRESA.map((item) => (
              <ItemDoMenuDaEmpresa key={item.href} item={item} on={itemAtivo?.href === item.href} collapsed={collapsedDesktopOnly} esconder={hideLabelDesktopOnly} onClick={onCloseMobile} />
            ))}
          </ul>
          <a href={linkDoSuporte("Oi! Preciso de ajuda com o SPI Finance.")} className="mt-0.5 flex min-h-12 items-center gap-3.5 rounded-2xl px-3.5 py-2 text-[16px] text-ink hover:bg-surface-2 md:hidden">
            <MessageCircle size={20} strokeWidth={1.5} className="shrink-0" />
            Fale com a gente
          </a>
        </nav>
      ) : (
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-0.5">
          {sections.map((section) => {
            const isActive = sectionMatches(section, pathname);
            const Icon = section.icon;
            // Nenhuma área abre subitens no menu (regra de 11/10/2026): as abas ficam dentro da tela.
            return (
              <li key={section.basePath}>
                <Link
                  href={section.href}
                  onClick={(e) => {
                    onCloseMobile?.();
                    // "Como funciona" abre a folha dos vídeos por cima da tela (protótipo).
                    if (section.href === "/guia") abrirComoFunciona(e);
                  }}
                  title={collapsed ? section.label : undefined}
                  data-tour={SIDEBAR_TOUR[section.basePath]}
                  className={`flex min-h-12 items-center gap-3.5 rounded-2xl px-3.5 py-2 text-[16px] transition-colors md:min-h-0 md:rounded-lg md:px-3 md:text-sm ${collapsedDesktopOnly} ${
                    isActive
                      ? "bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong),0_8px_20px_-12px_rgba(0,0,0,0.14)] md:bg-surface-2 md:shadow-none"
                      : "text-ink hover:bg-surface-2 md:text-ink-muted md:hover:text-ink"
                  }`}
                >
                  <Icon size={20} strokeWidth={1.5} className="shrink-0" />
                  <span className={`min-w-0 break-words leading-snug ${hideLabelDesktopOnly}`}>{rotuloDoMenu(section, empresa)}</span>
                  {section.premium && !isPremium && (
                    <>
                      <Lock size={13} strokeWidth={2} aria-hidden className={`ml-auto shrink-0 text-ink-faint ${hideLabelDesktopOnly}`} />
                      {/* Quem usa leitor de tela ouvia só o nome da seção, sem saber do cadeado. */}
                      <span className="sr-only">(área do curso de investimentos)</span>
                    </>
                  )}
                </Link>

              </li>
            );
          })}
        </ul>
        {/* "Fale com a gente" logo depois de Como funciona (protótipo), com o balão. */}
        <a href={linkDoSuporte("Oi! Preciso de ajuda com o SPI Finance.")} className="mt-0.5 flex min-h-12 items-center gap-3.5 rounded-2xl px-3.5 py-2 text-[16px] text-ink hover:bg-surface-2 md:hidden">
          <MessageCircle size={20} strokeWidth={1.5} className="shrink-0" />
          Fale com a gente
        </a>
      </nav>
      )}


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

function ItemDoMenuDaEmpresa({ item, on, collapsed, esconder, onClick }: { item: ItemDaEmpresa; on: boolean; collapsed: string; esconder: string; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        onClick={(e) => {
          onClick();
          if (item.href === "/guia") abrirComoFunciona(e);
        }}
        aria-current={on ? "page" : undefined}
        className={`flex min-h-12 items-center gap-3.5 rounded-2xl px-3.5 py-2 text-[16px] transition-colors md:min-h-0 md:rounded-lg md:px-3 md:text-sm ${collapsed} ${
          on ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.14)] md:bg-surface-2 md:shadow-none" : "text-ink hover:bg-surface-2 md:text-ink-muted md:hover:text-ink"
        }`}
      >
        <Icon size={20} strokeWidth={1.5} className="shrink-0" />
        {/* Quebra linha em vez de "…": "Configurações da empresa" e "Como vai a empresa" (com o
            NOVO ao lado) não cabem a 320 px nem na barra do computador. */}
        <span className={`min-w-0 break-words leading-snug ${esconder}`}>{item.label}</span>
        {item.novo && <em className={`ml-auto shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold not-italic uppercase tracking-wider text-accent-strong ${esconder}`}>novo</em>}
      </Link>
    </li>
  );
}
