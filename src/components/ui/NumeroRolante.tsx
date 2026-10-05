"use client";

import { useEffect, useState } from "react";

const DIGITOS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Número que rola, dígito por dígito (05/10/2026, "cara de premium"): cada algarismo é uma fita
 * de 0 a 9 que desliza até o valor, como o contentTransition(.numericText()) do iPhone. Rola ao
 * aparecer e de novo quando o valor muda (um "Paguei", um gasto novo). Recebe o texto já
 * formatado ("R$ 840"), então serve para dinheiro, porcentagem ou contagem, e com os valores
 * ocultos ("R$ ••••") simplesmente não tem o que rolar.
 *
 * Quem lê a tela ouve o número inteiro (sr-only); a fita é decorativa. Sem animação para quem
 * pediu menos movimento no aparelho.
 */
export function NumeroRolante({ texto, className = "" }: { texto: string; className?: string }) {
  // Primeiro desenho com tudo no zero; no quadro seguinte cada fita vai até o seu dígito.
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const chars = [...texto];
  return (
    <span className={`relative inline-flex items-baseline ${className}`}>
      <span className="sr-only">{texto}</span>
      <span aria-hidden className="inline-flex select-none">
        {chars.map((c, i) => {
          // A chave conta da direita: "R$ 99" para "R$ 100" mantém as unidades no mesmo lugar.
          const chave = chars.length - i;
          const d = DIGITOS.indexOf(c);
          if (d < 0) {
            return (
              <span key={`c${chave}`} className="inline-block whitespace-pre leading-[1.1em]">
                {c}
              </span>
            );
          }
          return (
            <span key={`d${chave}`} className="inline-block h-[1.1em] overflow-hidden leading-[1.1em]">
              <span
                className="numero-rolante-fita block"
                style={{ transform: `translateY(-${(montado ? d : 0) * 1.1}em)`, transitionDelay: `${Math.min(i, 8) * 25}ms` }}
              >
                {DIGITOS.map((x) => (
                  <span key={x} className="block h-[1.1em]">
                    {x}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
