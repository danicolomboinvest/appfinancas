"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { GripHorizontal, Pencil, Plus, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { salvarResumoAction } from "./actions";

/**
 * O Resumo que a pessoa monta (15/10/2026). "Editar" faz os cartões tremerem, como na tela do
 * iPhone: o botão de dois tracinhos arrasta, o X tira e "Adicionar cartão" traz de volta o que
 * saiu. "Pronto" guarda. Fora da edição os cartões são os de sempre, cada um com o próprio toque.
 *
 * A sugestão e o acerto do Nós dois não são cartões: vêm em `depoisDoPrimeiro`, logo abaixo do
 * primeiro cartão, onde o herói sempre os teve.
 */
export type CartaoNaTela = {
  id: string;
  nome: string;
  desc: string;
  node: ReactNode;
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
  const ordemSalva = useRef(ordemInicial.join("|"));
  const arrasto = useRef<{ id: string; gx: number; gy: number } | null>(null);
  const ponteiro = useRef({ x: 0, y: 0 });
  const itens = useRef(new Map<string, HTMLDivElement>());

  const visiveis = ordem.filter((id) => porId.has(id));
  const fora = cartoes.filter((c) => !ordem.includes(c.id));
  const foraSemMeta = fora.filter((c) => c.grupo !== "meta");
  const metasFora = fora.filter((c) => c.grupo === "meta");

  function pronto() {
    setEditando(false);
    const atual = visiveis.join("|");
    if (atual === ordemSalva.current) return;
    ordemSalva.current = atual;
    comecar(async () => {
      await salvarResumoAction(visiveis);
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
    el.style.transform = `translate(${tx}px, ${ty}px) scale(1.03)`;
  }
  useLayoutEffect(() => {
    if (arrasto.current) segue();
  }, [ordem]);

  function comecaArrasto(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    const el = itens.current.get(id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    ponteiro.current = { x: e.clientX, y: e.clientY };
    arrasto.current = { id, gx: e.clientX - (r.left + r.width / 2), gy: e.clientY - (r.top + r.height / 2) };
    e.currentTarget.setPointerCapture(e.pointerId);
    el.dataset.arrastando = "true";
    e.preventDefault();
  }
  function moveArrasto(e: React.PointerEvent<HTMLButtonElement>) {
    const a = arrasto.current;
    if (!a) return;
    ponteiro.current = { x: e.clientX, y: e.clientY };
    const alvo = visiveis.find((id) => {
      if (id === a.id) return false;
      const r = itens.current.get(id)?.getBoundingClientRect();
      return !!r && e.clientY > r.top && e.clientY < r.bottom && e.clientX > r.left && e.clientX < r.right;
    });
    if (alvo) {
      setOrdem((atual) => {
        const sem = atual.filter((id) => id !== a.id);
        const i = sem.indexOf(alvo);
        const antes = atual.indexOf(a.id) > atual.indexOf(alvo);
        sem.splice(antes ? i : i + 1, 0, a.id);
        return sem;
      });
    }
    segue();
  }
  function soltaArrasto() {
    const a = arrasto.current;
    if (!a) return;
    const el = itens.current.get(a.id);
    if (el) {
      el.style.transform = "";
      delete el.dataset.arrastando;
    }
    arrasto.current = null;
  }

  // Sair da tela no meio da edição não deixa o corpo preso sem rolar.
  useEffect(() => () => soltaArrasto(), []);

  return (
    <div className="flex min-w-0 flex-col gap-5" data-resumo-editavel={editando ? "editando" : "normal"}>
      <div className="flex min-h-11 items-center justify-between gap-3 px-1">
        {editando ? (
          <>
            <span className="titulo-tema text-[1.25rem] font-normal leading-tight text-ink">Meu Resumo</span>
            <button type="button" onClick={pronto} className="inline-flex min-h-11 items-center rounded-full bg-accent-gradient px-6 text-[15px] font-semibold text-on-accent">
              Pronto
            </button>
          </>
        ) : (
          <>
            <span />
            <button type="button" onClick={() => setEditando(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-[14px] font-semibold text-ink" data-editar-resumo>
              <Pencil size={15} aria-hidden />
              Editar
            </button>
          </>
        )}
      </div>

      <div className="grid grid-flow-dense grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-4 lg:gap-x-6">
        {visiveis.map((id, i) => {
          const c = porId.get(id)!;
          const largo = c.tam === "l";
          return (
            <Fragment key={id}>
              <div className={largo ? "col-span-2" : "col-span-1"}>
                <div
                  ref={(el) => {
                    if (el) itens.current.set(id, el);
                    else itens.current.delete(id);
                  }}
                  className={`relative flex h-full flex-col rounded-3xl ${editando ? "resumo-treme touch-none data-[arrastando=true]:z-10 data-[arrastando=true]:shadow-2xl" : ""}`}
                  data-cartao-resumo={id}
                >
                  {editando && (
                    <div className="mb-2 flex justify-end gap-2">
                      <button
                        type="button"
                        aria-label={`Arrastar ${c.nome}`}
                        className={`${BOTAO_PEQUENO} cursor-grab touch-none`}
                        onPointerDown={(e) => comecaArrasto(e, id)}
                        onPointerMove={moveArrasto}
                        onPointerUp={soltaArrasto}
                        onPointerCancel={soltaArrasto}
                      >
                        <GripHorizontal size={17} aria-hidden />
                      </button>
                      <button type="button" aria-label={`Tirar ${c.nome} do Resumo`} className={BOTAO_PEQUENO} onClick={() => setOrdem((atual) => atual.filter((x) => x !== id))}>
                        <X size={17} aria-hidden />
                      </button>
                    </div>
                  )}
                  <div className={`min-h-0 flex-1 ${editando ? "pointer-events-none select-none" : ""}`}>{c.node}</div>
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
