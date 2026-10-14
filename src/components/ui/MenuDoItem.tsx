"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { useToast } from "./toast-context";

/**
 * O "…" de um item (meta, dívida) com Editar e Apagar (13/10/2026). A Dani pediu: "eu queria ter
 * uma opção que eu clico nela e já posso apagar". Antes, apagar uma meta era ir até o último
 * passo da edição.
 *
 * - Toque no "…" (44 px) ou toque e segure o item: abre o menu pequeno, perto do dedo.
 * - Apagar pede uma confirmação curta numa folha, e depois o aviso traz "Desfazer".
 * - Sem `apagar`, o menu só tem Editar (quem não pode apagar não vê a opção).
 */

export type ApagarDoItem = {
  /** "Apagar a meta Viagem para Lisboa?" */
  titulo: string;
  /** O que acontece com o resto, em uma frase. */
  texto: string;
  /** O aviso depois de apagar ("Meta apagada"). */
  aviso: string;
  acao: () => Promise<{ ok: true; desfazer: string | null } | { ok: false; erro: string }>;
  desfazer: (recibo: string) => Promise<{ ok: true } | { ok: false; erro: string }>;
  /** Depois de apagar (ex.: sair do detalhe que não existe mais). */
  depois?: () => void;
};

type Ponto = { x: number; y: number; acima: number };

const LARGURA = 200;
const ALTURA = 116;

/** Tocar e segurar: 450 ms parado (mexer o dedo é rolar a tela, não segurar). */
function useSegurar(onSegurar: (p: Ponto) => void) {
  const s = useRef<{ timer: ReturnType<typeof setTimeout> | null; disparou: boolean; x: number; y: number }>({ timer: null, disparou: false, x: 0, y: 0 });
  const parar = () => {
    if (s.current.timer) clearTimeout(s.current.timer);
    s.current.timer = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      s.current.disparou = false;
      s.current.x = e.clientX;
      s.current.y = e.clientY;
      parar();
      s.current.timer = setTimeout(() => {
        s.current.disparou = true;
        navigator.vibrate?.(10);
        onSegurar({ x: s.current.x, y: s.current.y + 8, acima: s.current.y - 8 });
      }, 450);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (Math.abs(e.clientX - s.current.x) > 10 || Math.abs(e.clientY - s.current.y) > 10) parar();
    },
    onPointerUp: parar,
    onPointerLeave: parar,
    onPointerCancel: parar,
    onContextMenu: (e: React.MouseEvent) => {
      if (s.current.timer || s.current.disparou) e.preventDefault();
    },
    // O toque longo já abriu o menu: o clique que vem depois dele não abre o item.
    onClickCapture: (e: React.MouseEvent) => {
      if (!s.current.disparou) return;
      s.current.disparou = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}

/** O menu, a confirmação e o aviso com Desfazer. Devolve o que pôr na tela e como abrir. */
export function useMenuDoItem({ nome, onEditar, apagar }: { nome: string; onEditar: () => void; apagar?: ApagarDoItem }) {
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [pendente, iniciar] = useTransition();

  const abrirNoBotao = useCallback((el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPonto({ x: r.right, y: r.bottom + 6, acima: r.top - 6 });
  }, []);
  const segurar = useSegurar(setPonto);

  const apagarAgora = () => {
    if (!apagar) return;
    iniciar(async () => {
      const r = await apagar.acao();
      if (!r.ok) return showError(r.erro);
      setConfirmar(false);
      const recibo = r.desfazer;
      showToast(
        apagar.aviso,
        recibo
          ? {
              label: "Desfazer",
              onClick: async () => {
                const v = await apagar.desfazer(recibo);
                if (!v.ok) return showError(v.erro);
                showToast("Desfeito");
                router.refresh();
              },
            }
          : undefined,
      );
      apagar.depois?.();
      router.refresh();
    });
  };

  const camadas = (
    <>
      {ponto && (
        <MenuFlutuante
          ponto={ponto}
          nome={nome}
          onFechar={() => setPonto(null)}
          onEditar={() => {
            setPonto(null);
            onEditar();
          }}
          onApagar={
            apagar
              ? () => {
                  setPonto(null);
                  setConfirmar(true);
                }
              : undefined
          }
        />
      )}
      {apagar && (
        <Modal open={confirmar} onClose={() => !pendente && setConfirmar(false)} title={apagar.titulo}>
          <div className="flex flex-col gap-4">
            <p className="text-center text-[15px] leading-snug text-ink-muted">{apagar.texto}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={pendente} onClick={() => setConfirmar(false)} className="min-h-12 rounded-full border border-border bg-surface-2 px-4 text-[15px] font-medium text-ink disabled:opacity-60">
                Cancelar
              </button>
              <button
                type="button"
                disabled={pendente}
                onClick={apagarAgora}
                data-apagar
                className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-danger-soft px-4 text-[15px] font-semibold text-danger disabled:opacity-60"
              >
                <Trash2 size={17} strokeWidth={1.8} aria-hidden />
                {pendente ? "Apagando…" : "Apagar"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );

  return { abrirNoBotao, segurar, camadas };
}

/** O "…" de 44 px. A cor vem de quem usa (vidro na foto, tinta no canhoto escuro). */
export function BotaoMais({ nome, onAbrir, className = "" }: { nome: string; onAbrir: (el: HTMLElement) => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={`Mais opções de ${nome}`}
      aria-haspopup="menu"
      data-menu-do-item
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onAbrir(e.currentTarget);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full ${className}`}
    >
      <MoreHorizontal size={20} strokeWidth={2} aria-hidden />
    </button>
  );
}

function MenuFlutuante({ ponto, nome, onFechar, onEditar, onApagar }: { ponto: Ponto; nome: string; onFechar: () => void; onEditar: () => void; onApagar?: () => void }) {
  const primeiro = useRef<HTMLButtonElement>(null);
  const [tela, setTela] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mede a janela uma vez, ao abrir
    setTela({ w: window.innerWidth, h: window.innerHeight });
    primeiro.current?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    window.addEventListener("scroll", onFechar, { passive: true, capture: true });
    window.addEventListener("resize", onFechar);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", onFechar, { capture: true });
      window.removeEventListener("resize", onFechar);
    };
  }, [onFechar]);

  if (!tela) return null;
  const altura = onApagar ? ALTURA : ALTURA / 2 + 8;
  // Alinhado pela direita do dedo ou do "…", sempre dentro da tela (de 320 px para cima).
  const left = Math.min(Math.max(8, ponto.x - LARGURA), tela.w - LARGURA - 8);
  const cabeEmbaixo = ponto.y + altura <= tela.h - 16;
  const top = cabeEmbaixo ? ponto.y : Math.max(8, ponto.acima - altura);
  const item = "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3.5 text-left text-[15px] font-medium text-ink hover:bg-surface-2 focus-visible:bg-surface-2 outline-none";

  return createPortal(
    <div className="fixed inset-0 z-[110]">
      <button type="button" aria-hidden tabIndex={-1} onClick={onFechar} onContextMenu={(e) => e.preventDefault()} className="absolute inset-0 cursor-default" />
      <div
        role="menu"
        aria-label={`Opções de ${nome}`}
        style={{ top, left, width: LARGURA }}
        className="absolute flex animate-fade-in flex-col gap-0.5 rounded-[20px] border border-border bg-surface p-1.5 shadow-premium"
      >
        <button ref={primeiro} type="button" role="menuitem" onClick={onEditar} className={item}>
          <Pencil size={18} strokeWidth={1.8} className="text-ink-muted" aria-hidden />
          Editar
        </button>
        {onApagar && (
          <button type="button" role="menuitem" onClick={onApagar} className={item}>
            <Trash2 size={18} strokeWidth={1.8} className="text-danger" aria-hidden />
            Apagar
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Um item da lista com o "…" no canto e o tocar e segurar. `botao` posiciona o "…". */
export function ItemComMenu({
  nome,
  onEditar,
  apagar,
  className = "",
  botao = "",
  style,
  children,
}: {
  nome: string;
  onEditar: () => void;
  apagar?: ApagarDoItem;
  className?: string;
  botao?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const { abrirNoBotao, segurar, camadas } = useMenuDoItem({ nome, onEditar, apagar });
  // As camadas (menu e confirmação) ficam FORA do item: evento de portal sobe pela árvore do React,
  // e o toque no menu não pode virar outro "segurar" nem ter o clique engolido.
  return (
    <>
      <div {...segurar} style={style} className={`relative select-none [-webkit-touch-callout:none] ${className}`}>
        {children}
        <BotaoMais nome={nome} onAbrir={abrirNoBotao} className={`absolute z-[2] ${botao}`} />
      </div>
      {camadas}
    </>
  );
}
