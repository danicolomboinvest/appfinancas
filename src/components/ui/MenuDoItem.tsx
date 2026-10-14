"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
  const fecharMenu = useCallback(() => setPonto(null), []);

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
          onFechar={fecharMenu}
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
      {apagar && confirmar && <FolhaDeApagar titulo={apagar.titulo} texto={apagar.texto} pendente={pendente} onCancelar={() => !pendente && setConfirmar(false)} onApagar={apagarAgora} />}
    </>
  );

  return { abrirNoBotao, segurar, camadas };
}

/**
 * A confirmação curta: a pergunta com o nome inteiro (quebra linha, nunca corta), uma frase do
 * que acontece com o resto e os dois botões. Sem X: o Cancelar e o fundo fecham.
 */
function FolhaDeApagar({ titulo, texto, pendente, onCancelar, onApagar }: { titulo: string; texto: string; pendente: boolean; onCancelar: () => void; onApagar: () => void }) {
  const cancelar = useRef<HTMLButtonElement>(null);
  const fechar = useRef(onCancelar);
  useEffect(() => {
    fechar.current = onCancelar;
  });
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    cancelar.current?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar.current();
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("keydown", tecla);
      anterior?.focus?.({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-hidden tabIndex={-1} onClick={onCancelar} className="fixed inset-0 bg-black/50" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="apagar-titulo"
        aria-describedby="apagar-texto"
        className="relative z-10 flex w-full max-w-md animate-fade-in flex-col gap-4 rounded-t-[28px] border border-border bg-surface px-5 pb-[calc(1.25rem+var(--safe-bottom))] pt-3 shadow-premium sm:rounded-[28px] sm:pb-5 sm:pt-5"
      >
        <span className="mx-auto h-1 w-10 rounded-full bg-border-strong sm:hidden" aria-hidden />
        <div className="flex flex-col gap-1.5 text-center">
          <h2 id="apagar-titulo" className="break-words text-lg font-semibold leading-snug text-ink">
            {titulo}
          </h2>
          <p id="apagar-texto" className="text-[15px] leading-snug text-ink-muted">
            {texto}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button ref={cancelar} type="button" disabled={pendente} onClick={onCancelar} className="min-h-12 rounded-full border border-border bg-surface-2 px-3 text-[15px] font-medium text-ink disabled:opacity-60">
            Cancelar
          </button>
          <button type="button" disabled={pendente} onClick={onApagar} data-apagar className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-danger-soft px-3 text-[15px] font-semibold text-danger disabled:opacity-60">
            <Trash2 size={17} strokeWidth={1.8} aria-hidden />
            {pendente ? "Apagando…" : "Apagar"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** O "…" de 44 px. A cor vem de quem usa (vidro na foto, tinta no canhoto escuro). */
export function BotaoMais({ nome, onAbrir, className = "", miolo = "" }: { nome: string; onAbrir: (el: HTMLElement) => void; className?: string; miolo?: string }) {
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
      <span className={`flex size-8 items-center justify-center rounded-full ${miolo}`}>
        <MoreHorizontal size={20} strokeWidth={2} aria-hidden />
      </span>
    </button>
  );
}

function MenuFlutuante({ ponto, nome, onFechar, onEditar, onApagar }: { ponto: Ponto; nome: string; onFechar: () => void; onEditar: () => void; onApagar?: () => void }) {
  const primeiro = useRef<HTMLButtonElement>(null);
  const [tela, setTela] = useState<{ w: number; h: number } | null>(null);
  const tocou = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mede a janela uma vez, ao abrir
    setTela({ w: window.innerWidth, h: window.innerHeight });
    primeiro.current?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    // Só a rolagem da página (sem capture): carrossel que rola sozinho por dentro não fecha o menu.
    window.addEventListener("scroll", onFechar, { passive: true });
    window.addEventListener("resize", onFechar);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", onFechar);
      window.removeEventListener("resize", onFechar);
    };
  }, [onFechar]);

  if (!tela) return null;
  // Depois do tocar e segurar, o dedo sai da tela já com o menu aberto e o navegador manda um
  // clique para o que está embaixo dele (o fundo, que fecharia o menu na hora). Só vale clique que
  // começou dentro do menu, ou o do teclado (detail 0).
  const valeu = (e: React.MouseEvent) => tocou.current || e.detail === 0;
  const altura = onApagar ? ALTURA : ALTURA / 2 + 8;
  // Alinhado pela direita do dedo ou do "…", sempre dentro da tela (de 320 px para cima).
  const left = Math.min(Math.max(8, ponto.x - LARGURA), tela.w - LARGURA - 8);
  const cabeEmbaixo = ponto.y + altura <= tela.h - 16;
  const top = cabeEmbaixo ? ponto.y : Math.max(8, ponto.acima - altura);
  const item = "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3.5 text-left text-[15px] font-medium text-ink hover:bg-surface-2 focus-visible:bg-surface-2 outline-none";

  return createPortal(
    <div className="fixed inset-0 z-[110]" onPointerDownCapture={() => (tocou.current = true)}>
      <button type="button" aria-hidden tabIndex={-1} onClick={(e) => valeu(e) && onFechar()} onContextMenu={(e) => e.preventDefault()} className="absolute inset-0 cursor-default" />
      <div
        role="menu"
        aria-label={`Opções de ${nome}`}
        style={{ top, left, width: LARGURA }}
        className="absolute flex animate-fade-in flex-col gap-0.5 rounded-[20px] border border-border bg-surface p-1.5 shadow-premium"
      >
        <button ref={primeiro} type="button" role="menuitem" onClick={(e) => valeu(e) && onEditar()} className={item}>
          <Pencil size={18} strokeWidth={1.8} className="text-ink-muted" aria-hidden />
          Editar
        </button>
        {onApagar && (
          <button type="button" role="menuitem" onClick={(e) => valeu(e) && onApagar()} className={item}>
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
  miolo,
  style,
  children,
}: {
  nome: string;
  onEditar: () => void;
  apagar?: ApagarDoItem;
  className?: string;
  botao?: string;
  /** O círculo de dentro do "…" (a área de toque continua 44 px). */
  miolo?: string;
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
        <BotaoMais nome={nome} onAbrir={abrirNoBotao} className={`absolute z-[2] ${botao}`} miolo={miolo} />
      </div>
      {camadas}
    </>
  );
}
