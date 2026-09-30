"use client";

import type { ProfileKind } from "@prisma/client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { PillTabs } from "./PillTabs";
import { NavProgressProvider } from "./nav-progress";
import { FLOW_TABS, ehRotaDoFluxo } from "./flow-tabs";
import { MobileTabBar } from "./MobileTabBar";
import { MoreSheet } from "./MoreSheet";
import { GreetingStrip } from "./GreetingStrip";
import { ThemeQuickToggle } from "./ThemeQuickToggle";
import { RegistrarDrawer } from "./RegistrarDrawer";
import { modoPedidoNoEvento, EVENTO_IMPORTAR, EVENTO_REGISTRAR, type ModoDoRegistrar } from "./registrar-eventos";
import { ProfileSwitcher, type PerfilResumo } from "@/components/profiles/ProfileSwitcher";
import { WelcomeTour } from "./WelcomeTour";
import { InstallAppBanner } from "./InstallAppBanner";
import { InstallAppSheet } from "./InstallAppSheet";
import { UsageTracker } from "./UsageTracker";
import { secoesDoMais, sectionMatches } from "./nav-sections";
import { logoutAction } from "@/lib/auth/actions";
import { desinscreverAvisosDesteAparelho } from "@/lib/push/aparelho";
import { ToastProvider } from "@/components/ui/toast-context";
import { ProfileThemeProvider, useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

export function AppShell({
  children,
  isAdmin,
  isPremium,
  userEmail,
  greeting,
  dateLabel,
  theme,
  openFinance,
  perfis = [],
  profileTheme,
  profileKind = "PESSOAL",
  podeEscolherModo,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
  isPremium: boolean;
  userEmail?: string;
  /** Já na voz do tema. `null` quando o tema não cumprimenta (Game). */
  greeting: string | null;
  /** A linha abaixo da saudação: a data, ou o que o tema quiser dizer no lugar dela. */
  dateLabel: string;
  /** Chave do tema do perfil ativo — a voz das abas e da barra de baixo sai dele. */
  profileTheme: string;
  /** Tipo do perfil ativo. Empresa troca o vocabulário e esconde o que é de pessoa física. */
  profileKind?: ProfileKind;
  /** O tema deixa a pessoa escolher claro/escuro? Só o Padrão. Nos outros o sol/lua some. */
  podeEscolherModo: boolean;
  /** Tema salvo na conta — a chave clara/escura do menu "Mais" nasce com ele. */
  theme: "dark" | "light";
  /** Open Finance ligado no servidor (chaves da Pluggy na Vercel). Desligado, as entradas
   * "Conexões" não aparece — o código vai junto no deploy, mas fica
   * invisível até a Dani decidir ligar. */
  openFinance: boolean;
  perfis?: PerfilResumo[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [registrarOpen, setRegistrarOpen] = useState(false);
  // Em que tela a gaveta abre: o "+" abre na escolha; um botão "Importar extrato" de dentro de
  // uma tela abre direto na importação, sem fazer a pessoa escolher de novo o que já tocou.
  const [modoDoRegistrar, setModoDoRegistrar] = useState<ModoDoRegistrar>("choice");
  const abrirRegistrar = useCallback((modo: ModoDoRegistrar = "choice") => {
    setModoDoRegistrar(modo);
    setRegistrarOpen(true);
  }, []);
  const [, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  // Um link de dentro da gaveta do Registrar (o "Ler o manual" da importação) muda de tela:
  // a gaveta fecha junto, senão a página nova abria escondida atrás dela.
  const [pathDaGaveta, setPathDaGaveta] = useState(pathname);
  if (pathname !== pathDaGaveta) {
    setPathDaGaveta(pathname);
    setRegistrarOpen(false);
  }

  // O perfil ativo é da CONTA, não da aba: trocar pra Empresa no computador vale também no
  // celular. Uma tela que ficou aberta no Pessoal continuava mostrando o Pessoal e gravava na
  // Empresa. Ao voltar pra aba (ou pro app) depois de um tempo fora, a tela é recarregada do
  // servidor — se o perfil mudou, ela remonta no perfil certo antes de ela lançar algo.
  useEffect(() => {
    let escondidaDesde = 0;
    function aoMudarVisibilidade() {
      if (document.visibilityState === "hidden") {
        escondidaDesde = Date.now();
        return;
      }
      if (escondidaDesde && Date.now() - escondidaDesde > 30_000) router.refresh();
      escondidaDesde = 0;
    }
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }, [router]);

  useEffect(() => {
    // Lido só depois de montar (não na inicialização do estado) para o HTML do
    // primeiro render no cliente bater com o do servidor e evitar erro de hidratação.
    const stored = window.localStorage.getItem("sidebar-collapsed");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage, uma API externa ao React
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  function handleLogout() {
    startTransition(async () => {
      // Desliga os avisos deste aparelho antes de sair: quem entrar depois aqui não pode receber
      // os avisos (com valores) da conta que saiu. Pra voltar a receber, é ligar de novo.
      await logoutAction(await desinscreverAvisosDesteAparelho());
    });
  }

  /**
   * O Fluxo é UM módulo com três abas (Visão mensal, Só gastos, Orçamento), mesmo morando em
   * duas pastas de rota diferentes. A saudação e as abas moram AQUI, no shell que sobrevive a
   * toda navegação, e não em dois layouts irmãos.
   *
   * Com um layout em cada pasta, ir do Orçamento pra Visão mensal desmontava um e montava o
   * outro: a saudação sumia e a pílula das abas recomeçava a transição do zero, enquanto entre
   * "Visão mensal" e "Só gastos" ela deslizava. A mesma barra de abas, visualmente, se
   * comportava de dois jeitos dependendo de qual aba você clicava.
   */
  const isFlow = ehRotaDoFluxo(pathname);
  const showGreeting = isFlow;

  // "Mais" fica em destaque na tab bar quando a rota atual é uma das seções que só
  // existem dentro da sheet (Visão Geral, Simuladores, Análises, Configurações). A lista muda
  // com o acesso (sem a área paga, a Carteira vai pro "Mais"): tem que ser a MESMA da barra,
  // senão a aba e o "Mais" acendem juntos.
  const moreActive = secoesDoMais(isPremium).some(
    (section) => sectionMatches(section, pathname),
  );

  return (
    <ToastProvider>
      <ProfileThemeProvider theme={profileTheme} kind={profileKind} profileId={perfis.find((p) => p.isDefault)?.id ?? null}>
      <NavProgressProvider>
      <div className="flex min-h-screen">
        {/* Sidebar: navegação primária no desktop; no mobile fica sempre fora da tela
            (a gaveta hambúrguer foi substituída pela tab bar + MoreSheet abaixo). */}
        <RegistrarOpener onOpen={abrirRegistrar} />
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={false}
          onCloseMobile={() => {}}
          isAdmin={isAdmin}
          isPremium={isPremium}
          userEmail={userEmail}
          onLogout={handleLogout}
          onOpenRegistrar={() => abrirRegistrar()}
          openFinance={openFinance}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Margens de segurança do iPhone (o app é viewport-fit=cover, vai até as bordas):
              - pt: sem env(safe-area-inset-top) o conteúdo (ex.: "Bom dia") fica embaixo do
                relógio/câmera no modo standalone. Com o inset, começa abaixo da status bar.
              - pb: limpa a tab bar flutuante (home indicator) + o botão "+" elevado. */}
          <main className="flex-1 px-5 pb-[calc(7.5rem_+_env(safe-area-inset-bottom))] pt-[calc(1.5rem_+_env(safe-area-inset-top))] md:px-10 md:pb-8 md:pt-8">
            <div className="mx-auto w-full max-w-6xl">
              {/* Sol/lua no alto de TODA tela — a saudação só existe no Fluxo, então prender
                  o botão nela o faria sumir em Metas, Carteira e Orçamento. */}
              {/* O perfil ativo fica no alto de TODA tela, ao lado do sol/lua: lançar um gasto
                  no perfil errado é o erro mais caro que este recurso pode causar, então ele
                  não pode viver escondido dentro de um menu. */}
              <div className="mb-1 flex items-center justify-between gap-2">
                <ProfileSwitcher perfis={perfis} />
                {/* Sol/lua só quando o tema deixa: Girly é branco e Disciplina é preto por
                    definição, e uma chave que não faz nada é pior que nenhuma. */}
                {podeEscolherModo && (
                  <div className="ml-auto">
                    <ThemeQuickToggle initial={theme} />
                  </div>
                )}
              </div>
              {showGreeting && <GreetingStrip greeting={greeting} dateLabel={dateLabel} />}
              <InstallAppBanner onOpenTutorial={() => setInstallOpen(true)} />
              {isFlow && <FlowTabsDoTema />}
              {children}
            </div>
          </main>
        </div>

        <MobileTabBar
          onOpenMore={() => setMoreOpen(true)}
          onOpenRegistrar={() => abrirRegistrar()}
          moreActive={moreActive}
          isPremium={isPremium}
        />
        <MoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          isAdmin={isAdmin}
          isPremium={isPremium}
          // O mesmo valor que a barra de baixo recebe: sem a área paga, a Carteira sai de lá e
          // entra aqui. Valores diferentes nos dois fariam ela sumir dos dois (ou aparecer duas vezes).
          barraComCarteira={isPremium}
          userEmail={userEmail}
          onLogout={handleLogout}
          onOpenInstall={() => setInstallOpen(true)}
          theme={theme}
          openFinance={openFinance}
          podeEscolherModo={podeEscolherModo}
        />

        {/* Tutorial de "instalar na tela de início" (convite do topo ou menu "Mais"). */}
        <InstallAppSheet open={installOpen} onClose={() => setInstallOpen(false)} />

        {/* Ponto de entrada ÚNICO de registro, aberto pelo "+" central da tab bar (mobile) ou
            pelo botão "Registrar" da sidebar (desktop). O microfone vive dentro dele. */}
        <RegistrarDrawer open={registrarOpen} modoInicial={modoDoRegistrar} onClose={() => setRegistrarOpen(false)} />

        {/* Tour de boas-vindas, só na primeira entrada (lembrado no aparelho). */}
        <WelcomeTour />

        {/* Rastreio de uso primeiro (pageviews → /admin/relatorio). Não renderiza nada. */}
        <UsageTracker />
      </div>
    </NavProgressProvider>
      </ProfileThemeProvider>
    </ToastProvider>
  );
}

/** As abas do Fluxo com o nome que o tema dá a elas ("Objetivo · Mensal · Gastos · Missões" no Game). */
function FlowTabsDoTema() {
  const { voz } = useProfileTheme();
  const [foco, ...resto] = FLOW_TABS;
  const tabs = [
    { ...foco, label: voz.nav.foco ?? voz.titulos.focoTitulo },
    ...resto.map((tab, i) => ({ ...tab, label: voz.nav.flowTabs[i] ?? tab.label })),
  ];
  return <PillTabs tabs={tabs} fit />;
}

/**
 * Qualquer tela pode pedir a gaveta de registro (ex.: o guia "Primeiros passos") sem prop
 * drilling. `spi:registrar` abre na escolha (ou no modo pedido em `detail.modo`); `spi:importar`
 * abre direto na importação — é o atalho dos botões "Importe seu extrato" de conta nova.
 */
function RegistrarOpener({ onOpen }: { onOpen: (modo?: ModoDoRegistrar) => void }) {
  useEffect(() => {
    const registrar = (event: Event) => onOpen(modoPedidoNoEvento(event));
    const importar = () => onOpen("import");
    window.addEventListener(EVENTO_REGISTRAR, registrar);
    window.addEventListener(EVENTO_IMPORTAR, importar);
    return () => {
      window.removeEventListener(EVENTO_REGISTRAR, registrar);
      window.removeEventListener(EVENTO_IMPORTAR, importar);
    };
  }, [onOpen]);
  return null;
}
