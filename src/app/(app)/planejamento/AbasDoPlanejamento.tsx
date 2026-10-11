"use client";

import { usePathname } from "next/navigation";
import { PillTabs } from "@/components/shell/PillTabs";

/**
 * As abas Metas · Reserva · Aposentadoria. Em Metas elas saem (versão nova: a tela de Metas do
 * protótipo não tem abas; a Reserva e a Aposentadoria ficam num link discreto no fim da lista).
 * Na Reserva e na Aposentadoria continuam, para ela voltar.
 */
export function AbasDoPlanejamento({ tabs }: { tabs: { href: string; label: string }[] }) {
  const caminho = usePathname();
  if (caminho.startsWith("/planejamento/metas")) return null;
  return <PillTabs tabs={tabs} fit />;
}
