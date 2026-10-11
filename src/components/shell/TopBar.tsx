"use client";

import { Menu } from "lucide-react";
import { ThemeQuickToggle } from "./ThemeQuickToggle";
import { AvatarDaConta } from "./PerfilSheet";

/**
 * O topo da versão nova (11/10/2026): menu ☰ à esquerda, o nome da tela no centro, sol/lua e a
 * foto do perfil à direita. No computador a barra lateral já está aberta, então o ☰ some.
 */
export function TopBar({
  titulo,
  onAbrirMenu,
  onAbrirPerfil,
  menuAberto,
  nome,
  foto,
  modo,
}: {
  titulo: string;
  onAbrirMenu: () => void;
  onAbrirPerfil: () => void;
  menuAberto: boolean;
  nome: string;
  foto: string | null;
  modo: "light" | "dark";
}) {
  const botao =
    "flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-border),0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.10)] transition-transform active:scale-95";
  return (
    <header className="sticky top-0 z-40 -mx-5 mb-2 grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 bg-canvas/85 px-5 pb-2 pt-[calc(0.5rem+var(--safe-top))] backdrop-blur-md md:static md:mx-0 md:grid-cols-[minmax(0,1fr)_auto] md:bg-transparent md:px-0 md:pt-0 md:backdrop-blur-none">
      <button type="button" onClick={onAbrirMenu} aria-label="Abrir menu" aria-expanded={menuAberto} data-tour="mais" className={`${botao} md:hidden`}>
        <Menu size={20} strokeWidth={1.6} aria-hidden />
      </button>
      <p className="titulo-tema min-w-0 truncate text-center text-[17px] font-medium text-ink md:text-left md:text-xl">{titulo}</p>
      <div className="flex items-center gap-1">
        <ThemeQuickToggle initial={modo} />
        <button type="button" onClick={onAbrirPerfil} aria-label="Abrir perfil e conta" aria-haspopup="dialog" className="rounded-full transition-transform active:scale-95">
          <AvatarDaConta nome={nome} foto={foto} size={44} />
        </button>
      </div>
    </header>
  );
}
