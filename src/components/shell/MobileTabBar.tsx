"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { vibrar } from "@/lib/celebrar";
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
 * A barra some quando a pessoa rola para baixo e volta quando ela rola para cima (06/10/2026).
 * A Dani: "é útil, mas não precisa ser toda hora". Volta também perto do topo, no fim da página
 * (onde não há mais o que ler por trás dela) e sempre que a tela muda. Um passo pequeno de
 * rolagem não conta (tremida do dedo); o movimento acumula até passar de 8px.
 */
function useSomeAoRolar(pathname: string | null) {
  const [oculta, setOculta] = useState(false);
  // Trocou de tela: a barra volta. No render, e não num efeito, pra não piscar escondida.
  const [telaVista, setTelaVista] = useState(pathname);
  if (pathname !== telaVista) {
    setTelaVista(pathname);
    setOculta(false);
  }
  useEffect(() => {
    let ultimo = window.scrollY;
    let quadro = 0;
    const aoRolar = () => {
      if (quadro) return;
      quadro = requestAnimationFrame(() => {
        quadro = 0;
        const y = window.scrollY;
        const delta = y - ultimo;
        const noFim = window.innerHeight + y >= document.documentElement.scrollHeight - 32;
        if (y < 80 || noFim) {
          setOculta(false);
          ultimo = y;
        } else if (Math.abs(delta) > 8) {
          setOculta(delta > 0);
          ultimo = y;
        }
      });
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      window.removeEventListener("scroll", aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, []);
  return oculta;
}

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
  const oculta = useSomeAoRolar(pathname);

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
      className={`glass-pill fixed inset-x-3 z-40 flex items-stretch gap-1 rounded-full p-1.5 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-opacity md:hidden ${
        oculta ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      // Desce o bastante para sumir também o "+", que sobe 24px acima da barra.
      style={{ bottom: "calc(0.75rem + var(--safe-bottom))", transform: oculta ? "translateY(calc(100% + 2.5rem + var(--safe-bottom)))" : "none" }}
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
          onClick={() => {
            vibrar("leve");
            onOpenRegistrar();
          }}
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
