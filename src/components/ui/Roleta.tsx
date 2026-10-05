"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

const ALTURA = 50;

/**
 * Roleta de valores: a lista gira com o dedo e encaixa no valor do meio, como o seletor de hora
 * do celular. A Dani pediu "aquele negócio que você rola e vai aumentando" pro preço, e depois
 * pras parcelas e pros juros. Setas do teclado também giram.
 *
 * `irPara` (pela ref) leva a roleta a um valor sem animação: é o que os atalhos usam.
 */
export function Roleta<T extends number>({
  valores,
  valor,
  onChange,
  formatar,
  linhas = 5,
  rotulo,
  irParaRef,
}: {
  valores: readonly T[];
  valor: T;
  onChange: (v: T) => void;
  formatar: (v: T) => React.ReactNode;
  /** Quantas linhas aparecem (ímpar): 5 no preço, 3 nas parcelas e nos juros. */
  linhas?: 3 | 5;
  rotulo: string;
  irParaRef?: React.RefObject<((v: number) => void) | null>;
}) {
  const roda = useRef<HTMLDivElement>(null);
  const atual = useRef(valor);
  const borda = (ALTURA * (linhas - 1)) / 2;

  const indiceDe = useCallback(
    (v: number) => {
      const k = valores.findIndex((x) => x >= v - 1e-9);
      return k < 0 ? valores.length - 1 : k;
    },
    [valores],
  );

  const irPara = useCallback(
    (v: number) => {
      if (roda.current) roda.current.scrollTop = indiceDe(v) * ALTURA;
    },
    [indiceDe],
  );

  // Abre já no valor de agora, antes de pintar.
  useLayoutEffect(() => {
    irPara(atual.current);
  }, [irPara]);

  useEffect(() => {
    if (irParaRef) irParaRef.current = irPara;
  }, [irPara, irParaRef]);

  // Lê direto no evento: conta barata, e não depende de quadro de animação (que o navegador
  // pausa em aba escondida).
  function aoRolar() {
    const el = roda.current;
    if (!el) return;
    const i = Math.max(0, Math.min(valores.length - 1, Math.round(el.scrollTop / ALTURA)));
    if (valores[i] !== atual.current) {
      atual.current = valores[i];
      onChange(valores[i]);
    }
  }

  const meio = indiceDe(valor);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-surface" style={{ height: ALTURA * linhas }}>
      <div
        ref={roda}
        role="listbox"
        aria-label={rotulo}
        aria-activedescendant={`roleta-${rotulo}-${meio}`}
        tabIndex={0}
        onScroll={aoRolar}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
          e.preventDefault();
          roda.current?.scrollBy({ top: e.key === "ArrowDown" ? ALTURA : -ALTURA });
        }}
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent [&::-webkit-scrollbar]:hidden"
      >
        <div style={{ height: borda }} aria-hidden />
        {valores.map((v, i) => {
          const d = Math.abs(i - meio);
          // Só os vizinhos ganham estilo próprio: a lista do preço tem 600 itens.
          return (
            <div
              key={v}
              id={`roleta-${rotulo}-${i}`}
              role="option"
              aria-selected={d === 0}
              onClick={() => roda.current?.scrollTo({ top: i * ALTURA, behavior: "smooth" })}
              className={`flex snap-center items-center justify-center tabular-nums tracking-tight text-ink transition-opacity ${
                d === 0 ? "text-[34px] font-extrabold" : "text-[22px] font-semibold"
              }`}
              style={{ height: ALTURA, opacity: d === 0 ? 1 : d === 1 ? 0.5 : d === 2 ? 0.28 : 0.15 }}
            >
              {formatar(v)}
            </div>
          );
        })}
        <div style={{ height: borda }} aria-hidden />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-3 rounded-2xl border-2 border-accent/50 bg-accent/8"
        style={{ top: borda, height: ALTURA }}
      />
    </div>
  );
}
