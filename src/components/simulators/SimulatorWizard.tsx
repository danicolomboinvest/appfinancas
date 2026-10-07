"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { HelpTooltip } from "@/components/forms/HelpTooltip";
import { currencySymbol, type MoneyFormatter } from "@/lib/money";
import { useMoney, useCurrency } from "@/components/money/MoneyProvider";
import { SaveSimulation } from "./SaveSimulation";
import { useSearchParams } from "next/navigation";
import { loadSimulationInputsAction } from "@/app/(app)/simuladores/actions";
import { parseWizardNumber } from "@/lib/simulators/wizard-number";
import { faixaDoCampo, rotuloDoAtalho } from "@/lib/simulators/faixa";

export type SimulationKind =
  | "FINANCIAR_VS_ALUGAR"
  | "AMORTIZAR_VS_INVESTIR"
  | "CONSORCIO_VS_FINANCIAMENTO"
  | "MARCACAO_MERCADO"
  | "CARRO";

export type WizardFieldKind = "currency" | "percent" | "number" | "select";

export type WizardField = {
  name: string;
  /** O rótulo do campo. */
  label: string;
  /** Conteúdo do "?" que explica o campo (aceita JSX, ex.: com link). */
  help?: React.ReactNode;
  kind: WizardFieldKind;
  /** Sufixo para números (ex.: "meses", "anos") ou unidade do percentual (ex.: "a.m."; padrão "a.a."). */
  suffix?: string;
  /** Opções para kind "select". */
  options?: { value: string; label: string }[];
  /** Mostra o campo só quando a condição é verdadeira (ex.: duration só se paga cupom). */
  showIf?: (values: WizardValues) => boolean;
  /** Faixa do controle deslizante (percentual em decimal: 0.11 = 11%). Sem isso, sai do valor de exemplo. */
  min?: number;
  max?: number;
  step?: number;
  /** Atalhos de um toque ("10 anos", "11%", "R$ 500 mil"). */
  chips?: number[];
  /** Em qual grupo o campo aparece (id de `grupos`). */
  grupo?: string;
  /** Vai pra "Ajustes finos", recolhido: o que quase ninguém precisa mexer. */
  avancado?: boolean;
};

export type WizardValues = Record<string, number | string>;

/** Máscara de moeda a partir do valor cru → "R$ 1.234,56", "€ 1.234,56". */
function currencyDisplay(reais: number | string, money: MoneyFormatter): string {
  const n = typeof reais === "number" ? reais : Number(reais);
  if (!Number.isFinite(n) || n === 0) return "";
  return money(n);
}
function parseCurrency(text: string): number {
  const digits = text.replace(/\D/g, "");
  return digits === "" ? 0 : Number(digits) / 100;
}

function percentDisplay(decimal: number | string): string {
  const n = typeof decimal === "number" ? decimal : Number(decimal);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 1e6) / 1e4); // 0.11 -> "11"
}

/**
 * Simulador AO VIVO: uma tela só, com a resposta em cima e os números embaixo. Cada número tem
 * um controle deslizante e atalhos de um toque, e a resposta muda enquanto ela mexe.
 *
 * Antes era um passo a passo de uma pergunta por tela (até 10 telas no Financiar vs. Alugar)
 * e a resposta só aparecia no fim: demorado, e sem graça de preencher. Agora ela começa com um
 * exemplo pronto e vai trocando pelos números dela, vendo o efeito de cada um.
 */
export function SimulatorWizard({
  eyebrow,
  fields,
  defaults,
  renderResult,
  save,
  grupos = [],
}: {
  eyebrow: string;
  fields: WizardField[];
  defaults: WizardValues;
  renderResult: (values: WizardValues) => React.ReactNode;
  /** Quando presente, o resultado ganha o botão de guardar o cenário (e o resumo vira a barra fixa no celular). */
  save?: { type: SimulationKind; resumo: (values: WizardValues) => string };
  /** Os blocos de campos, na ordem ("O imóvel", "O financiamento"…). */
  grupos?: { id: string; titulo: string }[];
}) {
  const [values, setValues] = useState<WizardValues>(defaults);
  const [mexeu, setMexeu] = useState(false);
  // Texto cru do campo que está em foco: enquanto ela digita, o campo mostra exatamente o que
  // foi digitado ("10," ou "0.") e só o número já legível vai pra conta.
  const [draft, setDraft] = useState<{ name: string; text: string } | null>(null);
  const currency = useCurrency();
  const money = useMoney();

  // Reabrir uma simulação salva: o id vem na URL (?s=…). O resultado é RECALCULADO com a fórmula
  // atual, nunca lido de um número guardado, que poderia estar desatualizado.
  const searchParams = useSearchParams();
  const savedId = save ? searchParams.get("s") : null;
  useEffect(() => {
    if (!savedId) return;
    let ativo = true;
    void loadSimulationInputsAction(savedId).then((salvos) => {
      if (!ativo || !salvos) return;
      setValues((atuais) => ({ ...atuais, ...salvos }));
      setMexeu(true);
    });
    return () => {
      ativo = false;
    };
  }, [savedId]);

  // No celular, a resposta fica em cima; quando ela rola pra mexer nos números, o veredito
  // continua visível numa barra fixa, e ela vê o efeito sem subir a tela.
  const resultadoRef = useRef<HTMLDivElement>(null);
  const [resultadoFora, setResultadoFora] = useState(false);
  useEffect(() => {
    const el = resultadoRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setResultadoFora(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const visiveis = fields.filter((f) => !f.showIf || f.showIf(values));
  const principais = visiveis.filter((f) => !f.avancado);
  const avancados = visiveis.filter((f) => f.avancado);
  const blocos = grupos.length > 0 ? grupos.map((g) => ({ ...g, campos: principais.filter((f) => f.grupo === g.id) })) : [];
  const semGrupo = principais.filter((f) => !f.grupo || !grupos.some((g) => g.id === f.grupo));
  if (semGrupo.length > 0) blocos.push({ id: "_", titulo: "Seus números", campos: semGrupo });

  function setField(name: string, value: number | string) {
    setMexeu(true);
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  const veredito = save?.resumo(values);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-h2 font-bold tracking-tight text-ink">{eyebrow}</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {/* Um selo "Exemplo" enquanto os números são o exemplo (07/10/2026): era a frase "Começa com
              um exemplo. Troque pelos seus números." com o ícone de faísca. */}
          {!mexeu && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-muted">Exemplo</span>}
          {mexeu && (
            <button
              type="button"
              onClick={() => {
                setValues(defaults);
                setMexeu(false);
              }}
              className="inline-flex items-center gap-1 text-caption font-semibold text-accent-strong"
            >
              <RotateCcw size={12} aria-hidden /> Voltar ao exemplo
            </button>
          )}
        </p>
      </div>

      {/* Barra fixa do veredito (celular): aparece quando a resposta sai da tela. */}
      {veredito && resultadoFora && (
        <button
          type="button"
          onClick={() => resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="fixed inset-x-3 top-3 z-30 flex items-center gap-2 rounded-2xl border border-accent/40 bg-surface/95 px-4 py-3 text-left shadow-premium backdrop-blur lg:hidden"
        >
          <ArrowDown size={16} className="shrink-0 text-accent-strong" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{veredito}</span>
          <span className="shrink-0 text-caption font-semibold text-accent-strong">Ver</span>
        </button>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        {/* Resposta: em cima no celular, fixa do lado no computador. */}
        <div ref={resultadoRef} className="flex flex-col gap-4 lg:sticky lg:top-6 lg:order-2">
          <Card className="flex flex-col gap-4 border-accent/30 p-5">{renderResult(values)}</Card>
          {save && <SaveSimulation type={save.type} values={values} resumo={save.resumo(values)} />}
        </div>

        <div className="flex flex-col gap-4 lg:order-1">
          {blocos.map((b) =>
            b.campos.length === 0 ? null : (
              <Card key={b.id} className="flex flex-col gap-1 p-5">
                <p className="text-caption font-semibold text-ink-muted">{b.titulo}</p>
                <div className="flex flex-col divide-y divide-border">
                  {b.campos.map((f) => (
                    <Campo key={f.name} field={f} values={values} setField={setField} draft={draft} setDraft={setDraft} money={money} currency={currency} padrao={defaults[f.name]} />
                  ))}
                </div>
              </Card>
            ),
          )}

          {avancados.length > 0 && (
            <details className="group rounded-2xl border border-border bg-surface">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold text-ink">
                <SlidersHorizontal size={16} className="text-accent-strong" aria-hidden />
                <span className="flex-1">Ajustes finos</span>
                <span className="text-caption font-normal text-ink-faint">já vêm preenchidos</span>
                <ChevronDown size={16} className="text-ink-faint transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="flex flex-col divide-y divide-border border-t border-border px-5 pb-3">
                {avancados.map((f) => (
                  <Campo key={f.name} field={f} values={values} setField={setField} draft={draft} setDraft={setDraft} money={money} currency={currency} padrao={defaults[f.name]} />
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

/** Um número: rótulo e valor grande em cima, controle deslizante e atalhos embaixo. */
function Campo({
  field,
  values,
  setField,
  draft,
  setDraft,
  money,
  currency,
  padrao,
}: {
  field: WizardField;
  values: WizardValues;
  setField: (name: string, value: number | string) => void;
  draft: { name: string; text: string } | null;
  setDraft: (d: { name: string; text: string } | null) => void;
  money: MoneyFormatter;
  currency: ReturnType<typeof useCurrency>;
  padrao: number | string | undefined;
}) {
  const value = values[field.name];
  const rotulo = (
    <span className="flex items-center text-sm font-medium text-ink">
      {field.label}
      {field.help && <HelpTooltip text={field.help} />}
    </span>
  );

  if (field.kind === "select") {
    const opcoes = field.options ?? [];
    return (
      <div className="flex flex-col gap-2.5 py-4">
        {rotulo}
        <div className="grid gap-1 rounded-2xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}>
          {opcoes.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setField(field.name, opt.value)}
              aria-pressed={value === opt.value}
              className={`rounded-xl px-2 py-2 text-sm font-semibold transition-colors ${value === opt.value ? "bg-pill text-on-pill" : "text-ink-muted hover:text-ink"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const numero = typeof value === "number" ? value : Number(value) || 0;
  const faixa = faixaDoCampo(field, typeof padrao === "number" ? padrao : Number(padrao) || 0);
  const isPercent = field.kind === "percent";
  const editando = draft !== null && draft.name === field.name;
  const guardado = isPercent ? percentDisplay(value) : field.kind === "currency" ? currencyDisplay(value, money) : value === "" || value === undefined ? "" : String(value);
  const unidade = isPercent ? `% ${field.suffix ?? "a.a."}` : field.kind === "number" ? field.suffix : undefined;

  return (
    <div className="flex flex-col gap-2.5 py-4">
      <div className="flex items-start justify-between gap-3">
        {rotulo}
        <label className="flex shrink-0 items-baseline gap-1 rounded-xl bg-surface-2 px-3 py-1.5 focus-within:ring-2 focus-within:ring-accent">
          <input
            type="text"
            inputMode="decimal"
            aria-label={field.label}
            placeholder={field.kind === "currency" ? `${currencySymbol(currency)} 0` : "0"}
            value={editando ? draft.text : guardado}
            onFocus={() => setDraft({ name: field.name, text: guardado })}
            onChange={(e) => {
              if (field.kind === "currency") {
                const n = parseCurrency(e.target.value);
                setDraft({ name: field.name, text: currencyDisplay(n, money) });
                setField(field.name, n);
                return;
              }
              const text = e.target.value.replace(/[^\d.,-]/g, "");
              setDraft({ name: field.name, text });
              const n = parseWizardNumber(text);
              if (n !== null) setField(field.name, isPercent ? n / 100 : n);
            }}
            onBlur={() => setDraft(null)}
            style={{ width: `${Math.max(3, (editando ? draft.text : guardado).length + 1)}ch` }}
            className="min-w-0 max-w-[11rem] bg-transparent text-right text-base font-bold tabular-nums text-ink outline-none"
          />
          {unidade && <span className="text-caption font-medium text-ink-muted">{unidade}</span>}
        </label>
      </div>
      <input
        type="range"
        aria-label={`${field.label} (controle deslizante)`}
        min={faixa.min}
        max={faixa.max}
        step={faixa.step}
        value={Math.min(faixa.max, Math.max(faixa.min, numero))}
        onChange={(e) => setField(field.name, Number(e.target.value))}
        className="slider-app w-full"
        style={{ ["--pct" as string]: `${((Math.min(faixa.max, Math.max(faixa.min, numero)) - faixa.min) / (faixa.max - faixa.min || 1)) * 100}%` }}
      />
      {field.chips && field.chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {field.chips.map((c) => {
            const ativo = Math.abs(numero - c) < 1e-9;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setField(field.name, c)}
                aria-pressed={ativo}
                className={`rounded-full border px-3 py-1 text-caption font-semibold tabular-nums transition-colors ${ativo ? "border-accent bg-accent-soft text-accent-strong" : "border-border text-ink-muted hover:text-ink"}`}
              >
                {rotuloDoAtalho(field, c, money)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
