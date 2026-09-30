"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { destinoDaNavegacao } from "./nav-progress-link";

/** Se a tela nova não chegar nesse tempo (link que o próprio Next cancelou, redirecionamento
 * de volta pra mesma tela), a barra some sozinha em vez de ficar parada em 90%. */
const DESISTE_EM_MS = 10_000;

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

  // Toque em QUALQUER link do app: barra de baixo, menu "Mais", menu lateral, cartões.
  //
  // O `NavPending` (lá embaixo) só funciona dentro de um <Link> que continua na tela até a
  // navegação acabar. O menu "Mais" fecha no mesmo toque e desmonta os links junto — a barra
  // nunca acendia ali, e no celular a pessoa tocava de novo achando que não tinha pegado. Ouvir
  // o toque no documento inteiro cobre todos os links sem precisar lembrar de pôr nada em cada um.
  const pathname = usePathname();
  const [indoPara, setIndoPara] = useState<string | null>(null);
  const [pathnameAnterior, setPathnameAnterior] = useState(pathname);
  if (pathname !== pathnameAnterior) {
    // A tela nova chegou: apaga a barra no mesmo render, sem esperar um efeito.
    setPathnameAnterior(pathname);
    if (indoPara !== null) setIndoPara(null);
  }

  useEffect(() => {
    function aoTocar(event: MouseEvent) {
      const alvo = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!alvo) return;
      const destino = destinoDaNavegacao(
        {
          href: alvo.getAttribute("href"),
          target: alvo.getAttribute("target"),
          download: alvo.hasAttribute("download"),
          button: event.button,
          comModificador: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
        },
        { origin: window.location.origin, pathname: window.location.pathname },
      );
      if (destino) setIndoPara(destino);
    }
    // Fase de captura: roda ANTES do onClick do React, que no menu "Mais" fecha a gaveta e tira
    // o link da tela. Não olha `defaultPrevented`: o próprio <Link> do Next chama
    // preventDefault pra navegar sem recarregar, então todo link interno viria "cancelado".
    document.addEventListener("click", aoTocar, true);
    return () => document.removeEventListener("click", aoTocar, true);
  }, []);

  useEffect(() => {
    if (indoPara === null) return;
    const desiste = window.setTimeout(() => setIndoPara(null), DESISTE_EM_MS);
    return () => window.clearTimeout(desiste);
  }, [indoPara]);

  const carregando = pendentes > 0 || indoPara !== null;

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
