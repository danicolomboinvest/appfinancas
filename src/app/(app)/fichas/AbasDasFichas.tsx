"use client";

import { usePathname } from "next/navigation";
import { PillTabs } from "@/components/shell/PillTabs";

/**
 * As abas antigas (Insights, Ações, FIIs, Stocks, ETFs) só nas telas das fichas salvas. As Análises
 * da versão nova (a entrada em anéis, a Análise completa, o Comparar) não têm abas: o anel é a tela.
 * Nada das fichas antigas sumiu; elas ficam a um toque, no fim da entrada.
 */
const ANTIGAS = ["/fichas/insights", "/fichas/acoes", "/fichas/fiis", "/fichas/stocks", "/fichas/etfs"];

export function AbasDasFichas({ insights }: { insights: string }) {
  const caminho = usePathname();
  if (!ANTIGAS.some((a) => caminho === a || caminho.startsWith(`${a}/`))) return null;
  return (
    <PillTabs
      tabs={[
        { href: "/fichas", label: "Análises" },
        { href: "/fichas/insights", label: insights },
        { href: "/fichas/acoes", label: "Ações" },
        { href: "/fichas/fiis", label: "FIIs" },
        { href: "/fichas/stocks", label: "Stocks" },
        { href: "/fichas/etfs", label: "ETFs" },
      ]}
    />
  );
}
