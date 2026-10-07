"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

/**
 * "‹ Calculadoras" no topo de cada calculadora e do cadeado.
 *
 * No app instalado no iPhone não existe o botão de voltar do navegador: quem abria uma
 * calculadora ficava sem saída. Desde 06/10/2026 as calculadoras têm porta própria (antes o
 * link voltava para o Decidir, onde elas moravam no fim da tela). Na própria lista ele some.
 * 44px de altura de toque, com a margem negativa pra não empurrar o título pra baixo.
 */
export function VoltarProDecidir() {
  const pathname = usePathname();
  const { voz } = useProfileTheme();
  if (pathname === "/simuladores") return null;
  return (
    <Link href="/simuladores" className="-my-2 flex min-h-11 w-fit items-center gap-1 pr-2 text-sm text-ink-muted hover:text-ink">
      <ChevronLeft size={16} aria-hidden /> {voz.titulos.calcTitulo}
    </Link>
  );
}
