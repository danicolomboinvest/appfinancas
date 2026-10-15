"use client";

import { useState } from "react";
import { Home, Split, User, Users, Check } from "lucide-react";
import { Bolinha, corDaPessoa } from "@/components/casal-login/visual";
import { useCurrency } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import type { CasaNaTela } from "@/lib/casa/regras";
import {
  parteDeQuemLancou,
  resultadoDoGasto,
  rotuloDaDivisao,
  textoDoResultado,
  type ComoDivide,
  type DeQuem,
  type DivisaoDaCasa,
  type Escolhas,
} from "@/lib/casa/escolhas";

/**
 * As três perguntas do gasto no Casal simples (versão A do mockup, decisão de 15/10/2026), já
 * marcadas: "De quem é?", "Quem pagou?" e, no da casa, "Como divide?", com a barra da divisão e o
 * resultado na hora embaixo. É a mesma peça no Digitar e no lançamento aberto.
 */

const fmtPct = (v: number) => (Math.round(v * 100) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const lerNumero = (t: string) => {
  const v = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

/** A barra da divisão e quanto fica com cada um (sem valor, só as porcentagens). */
export function BarraDaDivisao({ pctEu, casa, valor, money }: { pctEu: number; casa: CasaNaTela; valor?: number; money?: (v: number) => string }) {
  const p = Math.min(100, Math.max(0, pctEu));
  const minha = valor === undefined ? null : Math.round(valor * p) / 100;
  const pct = (v: number) => `${Math.round(v)}%`;
  return (
    <div className="flex flex-col gap-1.5" data-barra-da-divisao={Math.round(p)}>
      <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-full" aria-hidden>
        {p > 0 && <span className="block rounded-full transition-[flex-basis] duration-300" style={{ flex: `0 0 calc(${p}% - 1.5px)`, background: corDaPessoa(casa.eu.papel) }} />}
        {p < 100 && <span className="block flex-1 rounded-full" style={{ background: corDaPessoa(casa.outro.papel) }} />}
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[13.5px] tabular-nums text-ink">
        <span className="flex items-center gap-1.5">
          <i className="inline-block size-2 rounded-full" style={{ background: corDaPessoa(casa.eu.papel) }} aria-hidden />
          Você {minha !== null && money ? money(minha) : ""} <small className="text-ink-muted">{pct(p)}</small>
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block size-2 rounded-full" style={{ background: corDaPessoa(casa.outro.papel) }} aria-hidden />
          {casa.outro.nome} {minha !== null && money && valor !== undefined ? money(Math.round((valor - minha) * 100) / 100) : ""} <small className="text-ink-muted">{pct(100 - p)}</small>
        </span>
      </div>
    </div>
  );
}

/**
 * "Outra" divisão: a parte de quem lança, digitada em % ou em R$ (o R$ só quando há valor). Em
 * Configurações › Casa (Combinado) é a mesma peça, só em %.
 */
export function OutraDivisao({ pctEu, valor, aoMudar, rotulo = "Sua parte" }: { pctEu: number; valor?: number; aoMudar: (pct: number) => void; rotulo?: string }) {
  const comReais = typeof valor === "number" && valor > 0;
  const simbolo = currencySymbol(useCurrency());
  const [modo, setModo] = useState<"pct" | "valor">("pct");
  const [texto, setTexto] = useState(() => fmtPct(pctEu));
  const trocar = (m: "pct" | "valor") => {
    if (m === modo) return;
    setModo(m);
    setTexto(m === "pct" ? fmtPct(pctEu) : fmtPct(((valor ?? 0) * pctEu) / 100));
  };
  return (
    <div className="flex flex-col gap-2">
      {comReais && (
        <div className="flex gap-0.5 rounded-full bg-surface-2 p-1" role="group" aria-label="Digitar em">
          {(["pct", "valor"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={modo === m}
              onClick={() => trocar(m)}
              className={`min-h-10 min-w-0 flex-1 rounded-full px-2 text-[15px] ${modo === m ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-muted"}`}
            >
              {m === "pct" ? "Em %" : `Em ${simbolo}`}
            </button>
          ))}
        </div>
      )}
      <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-surface-2 px-3">
        <span className="shrink-0 text-sm text-ink-muted">{rotulo}</span>
        <input
          inputMode="decimal"
          value={texto}
          aria-label={rotulo}
          data-outra-divisao
          onChange={(e) => {
            const t = e.target.value.replace(/[^\d,.]/g, "").slice(0, 10);
            setTexto(t);
            const n = lerNumero(t);
            const pct = modo === "pct" ? n : comReais ? (n / (valor as number)) * 100 : 0;
            aoMudar(Math.min(100, Math.max(0, Math.round(pct * 100) / 100)));
          }}
          className="w-full min-w-0 bg-transparent text-right text-[18px] font-medium tabular-nums text-ink outline-none"
        />
        <span className="shrink-0 text-sm text-ink-muted">{modo === "pct" ? "%" : simbolo}</span>
      </label>
    </div>
  );
}

export function PerguntasDoCasal({
  casa,
  escolhas,
  aoMudar,
  divisao,
  valor,
  money,
  pelaLoja = false,
}: {
  casa: CasaNaTela;
  escolhas: Escolhas;
  aoMudar: (e: Escolhas) => void;
  divisao: DivisaoDaCasa;
  /** O valor do gasto, em reais (a barra e o resultado). */
  valor: number;
  money: (v: number) => string;
  /** "Da casa" veio da loja (a regra aprendida ou o automático): o "pela loja" pequeno embaixo. */
  pelaLoja?: boolean;
}) {
  const mudar = (p: Partial<Escolhas>) => aoMudar({ ...escolhas, ...p });
  const pct = parteDeQuemLancou(escolhas, divisao);
  const resultado = resultadoDoGasto(valor, escolhas, divisao);
  const opDeQuem = (v: DeQuem, rotulo: string, Icone: typeof Home, nota?: string) => {
    const on = escolhas.deQuem === v;
    return (
      <button
        key={v}
        type="button"
        aria-pressed={on}
        onClick={() => mudar({ deQuem: v })}
        className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 pb-2.5 pt-3 text-center text-[14px] leading-tight text-ink transition-colors ${
          on ? "bg-accent-soft/50 font-medium shadow-[inset_0_0_0_2px_var(--color-accent)]" : "bg-surface shadow-[inset_0_0_0_1px_var(--color-border)]"
        }`}
      >
        <span className={`flex size-10 items-center justify-center rounded-full ${on ? "bg-accent text-on-accent" : "bg-surface-2 text-ink"}`}>
          <Icone size={19} strokeWidth={1.8} aria-hidden />
        </span>
        <span className="w-full break-words">{rotulo}</span>
        {nota && <small className="text-[12px] font-medium text-ink-muted">{nota}</small>}
      </button>
    );
  };
  const chip = (v: ComoDivide, rotulo: string, extra?: string) => {
    const on = escolhas.divide === v;
    return (
      <button
        key={v}
        type="button"
        aria-pressed={on}
        onClick={() => mudar(v === "outra" && escolhas.divide !== "outra" ? { divide: v, parte: Math.round(pct * 100) / 100 } : { divide: v })}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] ${on ? "bg-ink font-medium text-canvas" : "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-border)]"}`}
      >
        {rotulo}
        {extra && <small className="text-[12px] opacity-80">{extra}</small>}
      </button>
    );
  };
  const pctRenda = divisao.semRenda ? 50 : divisao.pctEuRenda;

  return (
    <div className="flex flex-col gap-3.5" data-perguntas-do-casal>
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-medium text-ink">De quem é?</span>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="De quem é?">
          {opDeQuem("meu", "Meu", User)}
          {opDeQuem("casa", "Da casa", Home, pelaLoja && escolhas.deQuem === "casa" ? "pela loja" : undefined)}
          {opDeQuem("par", `De ${casa.outro.nome}`, Users)}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-medium text-ink">Quem pagou?</span>
        <div className="flex gap-0.5 rounded-full bg-surface-2 p-1" role="group" aria-label="Quem pagou?">
          {([false, true] as const).map((par) => {
            const on = escolhas.pagouOPar === par;
            const p = par ? casa.outro : casa.eu;
            return (
              <button
                key={String(par)}
                type="button"
                aria-pressed={on}
                onClick={() => mudar({ pagouOPar: par })}
                className={`flex min-h-[42px] min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-2 text-[15px] ${on ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-muted"}`}
              >
                <Bolinha nome={p.nome} cor={p.papel} size={26} />
                <span className="min-w-0 break-words">{par ? casa.outro.nome : "Eu"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {escolhas.deQuem === "casa" && (
        <div className="flex flex-col gap-2">
          <span className="text-[15px] font-medium text-ink">Como divide?</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Como divide?">
            {divisao.modo === "combinado" && chip("combinado", "Combinado", rotuloDaDivisao(divisao.pctEuCombinado))}
            {chip("renda", "Pela renda", rotuloDaDivisao(pctRenda))}
            {chip("meio", "50/50")}
            {chip("outra", "Outra")}
          </div>
          <BarraDaDivisao pctEu={pct} casa={casa} valor={valor} money={money} />
          {escolhas.divide === "outra" && <OutraDivisao key="outra" pctEu={escolhas.parte} valor={valor} aoMudar={(parte) => mudar({ parte })} />}
        </div>
      )}

      <div
        className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-[15px] ${resultado.tipo === "fora" ? "bg-surface-2 text-ink" : "bg-accent-soft/60 font-medium text-ink"}`}
        aria-live="polite"
        data-resultado-do-casal={resultado.tipo}
      >
        {resultado.tipo === "fora" ? <Check size={19} strokeWidth={1.8} className="shrink-0 text-ink-muted" aria-hidden /> : <Split size={19} strokeWidth={1.8} className="shrink-0 text-accent-strong" aria-hidden />}
        <span className="min-w-0">{textoDoResultado(resultado, casa.outro.nome, money)}</span>
      </div>
    </div>
  );
}
