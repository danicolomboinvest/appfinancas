"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Titulos } from "@/lib/profiles/voice";

// O rótulo de cada pílula vem da voz do tema: aqui só fica a chave dele.
type AbaChave = Extract<keyof Titulos, `cfgAba${string}`>;
const TABS: { href: string; chave: AbaChave; flag?: "openFinance" }[] = [
  { href: "/configuracoes/perfil", chave: "cfgAbaPerfil" },
  { href: "/configuracoes/preferencias", chave: "cfgAbaPreferencias" },
  { href: "/configuracoes/categorias", chave: "cfgAbaCategorias" },
  { href: "/configuracoes/notificacoes", chave: "cfgAbaNotificacoes" },
  { href: "/configuracoes/conexoes", chave: "cfgAbaConexoes", flag: "openFinance" },
  { href: "/configuracoes/dados", chave: "cfgAbaDados" },
  { href: "/configuracoes/taxas", chave: "cfgAbaTaxas" },
];

/**
 * Seções de Configurações no celular. Sete pílulas não cabem em 375px numa linha só e a
 * fileira rolável cortava a última pela metade; aqui elas quebram em duas linhas.
 */
export function SettingsTabs({ openFinance }: { openFinance: boolean }) {
  const pathname = usePathname();
  const { voz } = useProfileTheme();
  const tabs = TABS.filter((t) => !t.flag || openFinance).map((t) => ({ href: t.href, label: voz.titulos[t.chave] }));
  return (
    <nav aria-label="Seções de configurações" className="mb-6 flex flex-wrap gap-1.5 md:hidden">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active ? "border-pill bg-pill text-on-pill" : "border-border bg-surface-2 text-ink-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
