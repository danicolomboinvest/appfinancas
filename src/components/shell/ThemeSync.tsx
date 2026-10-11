"use client";

import { useEffect } from "react";

/** Aplica no <html> o modo claro ou escuro. */
export function aplicarModo(modo: "light" | "dark") {
  // As DUAS classes são explícitas: o tema claro é um bloco `html.light` próprio, e só
  // remover a classe `dark` deixaria a página no `:root`, que é escuro por padrão.
  document.documentElement.classList.toggle("dark", modo === "dark");
  document.documentElement.classList.toggle("light", modo === "light");
}

/**
 * Aplica a preferência de modo salva na conta e mantém o localStorage sincronizado (evita flash
 * no próximo load). "auto" segue o modo do celular e acompanha a troca dele ao vivo.
 */
export function ThemeSync({ theme }: { theme: string }) {
  useEffect(() => {
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // localStorage indisponível (modo privado, etc.), tema ainda funciona, só sem persistência local.
    }
    if (theme !== "auto") {
      aplicarModo(theme === "dark" ? "dark" : "light");
      return;
    }
    const escuro = window.matchMedia("(prefers-color-scheme: dark)");
    const seguir = () => aplicarModo(escuro.matches ? "dark" : "light");
    seguir();
    escuro.addEventListener("change", seguir);
    return () => escuro.removeEventListener("change", seguir);
  }, [theme]);

  return null;
}
