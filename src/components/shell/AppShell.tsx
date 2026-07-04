"use client";

import { useEffect, useState, useTransition } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { logoutAction } from "@/lib/auth/actions";

export function AppShell({
  children,
  isAdmin,
  userEmail,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
  userEmail?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, startTransition] = useTransition();

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

  return (
    <div className="flex min-h-screen">
      {mobileOpen && (
        <button
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        isAdmin={isAdmin}
        userEmail={userEmail}
        onLogout={handleLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-medium text-ink">Planejamento Financeiro</span>
        </header>

        <main className="flex-1 px-5 py-6 md:px-10 md:py-8">
          <div className="mx-auto w-full max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
