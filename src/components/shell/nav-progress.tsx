"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLinkStatus } from "next/link";

/**
 * Feedback de navegação SEM apagar a tela.
 *
 * Antes existia um `loading.tsx` no app inteiro: qualquer clique trocava a página inteira por
 * um esqueleto pulsando e, uns milésimos depois, pela tela nova. Dava resposta imediata, mas
 * ao custo de piscar a cada navegação — a tela sumia antes de ter algo pra colocar no lugar.
 *
 * Sem aquele arquivo, o Next mantém a tela atual no ar até a próxima estar pronta, que é a
 * transição que a gente quer. Só que aí não sobra nenhum sinal de que algo está acontecendo.
 * Esta é a peça que devolve o sinal: uma barrinha fina no topo, enquanto a tela velha continua
 * lá. Mesma informação, sem o branco no meio.
 */

type NavProgressValue = { start: () => void; stop: () => void };

const NavProgressContext = createContext<NavProgressValue | null>(null);

export function NavProgressProvider({ children }: { children: React.ReactNode }) {
  const [pendentes, setPendentes] = useState(0);
  const start = useCallback(() => setPendentes((n) => n + 1), []);
  const stop = useCallback(() => setPendentes((n) => Math.max(0, n - 1)), []);
  const value = useMemo(() => ({ start, stop }), [start, stop]);
  const carregando = pendentes > 0;

  return (
    <NavProgressContext.Provider value={value}>
      {/* aria-hidden: quem usa leitor de tela já é avisado pela troca de página em si. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
        style={{ opacity: carregando ? 1 : 0, transition: "opacity 200ms ease-out" }}
      >
        <div
          className="h-full bg-accent"
          style={{
            // Vai depressa até 90% e espera: a barra nunca promete um fim que ela não controla.
            width: carregando ? "90%" : "100%",
            transition: carregando ? "width 1.4s cubic-bezier(0.1, 0.8, 0.2, 1)" : "width 180ms ease-out",
          }}
        />
      </div>
      {children}
    </NavProgressContext.Provider>
  );
}

/**
 * Vive DENTRO de um `<Link>` e conta enquanto aquele link está pendente — é a única forma de
 * saber disso (`useLinkStatus` só funciona abaixo de um Link). Não desenha nada.
 */
export function NavPending() {
  const { pending } = useLinkStatus();
  const ctx = useContext(NavProgressContext);
  const contando = useRef(false);

  useEffect(() => {
    if (!ctx) return;
    if (pending && !contando.current) {
      contando.current = true;
      ctx.start();
    } else if (!pending && contando.current) {
      contando.current = false;
      ctx.stop();
    }
    return () => {
      if (contando.current) {
        contando.current = false;
        ctx.stop();
      }
    };
  }, [pending, ctx]);

  return null;
}
