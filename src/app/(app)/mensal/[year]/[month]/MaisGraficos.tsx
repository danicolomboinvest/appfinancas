"use client";

import { useState, type ReactNode } from "react";

/**
 * Os gráficos do Mensal viram botões (07/10/2026, "mesma cara, menos texto"): a curva do dia a dia,
 * o calendário do ritmo e o ano mês a mês ocupavam três telas de rolagem e quase ninguém precisa
 * dos três todo dia. Um toque abre o escolhido; outro toque fecha.
 *
 * No computador, enquanto nada foi escolhido, o primeiro fica aberto: lá ele divide a linha com a
 * lista de categorias e há espaço de sobra. Os gráficos chegam prontos do servidor.
 */
export function MaisGraficos({ opcoes }: { opcoes: { chave: string; rotulo: string; conteudo: ReactNode }[] }) {
  const [aberto, setAberto] = useState<string | null>(null);
  if (opcoes.length === 0) return null;
  const escolhido = opcoes.find((o) => o.chave === aberto);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o, i) => {
          const ligado = aberto === o.chave || (aberto === null && i === 0);
          return (
            <button
              key={o.chave}
              type="button"
              aria-pressed={aberto === o.chave}
              onClick={() => setAberto((v) => (v === o.chave ? null : o.chave))}
              className={`min-h-10 rounded-full border px-4 text-sm font-medium transition-colors ${
                aberto === o.chave
                  ? "border-pill bg-pill text-on-pill"
                  : `border-border-strong text-ink hover:bg-surface-hover ${ligado ? "lg:border-pill lg:bg-pill lg:text-on-pill" : ""}`
              }`}
            >
              {o.rotulo}
            </button>
          );
        })}
      </div>
      {escolhido ? (
        <div className="passo-entra min-w-0">{escolhido.conteudo}</div>
      ) : (
        <div className="hidden min-w-0 lg:block">{opcoes[0].conteudo}</div>
      )}
    </div>
  );
}
