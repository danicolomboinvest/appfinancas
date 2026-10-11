"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import type { GoalIcon } from "@prisma/client";
import { useToast } from "@/components/ui/toast-context";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { MESES_CURTOS, MESES_LONGOS, duracao, mesesAteChegar, porMesDaNovaMeta, TAXA_PADRAO_DAS_METAS } from "@/lib/metas/projecao";
import { TIPOS_DE_META, fotoDoTipo, fotosEmOrdem, tipoDoNome } from "@/lib/metas/tipos";
import { apagarMetaAction, criarMetaAction, editarMetaAction, enviarFotoDaMetaAction, type MetaGuiada } from "./acoes";

/**
 * A nova meta guiada (protótipo #nova-meta, rodadas 4, 12 e 32): uma pergunta por tela, em cinco
 * passos. Para que é (18 tipos), quanto, para quando (atalhos ou calendário até 2080, ou sem
 * prazo), a foto (do banco ou "Usar uma minha") e a revelação com o cartão pronto e quanto
 * guardar por mês. A mesma folha edita uma meta que já existe.
 */

export type MetaParaEditar = {
  id: string;
  nome: string;
  tipo: GoalIcon;
  alvo: number;
  guardado: number;
  /** "2027-10" ou nulo. */
  prazo: string | null;
  foto: string;
  combinado: number;
  taxaAnual: number;
};

type Contexto = { abrir: (meta?: MetaParaEditar) => void };
const FolhaContexto = createContext<Contexto>({ abrir: () => {} });
export const useFolhaDaMeta = () => useContext(FolhaContexto);

export function ProvedorDaFolhaDaMeta({ hoje, children }: { hoje: { ano: number; mes: number; dia: number }; children: ReactNode }) {
  const [aberta, setAberta] = useState<{ meta?: MetaParaEditar; chave: number } | null>(null);
  const abrir = useCallback((meta?: MetaParaEditar) => setAberta({ meta, chave: Date.now() }), []);
  const valor = useMemo(() => ({ abrir }), [abrir]);
  return (
    <FolhaContexto.Provider value={valor}>
      {children}
      {aberta && <FolhaDaMeta key={aberta.chave} hoje={hoje} meta={aberta.meta} onFechar={() => setAberta(null)} />}
    </FolhaContexto.Provider>
  );
}

/** Botão que abre a folha (nova, ou editando a meta passada). */
export function AbrirFolhaDaMeta({ meta, className, children, rotulo }: { meta?: MetaParaEditar; className?: string; children: ReactNode; rotulo?: string }) {
  const { abrir } = useFolhaDaMeta();
  return (
    <button type="button" aria-haspopup="dialog" aria-label={rotulo} className={className} onClick={() => abrir(meta)}>
      {children}
    </button>
  );
}

type Estado = {
  passo: 1 | 2 | 3 | 4 | 5;
  nome: string;
  tipo: GoalIcon | null;
  alvo: number;
  prazo: { ano: number; mes: number };
  semPrazo: boolean;
  calendario: boolean;
  anos: boolean;
  /** Foto do banco escolhida ("/fotos/metas/...") ou a dela (url da rota autenticada). */
  foto: string | null;
  minha: string | null;
  porMes: number;
};

const ATALHOS: [number, string][] = [
  [1, "1 ano"],
  [3, "3 anos"],
  [5, "5 anos"],
  [10, "10 anos"],
  [20, "20 anos"],
];

/** Reduz a foto no aparelho antes de subir: lado maior até 1280 px, JPEG. */
async function reduzirFoto(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error("foto"))), "image/jpeg", 0.82));
}

function FolhaDaMeta({ hoje, meta, onFechar }: { hoje: { ano: number; mes: number; dia: number }; meta?: MetaParaEditar; onFechar: () => void }) {
  const money = useMoney();
  const simbolo = currencySymbol(useCurrency());
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [pendente, iniciar] = useTransition();
  const [enviando, setEnviando] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const hojeMi = hoje.ano * 12 + (hoje.mes - 1);
  const [e, setE] = useState<Estado>(() => {
    if (meta) {
      const [a, mm] = meta.prazo ? meta.prazo.split("-").map(Number) : [hoje.ano + 1, hoje.mes];
      const doBanco = meta.foto.startsWith("/fotos/");
      return { passo: 1, nome: meta.nome, tipo: meta.tipo, alvo: meta.alvo, prazo: { ano: a, mes: mm - 1 }, semPrazo: !meta.prazo, calendario: false, anos: false, foto: doBanco ? meta.foto : null, minha: doBanco ? null : meta.foto, porMes: Math.max(50, Math.round(meta.combinado / 50) * 50 || 500) };
    }
    return { passo: 1, nome: "", tipo: null, alvo: 0, prazo: { ano: hoje.ano + 1, mes: hoje.mes - 1 }, semPrazo: false, calendario: false, anos: false, foto: null, minha: null, porMes: 500 };
  });
  const corpo = useRef<HTMLDivElement>(null);
  const muda = (p: Partial<Estado>) => setE((x) => ({ ...x, ...p }));
  const tipo = e.tipo ?? tipoDoNome(e.nome);
  const prazoData = new Date(e.prazo.ano, e.prazo.mes, 1, 12);
  const hojeData = new Date(hoje.ano, hoje.mes - 1, hoje.dia);
  const mesesAte = Math.max(1, e.prazo.ano * 12 + e.prazo.mes - hojeMi);
  const taxa = meta?.taxaAnual ?? TAXA_PADRAO_DAS_METAS;
  const guardado = meta?.guardado ?? 0;
  const pmt = e.alvo > 0 ? porMesDaNovaMeta(e.alvo, prazoData, hojeData, taxa, guardado) : 0;
  const fotoFinal = e.minha ?? e.foto ?? fotoDoTipo(tipo);

  useEffect(() => {
    const esc = (ev: KeyboardEvent) => ev.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = antes;
    };
  }, [onFechar]);

  useEffect(() => {
    corpo.current?.scrollTo({ top: 0 });
  }, [e.passo]);

  const vai = (passo: Estado["passo"]) => {
    if (passo === 4 && !e.foto && !e.minha) muda({ passo, foto: fotoDoTipo(tipo) });
    else muda({ passo });
  };

  function salvar() {
    const dados: MetaGuiada = {
      nome: e.nome.trim(),
      tipo,
      alvo: e.alvo,
      prazo: e.semPrazo ? null : `${e.prazo.ano}-${String(e.prazo.mes + 1).padStart(2, "0")}`,
      porMes: e.porMes,
      foto: e.minha ?? e.foto,
    };
    iniciar(async () => {
      if (meta) {
        const r = await editarMetaAction(meta.id, dados);
        if (!r.ok) return showError(r.error);
        showToast("Meta atualizada");
        onFechar();
        router.refresh();
        return;
      }
      const r = await criarMetaAction(dados);
      if (!r.ok) return showError(r.error);
      showToast("Meta criada");
      onFechar();
      router.push(`/planejamento/metas?nova=${r.id}`);
      router.refresh();
    });
  }

  function apagar() {
    if (!meta) return;
    if (!confirmarApagar) return setConfirmarApagar(true);
    iniciar(async () => {
      const r = await apagarMetaAction(meta.id);
      if (!r.ok) return showError(r.error);
      showToast("Meta apagada");
      onFechar();
      router.push("/planejamento/metas");
      router.refresh();
    });
  }

  async function escolherMinha(arquivo: File | undefined) {
    if (!arquivo) return;
    const previa = URL.createObjectURL(arquivo);
    muda({ minha: previa });
    setEnviando(true);
    try {
      const reduzida = await reduzirFoto(arquivo);
      const form = new FormData();
      form.append("foto", new File([reduzida], "meta.jpg", { type: "image/jpeg" }));
      const r = await enviarFotoDaMetaAction(form);
      if (!r.ok) {
        muda({ minha: null });
        showError(r.error);
      } else muda({ minha: r.url });
    } catch {
      muda({ minha: null });
      showError("Não consegui usar essa foto. Tente outra.");
    } finally {
      setEnviando(false);
      URL.revokeObjectURL(previa);
    }
  }

  const botao = "flex min-h-[54px] w-full items-center justify-center rounded-full bg-ink px-5 text-[17px] font-semibold text-canvas disabled:opacity-40";
  const chip = (on: boolean) => `min-h-11 rounded-full border px-3.5 text-[15px] font-medium transition-colors ${on ? "border-accent bg-accent-soft font-semibold text-accent-strong" : "border-border-strong text-ink hover:bg-surface-hover"}`;

  let conteudo: ReactNode;
  let podeSeguir = true;
  if (e.passo === 1) {
    podeSeguir = e.nome.trim().length > 0;
    conteudo = (
      <>
        <h3 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink">Para que é?</h3>
        <input
          autoFocus={!meta}
          value={e.nome}
          maxLength={40}
          autoComplete="off"
          aria-label="Para que é a meta"
          placeholder="Ex.: Viagem para a praia"
          onChange={(ev) => muda({ nome: ev.target.value, tipo: null })}
          className="min-h-[52px] rounded-2xl border border-border-strong bg-surface px-4 text-base text-ink outline-none placeholder:text-ink-faint focus:border-accent"
        />
        <div className="flex flex-wrap gap-2">
          {TIPOS_DE_META.map((t) => (
            <button
              key={t.chave}
              type="button"
              aria-pressed={e.tipo === t.chave}
              className={chip(e.tipo === t.chave)}
              onClick={() => {
                const anterior = TIPOS_DE_META.find((x) => x.chave === e.tipo)?.nome;
                const nome = !e.nome.trim() || e.nome === anterior ? t.nome : e.nome;
                muda({ tipo: t.chave, nome, foto: null });
              }}
            >
              {t.nome}
            </button>
          ))}
        </div>
      </>
    );
  } else if (e.passo === 2) {
    podeSeguir = e.alvo > 0;
    conteudo = (
      <>
        <h3 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink">Quanto você precisa?</h3>
        <label className="mx-auto mt-2 flex items-baseline gap-3">
          <span className="text-xl text-ink-muted">{simbolo}</span>
          <input
            autoFocus
            inputMode="numeric"
            aria-label="Quanto você precisa"
            placeholder="0"
            value={e.alvo ? e.alvo.toLocaleString("pt-BR") : ""}
            onChange={(ev) => muda({ alvo: Number(ev.target.value.replace(/\D/g, "")) || 0 })}
            className="w-[7ch] border-b-2 border-accent bg-transparent pb-1 text-center text-[44px] font-light tabular-nums text-ink outline-none"
          />
        </label>
      </>
    );
  } else if (e.passo === 3) {
    const falta = e.semPrazo ? (
      "Sem prazo: você escolhe quanto guardar por mês no fim"
    ) : (
      <>
        Faltam {duracao(mesesAte)} · guardar <b className="whitespace-nowrap text-accent-strong">{m(pmt)}</b> por mês
      </>
    );
    conteudo = (
      <>
        <h3 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink">Para quando?</h3>
        <div className="flex flex-wrap gap-2">
          {ATALHOS.map(([anos, texto]) => {
            const on = !e.semPrazo && e.prazo.ano * 12 + e.prazo.mes === hojeMi + anos * 12;
            return (
              <button key={anos} type="button" aria-pressed={on} className={chip(on)} onClick={() => muda({ semPrazo: false, prazo: { ano: hoje.ano + anos, mes: hoje.mes - 1 } })}>
                {texto}
              </button>
            );
          })}
          <button type="button" aria-pressed={e.semPrazo} className={chip(e.semPrazo)} onClick={() => muda({ semPrazo: true })}>
            Sem prazo
          </button>
        </div>
        <button
          type="button"
          aria-expanded={e.calendario}
          onClick={() => muda({ calendario: !e.calendario, anos: false })}
          className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-surface px-4 text-left text-[17px] font-medium text-ink shadow-premium-sm"
        >
          <Calendar size={18} aria-hidden />
          <span className="flex-1">{e.semPrazo ? "Escolher no calendário" : `${MESES_LONGOS[e.prazo.mes].charAt(0).toUpperCase()}${MESES_LONGOS[e.prazo.mes].slice(1)} de ${e.prazo.ano}`}</span>
          <ChevronDown size={18} className={e.calendario ? "rotate-180" : ""} aria-hidden />
        </button>
        {e.calendario && (
          <div className="flex flex-col gap-2 rounded-[22px] bg-surface p-3 shadow-premium-sm">
            <div className="flex items-center justify-between">
              <button type="button" aria-label="Ano anterior" disabled={e.prazo.ano <= hoje.ano} onClick={() => muda({ prazo: { ano: e.prazo.ano - 1, mes: (e.prazo.ano - 1) * 12 + e.prazo.mes <= hojeMi ? Math.min(11, hoje.mes) : e.prazo.mes } })} className="flex size-11 items-center justify-center rounded-full border border-border-strong text-ink disabled:opacity-30">
                <ChevronLeft size={18} aria-hidden />
              </button>
              <button type="button" aria-expanded={e.anos} onClick={() => muda({ anos: !e.anos })} className="rounded-full bg-surface-2 px-4 py-1.5 text-[17px] font-semibold text-ink">
                {e.prazo.ano}
              </button>
              <button type="button" aria-label="Próximo ano" disabled={e.prazo.ano >= 2080} onClick={() => muda({ prazo: { ano: e.prazo.ano + 1, mes: e.prazo.mes } })} className="flex size-11 items-center justify-center rounded-full border border-border-strong text-ink disabled:opacity-30">
                <ChevronRight size={18} aria-hidden />
              </button>
            </div>
            {e.anos ? (
              <div className="grid max-h-52 grid-cols-5 gap-1.5 overflow-y-auto p-0.5">
                {Array.from({ length: 2080 - hoje.ano + 1 }, (_, k) => hoje.ano + k).map((a) => (
                  <button key={a} type="button" onClick={() => muda({ anos: false, semPrazo: false, prazo: { ano: a, mes: a * 12 + e.prazo.mes <= hojeMi ? Math.min(11, hoje.mes) : e.prazo.mes } })} className={`h-10 rounded-xl border text-sm font-medium ${a === e.prazo.ano ? "border-ink bg-ink font-semibold text-canvas" : "border-border-strong bg-surface text-ink"}`}>
                    {a}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {MESES_CURTOS.map((nome, k) => {
                  const passado = e.prazo.ano * 12 + k <= hojeMi;
                  const on = !e.semPrazo && k === e.prazo.mes;
                  return (
                    <button key={nome} type="button" disabled={passado} onClick={() => muda({ semPrazo: false, prazo: { ano: e.prazo.ano, mes: k } })} className={`h-10 rounded-xl border text-sm font-medium disabled:opacity-30 ${on ? "border-ink bg-ink font-semibold text-canvas" : "border-border-strong bg-surface text-ink"}`}>
                      {nome}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <p aria-live="polite" className="rounded-2xl bg-accent-soft px-3 py-2.5 text-[14.5px] font-medium text-ink">
          {falta}
        </p>
      </>
    );
  } else if (e.passo === 4) {
    podeSeguir = !enviando;
    const grade = fotosEmOrdem(tipo);
    conteudo = (
      <>
        <h3 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink">Escolha uma foto</h3>
        <div className="grid grid-cols-3 gap-2">
          <label className={`relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-[1.5px] bg-surface text-accent-strong ${e.minha ? "border-solid border-accent" : "border-dashed border-border-strong"}`}>
            {e.minha ? (
              // eslint-disable-next-line @next/next/no-img-element -- a foto dela
              <img src={e.minha} alt="Sua foto" className="size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1 px-1 text-center">
                <Plus size={22} aria-hidden />
                <small className="text-xs font-semibold leading-tight">Usar uma minha</small>
              </span>
            )}
            {e.minha && (
              <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_0_0_2px_#fff]">
                <Check size={14} aria-hidden />
              </span>
            )}
            <input type="file" accept="image/*" className="sr-only" onChange={(ev) => escolherMinha(ev.target.files?.[0])} />
          </label>
          {grade.map((f) => {
            const on = !e.minha && e.foto === f;
            return (
              <button key={f} type="button" aria-pressed={on} aria-label={`Foto ${f.replace(/^.*\//, "").replace(".jpg", "")}`} onClick={() => muda({ foto: f, minha: null })} className={`relative aspect-square overflow-hidden rounded-2xl bg-surface-2 ${on ? "shadow-[0_0_0_3px_var(--color-canvas),0_0_0_5px_var(--color-accent)]" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- banco de fotos do app */}
                <img src={f} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                {on && (
                  <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_0_0_2px_#fff]">
                    <Check size={14} aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </>
    );
  } else {
    const chega = e.semPrazo ? mesesAteChegar(guardado, e.alvo, e.porMes, taxa) : null;
    const chegaTexto = chega !== null ? (() => {
      const i = hoje.mes - 1 + chega;
      return `${MESES_CURTOS[i % 12]}/${hoje.ano + Math.floor(i / 12)}`;
    })() : null;
    const pct = e.alvo > 0 ? Math.min(100, Math.round((guardado / e.alvo) * 100)) : 0;
    conteudo = (
      <>
        <div className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-premium-sm">
          <div className="mt-cena !h-[150px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- a foto escolhida */}
            <img src={fotoFinal} alt="" decoding="async" />
            <b className="mt-cena-nome">{e.nome}</b>
            <span className="mt-selo">{meta ? "Editada" : "Nova"}</span>
          </div>
          <div className="flex flex-col gap-2.5 px-[18px] pb-[18px] pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <ValorDestaque texto={m(guardado)} className="text-[28px] font-medium leading-none tracking-[-0.025em] tabular-nums text-ink" />
              <span className="text-[13px] font-medium text-ink-muted">de {m(e.alvo)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        {e.semPrazo ? (
          <div className="flex flex-col items-center gap-1 rounded-[20px] bg-accent-soft px-4 py-3.5 text-center text-sm font-medium text-ink">
            <span>Quanto quer guardar por mês?</span>
            <div className="my-1 grid w-full max-w-64 grid-cols-[44px_1fr_44px] items-center">
              <button type="button" aria-label="Menos 50" onClick={() => muda({ porMes: Math.max(50, e.porMes - 50) })} className="flex size-11 items-center justify-center rounded-full bg-surface text-ink">
                <Minus size={20} aria-hidden />
              </button>
              <ValorDestaque texto={m(e.porMes)} className="justify-center text-[26px] font-semibold tabular-nums text-accent-strong" />
              <button type="button" aria-label="Mais 50" onClick={() => muda({ porMes: e.porMes + 50 })} className="flex size-11 items-center justify-center rounded-full bg-surface text-ink">
                <Plus size={20} aria-hidden />
              </button>
            </div>
            {chegaTexto && (
              <span>
                Chega em <b className="text-accent-strong">{chegaTexto}</b>
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 rounded-[20px] bg-accent-soft px-4 py-3.5 text-center text-sm font-medium text-ink">
            <span>Guardar</span>
            <ValorDestaque texto={m(pmt)} className="text-[34px] font-medium leading-tight tracking-[-0.03em] tabular-nums text-accent-strong" />
            <span>
              por mês até {MESES_CURTOS[e.prazo.mes]}/{e.prazo.ano}
            </span>
          </div>
        )}
        {meta && (
          <button type="button" onClick={apagar} disabled={pendente} className={`mx-auto min-h-11 rounded-full px-4 text-sm font-semibold ${confirmarApagar ? "bg-danger text-on-accent" : "text-danger"}`}>
            {confirmarApagar ? "Toque de novo para apagar" : "Apagar meta"}
          </button>
        )}
      </>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="fixed inset-0 bg-black/40" />
      <div role="dialog" aria-modal="true" aria-label={meta ? "Editar meta" : "Nova meta"} className="relative z-10 flex h-[92dvh] w-full max-w-lg animate-fade-in flex-col rounded-t-[28px] border border-border bg-canvas shadow-premium sm:h-auto sm:max-h-[90dvh] sm:rounded-[28px]">
        <span className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong sm:hidden" aria-hidden />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pt-2">
          <span>
            {e.passo > 1 && (
              <button type="button" onClick={() => muda({ passo: (e.passo - 1) as Estado["passo"] })} className="flex min-h-11 items-center gap-1 pr-2 text-[15px] font-medium text-ink">
                <ChevronLeft size={18} aria-hidden />
                Voltar
              </button>
            )}
          </span>
          <h2 className="text-[15px] font-semibold text-ink">{meta ? "Editar meta" : "Nova meta"}</h2>
          <span className="flex justify-end">
            <button type="button" onClick={onFechar} aria-label="Fechar" className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink">
              <X size={18} aria-hidden />
            </button>
          </span>
        </div>
        <div className="flex gap-1.5 px-4 pb-1 pt-3" aria-label={`Passo ${e.passo} de 5`}>
          {[1, 2, 3, 4, 5].map((k) => (
            <i key={k} className={`h-[3px] flex-1 rounded-full ${k <= e.passo ? "bg-ink" : "bg-border-strong"}`} />
          ))}
        </div>
        <div ref={corpo} className="passo-entra flex flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain px-4 pb-4 pt-4" key={e.passo}>
          {conteudo}
        </div>
        <div className="px-4 pb-[calc(1rem+var(--safe-bottom))] pt-2">
          {e.passo < 5 ? (
            <button type="button" disabled={!podeSeguir} onClick={() => vai((e.passo + 1) as Estado["passo"])} className={botao}>
              Continuar
            </button>
          ) : (
            <button type="button" disabled={pendente} onClick={salvar} className={botao}>
              {pendente ? "Salvando…" : meta ? "Salvar meta" : "Criar meta"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
