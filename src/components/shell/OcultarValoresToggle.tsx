"use client";

import { Eye, EyeOff } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useValoresOcultos } from "@/components/money/MoneyProvider";

/**
 * O olho no topo de toda tela (05/10/2026): um toque esconde todo valor em dinheiro do app
 * ("R$ ••••"), outro mostra de novo. Para abrir o app no ônibus, na fila, na frente de alguém.
 * Como o sol/lua, mostra o que o toque FAZ: olho aberto = mostrar.
 */
export function OcultarValoresToggle() {
  const { voz } = useProfileTheme();
  const { ocultos, alternar } = useValoresOcultos();
  const rotulo = ocultos ? voz.titulos.cartMostrarValores : voz.titulos.cartOcultarValores;
  const Icone = ocultos ? Eye : EyeOff;
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={rotulo}
      aria-pressed={ocultos}
      title={rotulo}
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Icone size={18} strokeWidth={1.9} />
    </button>
  );
}
