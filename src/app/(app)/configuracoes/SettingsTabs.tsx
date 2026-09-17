"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/configuracoes/perfil", label: "Perfil" },
  { href: "/configuracoes/preferencias", label: "Preferências" },
  { href: "/configuracoes/categorias", label: "Categorias" },
  { href: "/configuracoes/notificacoes", label: "Notificações" },
  { href: "/configuracoes/conexoes", label: "Conexões" },
  { href: "/configuracoes/dados", label: "Dados" },
  { href: "/configuracoes/taxas", label: "Taxas" },
];

/**
 * Seções de Configurações no celular. Sete pílulas não cabem em 375px numa linha só e a
 * fileira rolável cortava a última pela metade; aqui elas quebram em duas linhas.
 */
export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções de configurações" className="mb-6 flex flex-wrap gap-1.5 md:hidden">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active ? "border-ink bg-ink text-canvas" : "border-border bg-surface-2 text-ink-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
