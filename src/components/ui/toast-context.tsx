"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { vibrar } from "@/lib/celebrar";

/**
 * Os avisos do app (14/10/2026, decisão da Dani: "B como regra, a pílula de A como exceção").
 *
 * A regra é a tela responder no lugar: o item novo entra na lista, a linha brilha, ganha um
 * selinho. Aviso solto só sobra para três casos: apagar com Desfazer, ação cujo resultado sai
 * da tela e "Segurar em". Erro vai para o botão que falhou (ErroNoBotao) e, quando não há botão
 * de origem claro, vem aqui, curto e por pelo menos 6 s.
 *
 * Formato: pílula escura, canto todo redondo, uma linha, largura do texto, centralizada embaixo
 * e acima da barra de abas. Um aviso por vez (o novo substitui o anterior). 3 s, ou 6 s com
 * Desfazer; para enquanto o dedo está em cima; arrastar para baixo fecha.
 */

type ToastAction = { label: string; onClick: () => void };
type Aviso = { id: number; message: string; action?: ToastAction; erro?: boolean; duracao: number };
type ToastContextValue = {
  /** Pílula curta (2 a 4 palavras). `action` adiciona um botão (ex.: "Desfazer") e estende para 6 s. */
  showToast: (message: string, action?: ToastAction) => void;
  /** Erro sem botão de origem claro. Fica pelo menos 6 s. Prefira ErroNoBotao quando houver botão. */
  showError: (message: string) => void;
};

export const DURACAO_DO_AVISO = 3000;
export const DURACAO_COM_ACAO = 6000;
export const DURACAO_DO_ERRO = 6500;
/** Acima disso o texto já não é pílula: vira explicação. Só avisa em desenvolvimento. */
export const LIMITE_DO_AVISO = 24;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const mostrar = useCallback((item: Omit<Aviso, "id">) => {
    if (process.env.NODE_ENV !== "production" && !item.erro && item.message.length > LIMITE_DO_AVISO) {
      console.warn(`[aviso] "${item.message}" tem ${item.message.length} caracteres. A pílula é de até ${LIMITE_DO_AVISO}.`);
    }
    setAviso({ id: Date.now() + Math.random(), ...item });
  }, []);

  const showToast = useCallback(
    (message: string, action?: ToastAction) => mostrar({ message, action, duracao: action ? DURACAO_COM_ACAO : DURACAO_DO_AVISO }),
    [mostrar],
  );
  const showError = useCallback(
    (message: string) => {
      vibrar("erro");
      mostrar({ message, erro: true, duracao: DURACAO_DO_ERRO });
    },
    [mostrar],
  );
  const fechar = useCallback((id: number) => setAviso((atual) => (atual?.id === id ? null : atual)), []);

  return (
    <ToastContext.Provider value={{ showToast, showError }}>
      {children}
      <FaixaSemInternet />
      {/* No celular fica acima da barra de abas (fixa, flutua no rodapé). Região montada desde
          o início para o leitor de tela anunciar (aria-live só fala do que muda dentro dela). */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(6.5rem_+_var(--safe-bottom))] z-[200] flex justify-center md:bottom-6"
      >
        {aviso && <Pilula key={aviso.id} aviso={aviso} fechar={fechar} />}
      </div>
    </ToastContext.Provider>
  );
}

function Pilula({ aviso, fechar }: { aviso: Aviso; fechar: (id: number) => void }) {
  const restante = useRef(aviso.duracao);
  const inicio = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const toqueY = useRef<number | null>(null);

  const correr = useCallback(() => {
    window.clearTimeout(timer.current);
    inicio.current = Date.now();
    timer.current = window.setTimeout(() => fechar(aviso.id), restante.current);
  }, [aviso.id, fechar]);
  const pausar = useCallback(() => {
    if (timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    restante.current = Math.max(1200, restante.current - (Date.now() - inicio.current));
  }, []);

  useEffect(() => {
    correr();
    return () => window.clearTimeout(timer.current);
  }, [correr]);

  return (
    <div
      role="status"
      onPointerEnter={pausar}
      onPointerLeave={correr}
      onPointerDown={(e) => {
        toqueY.current = e.clientY;
        pausar();
      }}
      onPointerUp={(e) => {
        // Arrastar para baixo fecha; tocar e soltar só retoma o tempo.
        if (toqueY.current !== null && e.clientY - toqueY.current > 24) fechar(aviso.id);
        else if (e.pointerType !== "mouse") correr();
        toqueY.current = null;
      }}
      onPointerCancel={correr}
      className={`aviso-sobe pointer-events-auto inline-flex min-h-11 max-w-full touch-none items-center gap-3 rounded-full py-1 pl-[18px] text-[14.5px] font-semibold leading-snug shadow-premium ${
        aviso.action ? "pr-2" : "pr-[18px]"
      } ${aviso.erro ? "border border-danger/30 bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-surface))] text-danger" : "bg-aviso text-on-aviso"}`}
    >
      {aviso.erro && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-danger" />}
      <span className="min-w-0 text-balance">{aviso.message}</span>
      {aviso.action && (
        <button
          type="button"
          onClick={() => {
            aviso.action?.onClick();
            fechar(aviso.id);
          }}
          className="-my-1 min-h-11 shrink-0 px-2.5 font-bold text-aviso-acao"
        >
          {aviso.action.label}
        </button>
      )}
    </div>
  );
}

/** Sem internet: faixa fina fixa no topo enquanto durar, no lugar de um erro em cada botão. */
function assinarRede(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}

function FaixaSemInternet() {
  const offline = useSyncExternalStore(assinarRede, () => navigator.onLine === false, () => false);
  if (!offline) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)_+_6px)] z-[210] flex justify-center px-4"
    >
      <span className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-surface))] px-3 py-1 text-label font-semibold text-danger shadow-premium-sm">
        <span aria-hidden className="size-1.5 rounded-full bg-danger" />
        Sem internet
      </span>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast precisa ser usado dentro de um ToastProvider.");
  }
  return ctx;
}
