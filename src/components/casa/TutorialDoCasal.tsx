"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Eye, House, Landmark, Lock, LogOut, PencilLine, Plus, Shirt, ShoppingCart, User, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Bolinha, ParDeAvatares } from "@/components/casal-login/visual";
import { FORMA_DO_ACERTO, MioloDoAcerto } from "@/components/casa/MioloDoAcerto";
import { TOTAL_DE_PASSOS_DO_CASAL, textosDoTutorial, type FimDoTutorial, type IdDoPasso, type PessoaDoTutorial } from "@/lib/casa/tutorial";
import "./tutorial-casal.css";

/** O compasso das mini-telas: um toque a cada 1,6 s (parado para quem pediu menos movimento). */
function useBatida(ligado: boolean, ms = 1600): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!ligado) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setN((x) => x + 1), ms);
    return () => window.clearInterval(id);
  }, [ligado, ms]);
  return n;
}

/**
 * "Como funciona o casal" (pedido da dona em 13/10/2026): seis passos curtos, cada um com uma
 * mini-tela animada feita das peças de verdade (a bolinha de quem gastou, o "Da casa" / "Meu", o
 * cartão Acerto do mês, o "Só meu" e o "Mostrar para"). O cartão fica embaixo, por cima da tela
 * escurecida, no mesmo desenho do "Tivemos uma mudança": "1 de 6", os pontinhos, "Pular" e
 * "Próximo" sempre à vista.
 *
 * `outro` nulo: ainda sem par (o atalho antes do convite). O par aparece como o lugar vazio.
 */
export function TutorialDoCasal({
  aberto,
  eu,
  outro,
  fim,
  preco = null,
  aoFechar,
  aoTerminar,
}: {
  aberto: boolean;
  eu: PessoaDoTutorial;
  outro: PessoaDoTutorial | null;
  fim?: FimDoTutorial;
  /** O preço do Casal já formatado ("R$ 27"), só quando a cobrança está ligada. */
  preco?: string | null;
  /** Fechou: pelo "Pular", pelo Esc ou pelo botão do fim. */
  aoFechar: (como: "terminou" | "pulou") => void;
  /** O botão do último passo, quando ele faz algo além de fechar (convidar ou liberar). */
  aoTerminar?: () => void;
}) {
  const [indice, setIndice] = useState(0);
  const [estavaAberto, setEstavaAberto] = useState(aberto);
  if (aberto !== estavaAberto) {
    setEstavaAberto(aberto);
    if (aberto) setIndice(0);
  }
  const tx = textosDoTutorial(outro, { preco, fim });
  const batida = useBatida(aberto);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar("pulou");
      if (e.key === "ArrowRight") setIndice((i) => Math.min(TOTAL_DE_PASSOS_DO_CASAL - 1, i + 1));
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  const passo = tx.passos[indice];
  const ultimo = indice === TOTAL_DE_PASSOS_DO_CASAL - 1;
  // Sem o que fazer no fim (o Casal ainda não abre o convite nem a compra): só fecha.
  const botaoFinal = (fim === "convidar" || fim === "liberar") && !aoTerminar ? "Entendi" : tx.botaoFinal;
  const outroNaTela: PessoaDoTutorial = outro ?? { nome: "Par", papel: eu.papel === "titular" ? "par" : "titular" };

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end justify-center bg-[rgba(12,8,14,0.55)] px-3 pb-[calc(0.75rem+var(--safe-bottom))] pt-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-casal-titulo"
      data-tutorial-casal={passo.id}
    >
      <div className="flex max-h-full w-full max-w-[420px] flex-col overflow-y-auto rounded-[28px] bg-surface px-5 pb-4 pt-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45),inset_0_0_0_1px_var(--color-border)]">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <span className="flex items-center gap-1">
            {indice > 0 && (
              <button type="button" onClick={() => setIndice(indice - 1)} aria-label="Passo anterior" className="-ml-2 flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2">
                <ChevronLeft size={18} strokeWidth={1.8} aria-hidden />
              </button>
            )}
            <span className="text-[12.5px] font-semibold text-ink-muted">
              {indice + 1} de {TOTAL_DE_PASSOS_DO_CASAL}
            </span>
          </span>
          <span className="flex items-center gap-1" aria-hidden>
            {tx.passos.map((p, i) => (
              <i key={p.id} className={`h-1.5 rounded-full transition-all ${i <= indice ? "w-4 bg-accent" : "w-1.5 bg-border-strong"}`} />
            ))}
          </span>
        </div>

        <div className="relative mt-3 flex h-[212px] shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-surface-2 px-3" aria-hidden>
          <div key={passo.id} className="tc-entra flex w-full items-center justify-center">
            <MiniTela id={passo.id} eu={eu} outro={outroNaTela} semPar={!outro} esperando={fim === "esperando"} batida={batida} regras={tx.regras} />
          </div>
        </div>

        <h2 id="tutorial-casal-titulo" className="titulo-tema mt-4 text-balance text-[21px] font-semibold leading-tight tracking-tight text-ink">
          {passo.titulo}
        </h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{passo.texto}</p>
        {ultimo && tx.preco && <p className="mt-2 text-[14px] font-medium text-ink">{tx.preco}</p>}

        {ultimo ? (
          <div className="mt-4 flex flex-col gap-2">
            <Button
              autoFocus
              className="min-h-12 w-full text-[15px]"
              onClick={() => {
                aoFechar("terminou");
                aoTerminar?.();
              }}
            >
              {botaoFinal}
            </Button>
            {aoTerminar && (
              <button type="button" onClick={() => aoFechar("terminou")} className="min-h-11 text-[15px] font-medium text-ink-muted">
                Agora não
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => aoFechar("pulou")}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-surface-2 px-5 text-[15px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)]"
            >
              Pular
            </button>
            <Button autoFocus className="min-h-11 px-6 text-[15px]" onClick={() => setIndice(indice + 1)}>
              Próximo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

type PropsDaMiniTela = { eu: PessoaDoTutorial; outro: PessoaDoTutorial; semPar: boolean; esperando: boolean; batida: number };

function MiniTela({ id, regras, ...p }: PropsDaMiniTela & { id: IdDoPasso; regras: string[] }) {
  switch (id) {
    case "cada-um":
      return <CadaUm {...p} />;
    case "da-casa":
      return <DaCasaOuMeu {...p} />;
    case "acerto":
      return <Acerto {...p} />;
    case "o-que-ve":
      return <OQueVe {...p} />;
    case "regras":
      return <Regras regras={regras} />;
    default:
      return <Fim {...p} />;
  }
}

/** A bolinha de quem gastou, no canto do ícone do lançamento (a mesma peça da lista). */
function IconeComBolinha({ icone, pessoa }: { icone: React.ReactNode; pessoa: PessoaDoTutorial }) {
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
      {icone}
      <span className="absolute -bottom-1 -right-1 rounded-full ring-2 ring-surface">
        <Bolinha nome={pessoa.nome} cor={pessoa.papel} size={15} />
      </span>
    </span>
  );
}

/** Passo 1: dois celulares, a mesma casa no meio. */
function CadaUm({ eu, outro, semPar }: PropsDaMiniTela) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <Celular pessoa={eu} classe="tc-flutua" />
      <span className="tc-tracejado h-0.5 w-3 shrink-0" />
      <span className="tc-pulso flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
        <House size={20} strokeWidth={1.7} />
      </span>
      <span className="tc-tracejado h-0.5 w-3 shrink-0" />
      <Celular pessoa={semPar ? null : outro} classe="tc-flutua-2" />
    </div>
  );
}

function Celular({ pessoa, classe }: { pessoa: PessoaDoTutorial | null; classe: string }) {
  return (
    <div className={`${classe} flex h-[156px] w-[78px] shrink-0 flex-col gap-1.5 rounded-[18px] p-2 ${pessoa ? "bg-surface shadow-[inset_0_0_0_1px_var(--color-border),0_10px_24px_-14px_rgba(0,0,0,0.35)]" : "border border-dashed border-border-strong"}`}>
      <span className="mx-auto h-1 w-6 rounded-full bg-border-strong" />
      {pessoa ? (
        <>
          <span className="mt-1 flex items-center gap-1.5">
            <Bolinha nome={pessoa.nome} cor={pessoa.papel} size={22} />
            <span className="min-w-0 truncate text-[11px] font-semibold text-ink">{pessoa.nome}</span>
          </span>
          <span className="mt-1 h-5 rounded-md bg-accent-soft" />
          <span className="h-1.5 w-full rounded-full bg-surface-2" />
          <span className="h-1.5 w-4/5 rounded-full bg-surface-2" />
          <span className="h-1.5 w-3/5 rounded-full bg-surface-2" />
          <span className="mt-auto h-1.5 w-2/5 rounded-full bg-surface-2" />
        </>
      ) : (
        <span className="m-auto flex size-9 items-center justify-center rounded-full border border-dashed border-border-strong text-ink-muted">
          <Plus size={16} strokeWidth={1.6} />
        </span>
      )}
    </div>
  );
}

/** Passo 2: o que é da casa já vem marcado; um toque troca a roupa entre "Da casa" e "Meu". */
function DaCasaOuMeu({ eu, outro, batida }: PropsDaMiniTela) {
  const roupaDaCasa = batida % 2 === 1;
  return (
    <div className="flex w-full max-w-[268px] flex-col gap-1 rounded-2xl bg-surface p-2 shadow-[inset_0_0_0_1px_var(--color-border)]">
      <LinhaDaCasa icone={<House size={15} strokeWidth={1.7} />} pessoa={eu} nome="Aluguel" daCasa />
      <LinhaDaCasa icone={<ShoppingCart size={15} strokeWidth={1.7} />} pessoa={outro} nome="Mercado" daCasa />
      <LinhaDaCasa icone={<Shirt size={15} strokeWidth={1.7} />} pessoa={eu} nome="Roupa" daCasa={roupaDaCasa} toque={batida} />
    </div>
  );
}

function LinhaDaCasa({ icone, pessoa, nome, daCasa, toque }: { icone: React.ReactNode; pessoa: PessoaDoTutorial; nome: string; daCasa: boolean; toque?: number }) {
  return (
    <div className="flex min-h-11 items-center gap-2.5 px-1">
      <IconeComBolinha icone={icone} pessoa={pessoa} />
      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{nome}</span>
      <span className="relative shrink-0">
        <span
          className={`flex min-w-[76px] items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors duration-300 ${daCasa ? "bg-accent-soft text-accent-strong" : "bg-surface-2 text-ink-muted"}`}
        >
          {daCasa ? <House size={12} strokeWidth={2} /> : <User size={12} strokeWidth={2} />}
          {daCasa ? "Da casa" : "Meu"}
        </span>
        {toque !== undefined && toque > 0 && <span key={toque} className="tc-toque pointer-events-none absolute -inset-1 rounded-full border-2 border-accent" />}
      </span>
    </div>
  );
}

/** Passo 3: a moeda vai de quem deve para quem pagou mais, e o cartão Acerto do mês embaixo. */
function Acerto({ eu, outro }: PropsDaMiniTela) {
  const casa = { eu, outro };
  return (
    <div className="flex w-full max-w-[280px] flex-col items-stretch gap-3">
      <div className="flex items-center gap-2">
        <Bolinha nome={outro.nome} cor={outro.papel} size={38} />
        <span className="relative h-9 min-w-0 flex-1 [--tc-moeda:58px]">
          <span className="tc-tracejado absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2" />
          <span className="tc-moeda flex h-7 w-[58px] items-center justify-center rounded-full bg-surface text-[12px] font-semibold tabular-nums text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)]">
            R$ 150
          </span>
        </span>
        <Bolinha nome={eu.nome} cor={eu.papel} size={38} />
      </div>
      <div className={`${FORMA_DO_ACERTO} pointer-events-none`}>
        <MioloDoAcerto casa={casa} pilula="R$ 150" />
      </div>
      <span className="text-center text-[11.5px] text-ink-muted">Valores de exemplo</span>
    </div>
  );
}

function Interruptorzinho({ ligado }: { ligado: boolean }) {
  return (
    <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-300 ${ligado ? "bg-accent" : "bg-[color-mix(in_srgb,var(--color-ink)_16%,transparent)]"}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] duration-300 ${ligado ? "left-[18px]" : "left-0.5"}`} />
    </span>
  );
}

/** Passo 4: o que o par vê. O "Só meu" esconde um gasto; o "Mostrar para" vale para a conta inteira. */
function OQueVe({ eu, outro, semPar, batida }: PropsDaMiniTela) {
  const soMeu = batida % 2 === 1;
  const nomeOutro = semPar ? "o par" : outro.nome;
  return (
    <div className="flex w-full max-w-[280px] flex-col gap-1.5">
      <div className="flex flex-col rounded-2xl bg-surface px-2 py-1 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <span className="flex items-center gap-1.5 px-1 pt-1 text-[11.5px] font-medium text-ink-muted">
          <Eye size={13} strokeWidth={1.8} />
          No app {semPar ? "do par" : `de ${outro.nome}`}
        </span>
        <div className="flex min-h-10 items-center gap-2.5 px-1">
          <IconeComBolinha icone={<Wallet size={15} strokeWidth={1.7} />} pessoa={eu} />
          <span className="min-w-0 flex-1 truncate text-[14px] text-ink">Farmácia</span>
          <span className="text-[13px] tabular-nums text-ink">R$ 48</span>
        </div>
        <div className={`flex min-h-10 items-center gap-2.5 px-1 transition-opacity duration-300 ${soMeu ? "opacity-35" : ""}`}>
          <IconeComBolinha icone={soMeu ? <Lock size={14} strokeWidth={1.8} /> : <Shirt size={15} strokeWidth={1.7} />} pessoa={eu} />
          <span className={`min-w-0 flex-1 truncate text-[14px] text-ink ${soMeu ? "line-through" : ""}`}>Presente</span>
          <span className={`text-[13px] tabular-nums text-ink ${soMeu ? "line-through" : ""}`}>R$ 120</span>
        </div>
      </div>
      <div className="relative flex min-h-11 items-center gap-2.5 rounded-2xl bg-surface px-3 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <Lock size={15} strokeWidth={1.8} className="shrink-0 text-ink-muted" />
        <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">Só meu</span>
        <span className="relative">
          <Interruptorzinho ligado={soMeu} />
          {batida > 0 && <span key={batida} className="tc-toque pointer-events-none absolute -inset-1.5 rounded-full border-2 border-accent" />}
        </span>
      </div>
      <div className="flex min-h-11 items-center gap-2.5 rounded-2xl bg-surface px-3 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <Landmark size={15} strokeWidth={1.8} className="shrink-0 text-ink-muted" />
        <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">Mostrar para {nomeOutro}</span>
        <Interruptorzinho ligado />
      </div>
    </div>
  );
}

/** Passo 5: as três regras entram uma depois da outra. */
function Regras({ regras }: { regras: string[] }) {
  const icones = [<PencilLine key="e" size={17} strokeWidth={1.7} />, <LogOut key="s" size={17} strokeWidth={1.7} />, <Wallet key="c" size={17} strokeWidth={1.7} />];
  return (
    <ul className="flex w-full max-w-[290px] flex-col gap-2">
      {regras.map((r, i) => (
        <li key={r} className="tc-entra flex min-h-12 items-center gap-3 rounded-2xl bg-surface px-3 py-2 shadow-[inset_0_0_0_1px_var(--color-border)]" style={{ animationDelay: `${150 + i * 220}ms` }}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">{icones[i]}</span>
          <span className="min-w-0 text-[14px] font-medium leading-snug text-ink">{r}</span>
        </li>
      ))}
    </ul>
  );
}

/** Passo 6: os dois juntos (ou o lugar do par, esperando o convite). */
function Fim({ eu, outro, semPar, esperando }: PropsDaMiniTela) {
  const titular = eu.papel === "titular" ? eu : outro;
  const par = eu.papel === "titular" ? outro : eu;
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="tc-flutua">
        <ParDeAvatares titular={titular.nome} par={semPar ? null : par.nome} esperando={esperando} size={72} />
      </span>
      <span className="tc-pulso flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-strong">
        <House size={14} strokeWidth={2} />
        {semPar ? "Falta o par" : esperando ? `Esperando ${outro.nome}` : "Mesma casa"}
      </span>
    </div>
  );
}
