"use client";

import { useEffect } from "react";

/** Aplica a preferência de tema salva na conta e mantém o localStorage sincronizado (evita flash no próximo load). */
export function ThemeSync({ theme }: { theme: string }) {
  useEffect(() => {
    // As DUAS classes são explícitas: o tema claro é um bloco `html.light` próprio, e só
    // remover a classe `dark` deixaria a página no `:root`, que é escuro por padrão.
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // localStorage indisponível (modo privado, etc.), tema ainda funciona, só sem persistência local.
    }
  }, [theme]);

  return null;
}
