"use client";

import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check } from "lucide-react";
import { Explica } from "@/components/ui/Explica";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { useToast } from "@/components/ui/toast-context";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { adiarAporteAction, marcarAporteAction, responderAporteAction } from "../acoes";

export type EstadoDoAporte =
  | { tipo: "feito"; mes: string; valor: number; origem: string; data: string | null; proximo: { mes: string; valor: number } | null }
  | { tipo: "pendente"; entradaId: string; valor: number; origem: "pix" | "aplicacao"; quando: string | null; mes?: string }
  | { tipo: "adiado"; mesDeHoje: string }
  | { tipo: "perguntar"; mes: string; combinado: number; diaMin: string; diaMax: string };

const AJUDA = "Quando você manda dinheiro para outra conta sua ou aplica, o SPI pergunta para qual meta foi. Assim ele sabe que você fez o aporte.";
const Maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * O aporte do mês no detalhe da meta (protótipo, rodada 32): já ligado pelo extrato (verde, com o
 * próximo aporte), achado no extrato sem meta ("Foi para esta meta?"), ou perguntado ("Já
 * guardou?", com "Já fiz" abrindo valor, de onde saiu e o dia).
 */
export function CartaoDoAporte({ metaId, estado }: { metaId: string; estado: EstadoDoAporte }) {
  const money = useMoney();
  const simbolo = currencySymbol(useCurrency());
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [pendente, iniciar] = useTransition();
  const [form, setForm] = useState<{ valor: number; origem: "pix" | "aplicacao" | "dinheiro"; dia: string } | null>(null);

  const rodar = (fn: () => Promise<{ ok: boolean; error?: string }>, aviso?: string) =>
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) return showError(r.error ?? "Não deu certo. Tente de novo.");
      if (aviso) showToast(aviso);
      router.refresh();
    });

  const botao = "min-h-11 rounded-full px-[18px] text-[15px] font-semibold disabled:opacity-50";
  const ajuda = <Explica rotulo="Como sabemos">{AJUDA}</Explica>;

  if (estado.tipo === "feito") {
    return (
      <section className="flex flex-col gap-3 rounded-3xl bg-success-soft p-4">
        <div className="flex items-center gap-3">
          {/^pix/i.test(estado.origem) ? (
            <LogoDoLancamento descricao="Pix" icon={Check} size={48} />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-success" aria-hidden>
              <Check size={20} />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-px">
            <small className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-success">
              {Maiuscula(estado.mes)} <Check size={14} aria-hidden />
            </small>
            <ValorDestaque texto={m(estado.valor)} className="text-[26px] font-normal leading-tight tracking-[-0.02em] tabular-nums text-ink" />
            <small className="text-[12.5px] font-medium text-ink-muted">
              {estado.origem}
              {estado.data ? ` · ${estado.data}` : ""}
            </small>
            {estado.proximo && (
              <div className="mt-2 flex flex-col">
                <small className="text-[12.5px] font-medium text-ink-muted">Próximo aporte</small>
                <b className="text-[15px] font-semibold text-ink">
                  {estado.proximo.mes} · <span className="whitespace-nowrap">{m(estado.proximo.valor)}</span>
                </b>
              </div>
            )}
          </div>
          <span className="ml-auto self-start">{ajuda}</span>
        </div>
      </section>
    );
  }

  if (estado.tipo === "pendente") {
    return (
      <section className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4" data-aporte-pendente>
        <div className="flex items-center gap-3">
          {estado.origem === "pix" ? (
            <LogoDoLancamento descricao="Pix" icon={Check} size={48} />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-success" aria-hidden>
              <Check size={20} />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-px">
            <small className="text-[12.5px] font-medium text-ink-muted">Aporte{estado.mes ? ` de ${estado.mes}` : ""}</small>
            <ValorDestaque texto={m(estado.valor)} className="text-[26px] font-normal leading-tight tracking-[-0.02em] tabular-nums text-ink" />
            <small className="text-[12.5px] font-medium text-ink-muted">
              {estado.origem === "pix" ? "Pix para você" : "Aplicação"}
              {estado.quando ? ` · ${estado.quando}` : ""}
            </small>
          </div>
          <span className="ml-auto self-start">
            <Explica rotulo="Como sabemos">{AJUDA}</Explica>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="mr-auto text-[15.5px] font-semibold text-ink">Foi para esta meta?</p>
          <button type="button" disabled={pendente} onClick={() => rodar(() => responderAporteAction(metaId, estado.entradaId, false))} className={`${botao} bg-surface-2 text-ink`}>
            Não
          </button>
          <button type="button" disabled={pendente} onClick={() => rodar(() => responderAporteAction(metaId, estado.entradaId, true), "Aporte ligado à meta")} className={`${botao} bg-ink text-canvas`}>
            Sim
          </button>
        </div>
      </section>
    );
  }

  if (estado.tipo === "adiado") {
    return (
      <section className="glass flex items-start justify-between gap-3 rounded-3xl p-4">
        <b className="text-[15px] font-semibold leading-snug text-ink">Combinado. Te pergunto de novo no fim de {estado.mesDeHoje}.</b>
        {ajuda}
      </section>
    );
  }

  if (form) {
    const origens: ["pix" | "aplicacao" | "dinheiro", string][] = [
      ["pix", "Pix para mim"],
      ["aplicacao", "Aplicação"],
      ["dinheiro", "Dinheiro"],
    ];
    return (
      <section className="glass flex flex-col gap-3 rounded-3xl p-4">
        <div className="flex items-center justify-between gap-3">
          <b className="text-[15px] font-semibold text-ink">Aporte de {estado.mes}</b>
          {ajuda}
        </div>
        <label className="mx-auto flex items-baseline gap-2">
          <span className="text-lg text-ink-muted">{simbolo}</span>
          <CampoDeDinheiro
            aria-label="Valor do aporte"
            placeholder="0,00"
            valor={form.valor}
            onValor={(v) => setForm({ ...form, valor: v ?? 0 })}
            className="w-[9ch] border-b-2 border-accent bg-transparent pb-1 text-center text-[34px] font-light tabular-nums text-ink outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {origens.map(([k, t]) => (
            <button key={k} type="button" aria-pressed={form.origem === k} onClick={() => setForm({ ...form, origem: k })} className={`min-h-11 rounded-full border px-3.5 text-sm font-medium ${form.origem === k ? "border-accent bg-accent-soft font-semibold text-accent-strong" : "border-border-strong text-ink"}`}>
              {t}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-muted">Dia</span>
          <input type="date" value={form.dia} min={estado.diaMin} max={estado.diaMax} onChange={(ev) => setForm({ ...form, dia: ev.target.value })} className="min-h-11 rounded-xl border border-border-strong bg-surface px-3 text-base text-ink outline-none focus:border-accent" />
        </label>
        <button
          type="button"
          disabled={pendente || !(form.valor > 0)}
          onClick={() => rodar(() => marcarAporteAction(metaId, form.valor, form.origem, form.dia), "Aporte salvo")}
          className="min-h-12 rounded-full bg-ink text-[15px] font-semibold text-canvas disabled:opacity-50"
        >
          {pendente ? "Salvando…" : "Salvar aporte"}
        </button>
      </section>
    );
  }

  return (
    <section className="glass flex flex-col gap-3 rounded-3xl p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted" aria-hidden>
          <Calendar size={20} />
        </span>
        <div className="flex min-w-0 flex-col gap-px">
          <small className="text-[12.5px] font-medium text-ink-muted">Aporte de {estado.mes}</small>
          <ValorDestaque texto={m(estado.combinado)} className="text-[26px] font-normal leading-tight tracking-[-0.02em] tabular-nums text-ink" />
          <small className="text-[12.5px] font-medium text-ink-muted">ainda não apareceu</small>
        </div>
        <span className="ml-auto self-start">{ajuda}</span>
      </div>
      <div className="flex items-center gap-2">
        <p className="mr-auto text-[15.5px] font-semibold text-ink">Já guardou?</p>
        <button type="button" disabled={pendente} onClick={() => rodar(() => adiarAporteAction(metaId))} className={`${botao} bg-surface-2 text-ink`}>
          Ainda não
        </button>
        <button type="button" onClick={() => setForm({ valor: Math.round(estado.combinado * 100) / 100, origem: "pix", dia: estado.diaMax })} className={`${botao} bg-ink text-canvas`}>
          Já fiz
        </button>
      </div>
    </section>
  );
}
