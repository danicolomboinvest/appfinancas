"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileTabBar } from "./MobileTabBar";
import { MoreSheet } from "./MoreSheet";
import { GreetingStrip } from "./GreetingStrip";
import { RegistrarDrawer } from "./RegistrarDrawer";
import { MORE_NAV_SECTIONS } from "./nav-sections";
import { logoutAction } from "@/lib/auth/actions";
import { ToastProvider } from "@/components/ui/toast-context";

export function AppShell({
  children,
  isAdmin,
  userEmail,
  greeting,
  dateLabel,
  summary,
  flow,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
  userEmail?: string;
  greeting: string;
  dateLabel: string;
  summary: string;
  flow?: { income: number; expense: number; investment: number };
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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

  // A saudação ("Bom dia/Boa noite") só aparece no Fluxo — antes vinha em todas as telas.
  const showGreeting = pathname === "/mensal" || pathname.startsWith("/mensal/");

  // "Mais" fica em destaque na tab bar quando a rota atual é uma das seções que só
  // existem dentro da sheet (Visão Geral, Orçamento, Simuladores, Análises, Configurações).
  const moreActive = MORE_NAV_SECTIONS.some(
    (section) => pathname === section.basePath || pathname.startsWith(`${section.basePath}/`),
  );

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        {/* Sidebar: navegação primária no desktop; no mobile fica sempre fora da tela
            (a gaveta hambúrguer foi substituída pela tab bar + MoreSheet abaixo). */}
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={false}
          onCloseMobile={() => {}}
          isAdmin={isAdmin}
          userEmail={userEmail}
          onLogout={handleLogout}
          onOpenRegistrar={() => setRegistrarOpen(true)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* pb no mobile precisa limpar a tab bar flutuante: ela usa env(safe-area-inset-bottom)
              (home indicator do iPhone) + o botão "+" elevado. Sem isso o final ficava tampado. */}
          <main className="flex-1 px-5 pb-[calc(7.5rem_+_env(safe-area-inset-bottom))] pt-6 md:px-10 md:pb-8 md:pt-8">
            <div className="mx-auto w-full max-w-6xl animate-fade-in">
              {showGreeting && <GreetingStrip greeting={greeting} dateLabel={dateLabel} summary={summary} flow={flow} />}
              {children}
            </div>
          </main>
        </div>

        <MobileTabBar
          onOpenMore={() => setMoreOpen(true)}
          onOpenRegistrar={() => setRegistrarOpen(true)}
          moreActive={moreActive}
        />
        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} isAdmin={isAdmin} userEmail={userEmail} onLogout={handleLogout} />

        {/* Ponto de entrada ÚNICO de registro — aberto pelo "+" central da tab bar (mobile) ou
            pelo botão "Registrar" da sidebar (desktop). O microfone vive dentro dele. */}
        <RegistrarDrawer open={registrarOpen} onClose={() => setRegistrarOpen(false)} />
      </div>
    </ToastProvider>
  );
}
