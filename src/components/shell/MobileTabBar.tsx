"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { abasDoCelular, sectionMatches, type MobileTab } from "./nav-sections";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

/** Liga cada aba ao passo do tour de boas-vindas (WelcomeTour destaca por data-tour). */
const TAB_TOUR: Record<string, string> = {
  "/mensal": "fluxo",
  "/planejamento": "metas",
  "/carteira": "carteira",
};

/**
 * Rótulos em 12px (text-xs), não 10px: é a barra que ela usa o dia inteiro, e 10px era ilegível
 * pra quem tem vista cansada. O whitespace-nowrap segura rótulos longos da voz ("Bora
 * registrar") numa linha só: a coluna do "+" alarga um pouco e as outras cedem, sem quebrar.
 *
 * Navegação primária no mobile, barra de 5 posições no rodapé:
 * Fluxo | Metas | [ + Registrar ] | Carteira | Mais.
 * O "+" central é o ÚNICO ponto de entrada de registro (abre o RegistrarDrawer, não navega);
 * "Mais" abre a MoreSheet. Os 3 links vêm de abasDoCelular (ver nav-sections): sem a área
 * paga, a Carteira dá lugar à Visão Geral.
 */
export function MobileTabBar({
  onOpenMore,
  onOpenRegistrar,
  moreActive,
  isPremium = true,
}: {
  onOpenMore: () => void;
  onOpenRegistrar: () => void;
  moreActive: boolean;
  /** Acesso à área de investimentos. Sem ele a Carteira sai da barra (fica no "Mais", com
   * cadeado): uma aba principal que só abre um cadeado fazia quem comprou com outro e-mail
   * achar que o app era todo pago à parte. Padrão `true` = a barra de sempre. */
  isPremium?: boolean;
}) {
  const pathname = usePathname();
  const { voz } = useProfileTheme();
  const abas = abasDoCelular(isPremium);

  function tabLink(tab: MobileTab) {
    const isActive = sectionMatches(tab, pathname);
    const Icon = tab.icon;
    return (
      <Link
        key={tab.basePath}
        href={tab.href}
        data-tour={TAB_TOUR[tab.basePath]}
        aria-current={isActive ? "page" : undefined}
        className={`flex min-h-11 flex-1 flex-col items-center gap-0.5 whitespace-nowrap rounded-[20px] py-2 text-xs font-medium transition-all duration-200 active:scale-95 ${
          isActive ? "bg-tab-active-soft text-tab-active" : "text-ink-muted"
        }`}
      >
        <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} />
        {/* "Metas" vira "Missões" no Game, "Sonhos" no Manifestação; "Carteira" vira "Caixa" na Empresa.
            A aba do mês era "Fluxo" fixo, em todo tema: agora é "Meu mês", o nome que o tour usa. */}
        {tab.basePath === "/mensal"
          ? voz.titulos.navAbaMes
          : tab.basePath === "/planejamento"
            ? voz.nav.metas
            : tab.basePath === "/carteira"
              ? (voz.nav.carteira ?? tab.label)
              : tab.label}
      </Link>
    );
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="glass-pill fixed inset-x-3 z-40 flex items-stretch gap-1 rounded-full p-1.5 md:hidden"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      {tabLink(abas[0])}
      {tabLink(abas[1])}

      {/* "+" central em destaque (padrão oficial de registro): gradiente dourado + brilho ao redor
          e highlight especular no topo. O brilho é feito com box-shadow (NÃO com filter: blur) —
          filter:blur num elemento fixo faz o Safari do iPhone renderizar um retângulo escuro
          deslocado (o painel fantasma na lateral). box-shadow o iOS desenha sem esse bug. */}
      <div className="flex flex-1 flex-col items-center justify-end">
        <button
          type="button"
          onClick={onOpenRegistrar}
          aria-label={voz.titulos.registrar}
          data-tour="registrar"
          className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent-gradient text-on-accent ring-4 ring-canvas transition-transform active:scale-90"
          style={{
            boxShadow:
              "0 0 20px 2px color-mix(in srgb, var(--color-accent) 50%, transparent), inset 0 1px 1px rgba(255,255,255,0.55), inset 0 -2px 6px rgba(0,0,0,0.25)",
          }}
        >
          <Plus size={26} strokeWidth={2.4} />
        </button>
        <span className="mt-0.5 whitespace-nowrap text-xs font-medium text-ink-muted">{voz.titulos.registrar}</span>
      </div>

      {tabLink(abas[2])}

      <button
        type="button"
        onClick={onOpenMore}
        data-tour="mais"
        className={`flex min-h-11 flex-1 flex-col items-center gap-0.5 whitespace-nowrap rounded-[20px] py-2 text-xs font-medium transition-all duration-200 active:scale-95 ${
          moreActive ? "bg-tab-active-soft text-tab-active" : "text-ink-muted"
        }`}
      >
        <MoreHorizontal size={20} strokeWidth={moreActive ? 2.2 : 1.75} />
        {/* O mesmo nome do título da folha que ele abre (MoreSheet). */}
        {voz.titulos.navMais}
      </button>
    </nav>
  );
}
