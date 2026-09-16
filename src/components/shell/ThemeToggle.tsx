"use client";

import { useState, useTransition } from "react";
import { Moon, Sun } from "lucide-react";
import { setThemeAction } from "./theme-actions";

type Theme = "dark" | "light";

/**
 * Chave de tema clara/escura, com resposta imediata.
 *
 * A classe no <html> muda ANTES de o servidor responder de propósito: trocar o tema é o tipo
 * de ação em que a pessoa espera ver a tela mudar no toque. Se esperasse o servidor, pareceria
 * que o botão não funcionou e ela tocaria de novo. O salvamento acontece atrás, e é o que faz
 * a escolha sobreviver ao próximo login em outro aparelho.
 */
export function ThemeToggle({ initial, onDone }: { initial: Theme; onDone?: () => void }) {
  // Só o que a pessoa acabou de escolher fica em estado; o resto vem do servidor. Espelhar a
  // prop num useState com efeito (o caminho "óbvio") dispara render em cascata e é o que a
  // regra do React reclama — aqui a escolha local simplesmente tem precedência enquanto existe.
  const [chosen, setChosen] = useState<Theme | null>(null);
  const theme = chosen ?? initial;
  const [, startTransition] = useTransition();

  function choose(next: Theme) {
    setChosen(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("light", next === "light");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Modo privado: o tema desta sessão já trocou, só não fica lembrado localmente.
    }
    startTransition(async () => {
      await setThemeAction(next);
      onDone?.();
    });
  }

  const options: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: "Clara", Icon: Sun },
    { value: "dark", label: "Escura", Icon: Moon },
  ];

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-sm text-ink">Aparência</span>
      <div className="flex gap-1 rounded-full bg-surface-2 p-1">
        {options.map(({ value, label, Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon size={14} strokeWidth={1.9} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
