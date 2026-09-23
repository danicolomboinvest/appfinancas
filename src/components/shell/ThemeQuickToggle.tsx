"use client";

import { useState, useTransition } from "react";
import { Moon, Sun } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { setThemeAction } from "./theme-actions";

type Theme = "dark" | "light";

/**
 * Sol/lua no topo de toda tela: um toque troca a cor do app inteiro.
 *
 * Fica aqui, e não só em Configurações, porque claro/escuro é decisão de conforto do momento
 * — claro de dia, escuro à noite, escuro na cama. Uma preferência que se troca várias vezes
 * por semana não pode morar a três telas de distância.
 *
 * O ícone mostra PARA ONDE vai, não onde está: no claro aparece a lua ("clique pra escurecer").
 * Mostrar o estado atual confunde — a pessoa vê um sol, está no claro, e não sabe se o sol é
 * o que ela tem ou o que ela ganha ao clicar.
 */
export function ThemeQuickToggle({ initial }: { initial: Theme }) {
  const [chosen, setChosen] = useState<Theme | null>(null);
  const [, startTransition] = useTransition();
  const { voz } = useProfileTheme();
  const theme = chosen ?? initial;
  const next: Theme = theme === "dark" ? "light" : "dark";
  const Icon = next === "dark" ? Moon : Sun;
  const rotulo = next === "dark" ? voz.titulos.uiMudarParaEscuro : voz.titulos.uiMudarParaClaro;

  function alternar() {
    setChosen(next);
    // A troca acontece na hora, antes do servidor responder: trocar tema é o tipo de ação em
    // que esperar parece que o botão não funcionou.
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("light", next === "light");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Modo privado: vale pra esta sessão, só não fica lembrado localmente.
    }
    startTransition(() => {
      void setThemeAction(next);
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={rotulo}
      title={rotulo}
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Icon size={18} strokeWidth={1.9} />
    </button>
  );
}
