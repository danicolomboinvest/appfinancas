"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GripHorizontal, Plus, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { salvarResumoAction } from "./actions";

/**
 * O Resumo que a pessoa monta (15/10/2026). "Editar" faz os cartões tremerem, como na tela do
 * iPhone: segurar o cartão (ou o botão de dois tracinhos) arrasta, o X tira e "Adicionar cartão" traz de volta o que
 * saiu. "Pronto" guarda. Fora da edição os cartões são os de sempre, cada um com o próprio toque.
 *
 * A sugestão e o acerto do Nós dois não são cartões: vêm em `depoisDoPrimeiro`, logo abaixo do
 * primeiro cartão, onde o herói sempre os teve.
 */
export type CartaoNaTela = {
  id: string;
  nome: string;
  desc: string;
  /** Nulo: o cartão ainda não carregou o dado (o pesado só carrega depois do "Pronto"). */
  node: ReactNode | null;
  /** "l" é o cartão largo de sempre; "q" é o quadradinho colorido (dois por linha). */
  tam: "l" | "q";
  /** As metas viram um só item na folha de adicionar: a pessoa escolhe qual. */
  grupo?: "meta";
};

const BOTAO_PEQUENO = "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-md";

export function ResumoEditavel({
  cartoes,
  ordemInicial,
  depoisDoPrimeiro,
}: {
  cartoes: CartaoNaTela[];
  ordemInicial: string[];
  depoisDoPrimeiro?: ReactNode;
}) {
  const porId = new Map(cartoes.map((c) => [c.id, c]));
  const [ordem, setOrdem] = useState<string[]>(() => ordemInicial.filter((id) => porId.has(id)));
  const [editando, setEditando] = useState(false);
  const [folha, setFolha] = useState(false);
  const [escolhendoMeta, setEscolhendoMeta] = useState(false);
  const [, comecar] = useTransition();
  const router = useRouter();
  const ordemSalva = useRef(ordemInicial.join("|"));
  const arrasto = useRef<{ id: string; gx: number; gy: number } | null>(null);
  const ponteiro = useRef({ x: 0, y: 0 });
  const itens = useRef(new Map<string, HTMLDivElement>());
  const lugares = useRef(new Map<string, HTMLDivElement>());
  const grade = useRef<HTMLDivElement>(null);
  const antes = useRef(new Map<string, { x: number; y: number }>());
  const segurando = useRef<{ id: string; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const ultimaTroca = useRef(0);
  const rolagem = useRef<{ el: HTMLElement | null; raf: number }>({ el: null, raf: 0 });
  const jaTentouCarregar = useRef(false);

  const visiveis = ordem.filter((id) => porId.has(id));
  const fora = cartoes.filter((c) => !ordem.includes(c.id));
  const foraSemMeta = fora.filter((c) => c.grupo !== "meta");
  const metasFora = fora.filter((c) => c.grupo === "meta");

  function pronto() {
    setEditando(false);
    const atual = visiveis.join("|");
    if (atual === ordemSalva.current) return;
    ordemSalva.current = atual;
    const faltaCarregar = visiveis.some((id) => porId.get(id)?.node == null);
    comecar(async () => {
      await salvarResumoAction(visiveis);
      if (faltaCarregar) router.refresh();
    });
  }

  // O cartão arrastado segue o dedo mesmo depois de a lista trocar de lugar.
  function segue() {
    const a = arrasto.current;
    const el = a ? itens.current.get(a.id) : null;
    if (!a || !el) return;
    el.style.transform = "";
    const r = el.getBoundingClientRect();
    const tx = ponteiro.current.x - a.gx - (r.left + r.width / 2);
    const ty = ponteiro.current.y - a.gy - (r.top + r.height / 2);
    el.style.transform = `translate(${tx}px, ${ty}px) scale(1.04)`;
  }

  // Os vizinhos deslizam até o lugar novo (FLIP): medem onde estavam, onde estão e voltam andando.
  // Usa a propriedade `translate`, que convive com o tremor (que usa `transform`).
  useLayoutEffect(() => {
    const g = grade.current?.getBoundingClientRect();
    if (!g) return;
    const agora = new Map<string, { x: number; y: number }>();
    lugares.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      agora.set(id, { x: r.left - g.left, y: r.top - g.top });
    });
    if (editando) {
      agora.forEach((p, id) => {
        const velho = antes.current.get(id);
        const el = itens.current.get(id);
        if (!velho || !el || id === arrasto.current?.id) return;
        const dx = velho.x - p.x;
        const dy = velho.y - p.y;
        if (!dx && !dy) return;
        el.style.transition = "none";
        el.style.translate = `${dx}px ${dy}px`;
        void el.offsetWidth;
        el.style.transition = "translate 220ms cubic-bezier(.2,.8,.2,1)";
        el.style.translate = "0 0";
      });
    }
    antes.current = agora;
    if (arrasto.current) segue();
  }, [ordem, editando]);

  function paraDeRolar() {
    cancelAnimationFrame(rolagem.current.raf);
    rolagem.current.raf = 0;
  }
  function roladorDe(el: HTMLElement | null): HTMLElement | null {
    for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p;
    }
    return null;
  }
  // Perto da borda de cima ou de baixo a tela rola sozinha, para dar para levar o cartão longe.
  function rolaSozinho() {
    if (rolagem.current.raf) return;
    const passo = (agoraMs: number) => {
      if (!arrasto.current) {
        rolagem.current.raf = 0;
        return;
      }
      const el = rolagem.current.el;
      const topo = el ? el.getBoundingClientRect().top : 0;
      const base = el ? el.getBoundingClientRect().bottom : window.innerHeight;
      const y = ponteiro.current.y;
      const zona = 90;
      const v = y < topo + zona ? -Math.min(16, (topo + zona - y) / 5) : y > base - zona ? Math.min(16, (y - (base - zona)) / 5) : 0;
      if (v) {
        if (el) el.scrollTop += v;
        else window.scrollBy(0, v);
        segue();
        trocaSePrecisar(agoraMs);
      }
      rolagem.current.raf = requestAnimationFrame(passo);
    };
    rolagem.current.raf = requestAnimationFrame(passo);
  }

  function trocaSePrecisar(agoraMs: number) {
    const a = arrasto.current;
    if (!a || agoraMs - ultimaTroca.current < 140) return;
    const { x, y } = ponteiro.current;
    // Só conta quando o dedo entra no miolo do outro cartão: evita o vai e volta entre tamanhos diferentes.
    const alvo = visiveis.find((id) => {
      if (id === a.id) return false;
      const r = lugares.current.get(id)?.getBoundingClientRect();
      if (!r) return false;
      const mx = r.width * 0.2;
      const my = r.height * 0.2;
      return y > r.top + my && y < r.bottom - my && x > r.left + mx && x < r.right - mx;
    });
    if (!alvo) return;
    ultimaTroca.current = agoraMs;
    setOrdem((atual) => {
      const sem = atual.filter((id) => id !== a.id);
      const i = sem.indexOf(alvo);
      const vindoDeBaixo = atual.indexOf(a.id) > atual.indexOf(alvo);
      sem.splice(vindoDeBaixo ? i : i + 1, 0, a.id);
      return sem;
    });
  }

  function levanta(id: string) {
    const el = itens.current.get(id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.transition = "none";
    el.style.translate = "";
    arrasto.current = { id, gx: ponteiro.current.x - (r.left + r.width / 2), gy: ponteiro.current.y - (r.top + r.height / 2) };
    el.dataset.arrastando = "true";
    rolagem.current.el = roladorDe(el);
    if (typeof navigator !== "undefined") navigator.vibrate?.(12);
    segue();
    rolaSozinho();
  }

  function comecaToque(e: React.PointerEvent<HTMLDivElement>, id: string) {
    if (!editando || (e.pointerType === "mouse" && e.button !== 0)) return;
    if ((e.target as HTMLElement).closest("[data-sem-arrasto]")) return;
    ponteiro.current = { x: e.clientX, y: e.clientY };
    const direto = !!(e.target as HTMLElement).closest("[data-alca]");
    if (segurando.current) clearTimeout(segurando.current.timer);
    const alvo = e.currentTarget;
    const pid = e.pointerId;
    const pega = () => {
      segurando.current = null;
      try {
        alvo.setPointerCapture(pid);
      } catch {}
      levanta(id);
    };
    if (direto) {
      segurando.current = null;
      pega();
    } else {
      segurando.current = { id, x: e.clientX, y: e.clientY, timer: setTimeout(pega, 380) };
    }
  }
  function moveToque(e: React.PointerEvent<HTMLDivElement>) {
    ponteiro.current = { x: e.clientX, y: e.clientY };
    const s = segurando.current;
    // Mexeu antes de segurar: é rolagem da página, não arrasto.
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) {
      clearTimeout(s.timer);
      segurando.current = null;
      return;
    }
    if (!arrasto.current) return;
    segue();
    trocaSePrecisar(e.timeStamp);
  }
  function soltaToque() {
    if (segurando.current) {
      clearTimeout(segurando.current.timer);
      segurando.current = null;
    }
    soltaArrasto();
  }
  function soltaArrasto() {
    paraDeRolar();
    const a = arrasto.current;
    if (!a) return;
    const el = itens.current.get(a.id);
    arrasto.current = null;
    if (el) {
      // Pousa no lugar com um deslize, em vez de estalar.
      el.style.transition = "transform 200ms cubic-bezier(.2,.8,.2,1)";
      el.style.transform = "";
      delete el.dataset.arrastando;
      setTimeout(() => {
        el.style.transition = "";
      }, 220);
    }
  }

  // Com um cartão no dedo a página não pode rolar; sem ele (dedo só passando) rola como sempre.
  useEffect(() => {
    if (!editando) return;
    const barra = (e: TouchEvent) => {
      if (arrasto.current && e.cancelable) e.preventDefault();
    };
    document.addEventListener("touchmove", barra, { passive: false });
    return () => document.removeEventListener("touchmove", barra);
  }, [editando]);

  // O lápis fica na linha do mês (SeletorDeMes). Aqui só se avisa que o Resumo editável está na tela.
  useEffect(() => {
    const abrir = () => setEditando(true);
    const aqui = () => window.dispatchEvent(new CustomEvent("spi:resumo-aqui", { detail: true }));
    window.addEventListener("spi:editar-resumo", abrir);
    window.addEventListener("spi:resumo-pergunta", aqui);
    aqui();
    return () => {
      window.removeEventListener("spi:editar-resumo", abrir);
      window.removeEventListener("spi:resumo-pergunta", aqui);
      window.dispatchEvent(new CustomEvent("spi:resumo-aqui", { detail: false }));
    };
  }, []);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("spi:resumo-editando", { detail: editando }));
    return () => {
      window.dispatchEvent(new CustomEvent("spi:resumo-editando", { detail: false }));
    };
  }, [editando]);

  // Um cartão sem número fora da edição não é para ficar parado: pede o dado uma vez.
  const algumSemNumero = visiveis.some((id) => porId.get(id)?.node == null);
  useEffect(() => {
    if (editando || !algumSemNumero || jaTentouCarregar.current) return;
    jaTentouCarregar.current = true;
    router.refresh();
  }, [editando, algumSemNumero, router]);

  // Sair da tela no meio da edição não deixa o corpo preso sem rolar.
  useEffect(
    () => () => {
      if (segurando.current) clearTimeout(segurando.current.timer);
      soltaArrasto();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="flex min-w-0 flex-col gap-5" data-resumo-editavel={editando ? "editando" : "normal"}>
      {editando && (
        <div className="flex min-h-11 items-center justify-between gap-3 px-1">
          <span className="titulo-tema text-[1.25rem] font-normal leading-tight text-ink">Meu Resumo</span>
          <button type="button" onClick={pronto} className="inline-flex min-h-11 items-center rounded-full bg-accent-gradient px-6 text-[15px] font-semibold text-on-accent">
            Pronto
          </button>
        </div>
      )}

      <div ref={grade} className="grid grid-flow-dense grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-4 lg:gap-x-6">
        {visiveis.map((id, i) => {
          const c = porId.get(id)!;
          const largo = c.tam === "l";
          return (
            <Fragment key={id}>
              <div
                className={largo ? "col-span-2" : "col-span-1"}
                ref={(el) => {
                  if (el) lugares.current.set(id, el);
                  else lugares.current.delete(id);
                }}
              >
                <div
                  ref={(el) => {
                    if (el) itens.current.set(id, el);
                    else itens.current.delete(id);
                  }}
                  className={`relative flex h-full flex-col rounded-3xl ${editando ? "resumo-treme touch-pan-y select-none [-webkit-touch-callout:none] data-[arrastando=true]:z-10 data-[arrastando=true]:shadow-2xl" : ""}`}
                  data-cartao-resumo={id}
                  onPointerDown={editando ? (e) => comecaToque(e, id) : undefined}
                  onPointerMove={editando ? moveToque : undefined}
                  onPointerUp={editando ? soltaToque : undefined}
                  onPointerCancel={editando ? soltaToque : undefined}
                  onContextMenu={editando ? (e) => e.preventDefault() : undefined}
                >
                  {editando && (
                    <div className="mb-2 flex justify-end gap-2">
                      <button
                        type="button"
                        aria-label={`Arrastar ${c.nome}`}
                        data-alca
                        className={`${BOTAO_PEQUENO} cursor-grab touch-none`}
                      >
                        <GripHorizontal size={17} aria-hidden />
                      </button>
                      <button type="button" data-sem-arrasto aria-label={`Tirar ${c.nome} do Resumo`} className={BOTAO_PEQUENO} onClick={() => setOrdem((atual) => atual.filter((x) => x !== id))}>
                        <X size={17} aria-hidden />
                      </button>
                    </div>
                  )}
                  <div className={`min-h-0 flex-1 ${editando ? "pointer-events-none select-none" : ""}`}>{c.node ?? <Esperando nome={c.nome} editando={editando} />}</div>
                </div>
              </div>
              {i === 0 && depoisDoPrimeiro && !editando ? <div className="col-span-2 flex flex-col gap-5 lg:col-span-4">{depoisDoPrimeiro}</div> : null}
            </Fragment>
          );
        })}
        {visiveis.length === 0 && depoisDoPrimeiro && !editando ? <div className="col-span-2 flex flex-col gap-5 lg:col-span-4">{depoisDoPrimeiro}</div> : null}
        {editando && visiveis.length === 0 ? <p className="col-span-2 rounded-3xl border border-dashed border-border px-4 py-6 text-center text-[14px] text-ink-muted lg:col-span-4">Nenhum cartão aqui. Toque em adicionar.</p> : null}
      </div>

      {editando && (
        <button
          type="button"
          onClick={() => setFolha(true)}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-3xl border-[1.5px] border-dashed border-accent bg-surface px-4 text-[15px] font-semibold text-accent-strong"
        >
          <Plus size={18} aria-hidden />
          Adicionar cartão
        </button>
      )}

      <Modal
        open={folha}
        onClose={() => {
          setFolha(false);
          setEscolhendoMeta(false);
        }}
        title={escolhendoMeta ? "Qual meta?" : "Adicionar ao Resumo"}
      >
        <div className="flex flex-col gap-2">
          {escolhendoMeta ? (
            metasFora.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setOrdem((atual) => [...atual, c.id]);
                  setFolha(false);
                  setEscolhendoMeta(false);
                }}
                className="flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-2xl bg-surface-2 px-4 py-3 text-left"
              >
                <span className="text-[15px] font-semibold text-ink">{c.nome}</span>
                <span className="text-[13px] text-ink-muted">{c.desc}</span>
              </button>
            ))
          ) : (
            <>
              {foraSemMeta.length === 0 && metasFora.length === 0 ? <p className="py-4 text-center text-[14px] text-ink-muted">Você já adicionou todos os cartões.</p> : null}
              {foraSemMeta.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setOrdem((atual) => [...atual, c.id]);
                    setFolha(false);
                  }}
                  className="flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-2xl bg-surface-2 px-4 py-3 text-left"
                >
                  <span className="text-[15px] font-semibold text-ink">{c.nome}</span>
                  <span className="text-[13px] text-ink-muted">{c.desc}</span>
                </button>
              ))}
              {metasFora.length > 0 ? (
                <button type="button" onClick={() => setEscolhendoMeta(true)} className="flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-2xl bg-surface-2 px-4 py-3 text-left">
                  <span className="text-[15px] font-semibold text-ink">Uma meta</span>
                  <span className="text-[13px] text-ink-muted">Você escolhe qual</span>
                </button>
              ) : null}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

/**
 * O cartão que ainda não tem número. Na edição, quando a pessoa acabou de ligá-lo, diz que o número vem
 * depois do "Pronto". Fora da edição nunca fala em "Pronto" (a pessoa já tocou): mostra uma
 * barrinha de carregando enquanto o dado chega.
 */
function Esperando({ nome, editando }: { nome: string; editando: boolean }) {
  return (
    <div className="flex h-full min-h-[8.5rem] flex-col justify-center gap-2 rounded-3xl bg-surface-2 p-3.5" aria-busy={!editando}>
      <span className="text-[13px] font-semibold text-ink">{nome}</span>
      {editando ? (
        <span className="text-[12.5px] leading-snug text-ink">O número aparece quando você tocar em Pronto.</span>
      ) : (
        <span className="h-6 w-2/3 animate-pulse rounded-full bg-border-strong" aria-label="Carregando" />
      )}
    </div>
  );
}
