"use client";

import { usePathname } from "next/navigation";
import { CarrosselDeAbas } from "./Carrossel";

export type PillTab = { href: string; label: string };

/**
 * As abas de rota das áreas menores (Admin, fichas antigas das Análises), no mesmo carrossel da
 * Visão geral, da Carteira e da Empresa (11/10/2026): a aba aberta no centro, as vizinhas pela
 * metade nas bordas, arrastar gira. `fit` ficou só pela compatibilidade.
 */
export function PillTabs({ tabs }: { tabs: PillTab[]; fit?: boolean }) {
  const pathname = usePathname();
  const activeHref = tabs
    .filter((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <div className="mb-4">
      <CarrosselDeAbas rotulo="Abas" ativa={activeHref ?? null} itens={tabs.map((t) => ({ chave: t.href, rotulo: t.label, href: t.href }))} />
    </div>
  );
}
