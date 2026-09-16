"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { PillTabs } from "./PillTabs";
import { NavProgressProvider } from "./nav-progress";
import { FLOW_TABS } from "./flow-tabs";
import { MobileTabBar } from "./MobileTabBar";
import { MoreSheet } from "./MoreSheet";
import { GreetingStrip } from "./GreetingStrip";
import { ThemeQuickToggle } from "./ThemeQuickToggle";
import { RegistrarDrawer } from "./RegistrarDrawer";
import { WelcomeTour } from "./WelcomeTour";
import { InstallAppBanner } from "./InstallAppBanner";
import { InstallAppSheet } from "./InstallAppSheet";
import { UsageTracker } from "./UsageTracker";
import { MORE_NAV_SECTIONS } from "./nav-sections";
import { logoutAction } from "@/lib/auth/actions";
import { ToastProvider } from "@/components/ui/toast-context";

export function AppShell({
  children,
  isAdmin,
  isPremium,
  userEmail,
  greeting,
  dateLabel,
  theme,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
  isPremium: boolean;
  userEmail?: string;
  greeting: string;
  dateLabel: string;
  /** Tema salvo na conta — a chave clara/escura do menu "Mais" nasce com ele. */
  theme: "dark" | "light";
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [, startTransition] = useTransition();
  const pathname = usePathname();

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
    startTransition(() => {
      logoutAction();
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
  const isFlow =
    pathname === "/mensal" || pathname.startsWith("/mensal/") ||
    pathname === "/orcamento" || pathname.startsWith("/orcamento/");
  const showGreeting = isFlow;

  // "Mais" fica em destaque na tab bar quando a rota atual é uma das seções que só
  // existem dentro da sheet (Visão Geral, Orçamento, Simuladores, Análises, Configurações).
  const moreActive = MORE_NAV_SECTIONS.some(
    (section) => pathname === section.basePath || pathname.startsWith(`${section.basePath}/`),
  );

  return (
    <ToastProvider>
      <NavProgressProvider>
      <div className="flex min-h-screen">
        {/* Sidebar: navegação primária no desktop; no mobile fica sempre fora da tela
            (a gaveta hambúrguer foi substituída pela tab bar + MoreSheet abaixo). */}
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={false}
          onCloseMobile={() => {}}
          isAdmin={isAdmin}
          isPremium={isPremium}
          userEmail={userEmail}
          onLogout={handleLogout}
          onOpenRegistrar={() => setRegistrarOpen(true)}
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
              <div className="mb-1 flex justify-end">
                <ThemeQuickToggle initial={theme} />
              </div>
              {showGreeting && <GreetingStrip greeting={greeting} dateLabel={dateLabel} />}
              <InstallAppBanner onOpenTutorial={() => setInstallOpen(true)} />
              {isFlow && <PillTabs tabs={FLOW_TABS} fit />}
              {children}
            </div>
          </main>
        </div>

        <MobileTabBar
          onOpenMore={() => setMoreOpen(true)}
          onOpenRegistrar={() => setRegistrarOpen(true)}
          moreActive={moreActive}
        />
        <MoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          isAdmin={isAdmin}
          isPremium={isPremium}
          userEmail={userEmail}
          onLogout={handleLogout}
          onOpenInstall={() => setInstallOpen(true)}
          theme={theme}
        />

        {/* Tutorial de "instalar na tela de início" (convite do topo ou menu "Mais"). */}
        <InstallAppSheet open={installOpen} onClose={() => setInstallOpen(false)} />

        {/* Ponto de entrada ÚNICO de registro, aberto pelo "+" central da tab bar (mobile) ou
            pelo botão "Registrar" da sidebar (desktop). O microfone vive dentro dele. */}
        <RegistrarDrawer open={registrarOpen} onClose={() => setRegistrarOpen(false)} />

        {/* Tour de boas-vindas, só na primeira entrada (lembrado no aparelho). */}
        <WelcomeTour />

        {/* Rastreio de uso primeiro (pageviews → /admin/relatorio). Não renderiza nada. */}
        <UsageTracker />
      </div>
    </NavProgressProvider>
    </ToastProvider>
  );
}
