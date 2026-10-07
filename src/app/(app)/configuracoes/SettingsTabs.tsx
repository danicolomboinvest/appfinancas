"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Nas telas de dentro (Categorias, Notificações…), uma volta para Configurações (07/10/2026). Antes
 * eram sete pílulas em três linhas no topo de cada tela, empurrando o conteúdo para baixo. Na tela
 * principal não aparece nada: ela já é a lista.
 */
export function SettingsTabs() {
  const pathname = usePathname();
  if (pathname === "/configuracoes") return null;
  return (
    <Link href="/configuracoes" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
      <ChevronLeft size={18} aria-hidden /> Configurações
    </Link>
  );
}
