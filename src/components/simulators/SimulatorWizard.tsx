"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { HelpTooltip } from "@/components/forms/HelpTooltip";
import { currencySymbol, type MoneyFormatter } from "@/lib/money";
import { useMoney, useCurrency } from "@/components/money/MoneyProvider";
import { SaveSimulation } from "./SaveSimulation";
import { useSearchParams } from "next/navigation";
import { loadSimulationInputsAction } from "@/app/(app)/simuladores/actions";

export type SimulationKind =
  | "FINANCIAR_VS_ALUGAR"
  | "AMORTIZAR_VS_INVESTIR"
  | "CONSORCIO_VS_FINANCIAMENTO"
  | "MARCACAO_MERCADO"
  | "CARRO";

export type WizardFieldKind = "currency" | "percent" | "number" | "select";

export type WizardField = {
  name: string;
  /** Vira a pergunta (no passo) e o rótulo (na tela de ajuste). */
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

/** Descrição curta do valor atual, mostrada na tela de ajuste. */
function summarize(field: WizardField, value: number | string, money: MoneyFormatter): string {
  if (field.kind === "currency") return money(typeof value === "number" ? value : Number(value), { round: true });
  if (field.kind === "percent") return `${percentDisplay(value)}% ${field.suffix ?? "a.a."}`;
  if (field.kind === "select") return field.options?.find((o) => o.value === value)?.label ?? String(value);
  return `${value}${field.suffix ? ` ${field.suffix}` : ""}`;
}

/**
 * Wizard reutilizável dos simuladores: uma pergunta por tela (com "?" explicando cada campo),
 * e no fim uma tela de resultado onde a pessoa vê o cálculo e ajusta qualquer resposta ali mesmo
 *, o resultado recalcula ao vivo. Mesma linguagem do "Vale a pena comprar?".
 */
export function SimulatorWizard({
  eyebrow,
  fields,
  defaults,
  renderResult,
  save,
}: {
  eyebrow: string;
  fields: WizardField[];
  defaults: WizardValues;
  renderResult: (values: WizardValues) => React.ReactNode;
  /** Quando presente, o resultado ganha o botão de guardar o cenário. */
  save?: { type: SimulationKind; resumo: (values: WizardValues) => string };
}) {
  const [values, setValues] = useState<WizardValues>(defaults);
  const [step, setStep] = useState(0);

  // Reabrir uma simulação salva: o id vem na URL (?s=…) e o próprio assistente carrega os
  // valores. Fica aqui, e não em cada página, porque são cinco simuladores usando este mesmo
  // componente — e o resultado é RECALCULADO com a fórmula atual, nunca lido de um número
  // guardado, que poderia estar desatualizado.
  const searchParams = useSearchParams();
  const savedId = save ? searchParams.get("s") : null;
  useEffect(() => {
    if (!savedId) return;
    let ativo = true;
    void loadSimulationInputsAction(savedId).then((salvos) => {
      if (!ativo || !salvos) return;
      setValues((atuais) => ({ ...atuais, ...salvos }));
      setStep(Number.MAX_SAFE_INTEGER); // já abre no resultado
    });
    return () => {
      ativo = false;
    };
  }, [savedId]);
  // Campos condicionais (showIf) entram/saem conforme as respostas.
  const visibleFields = fields.filter((f) => !f.showIf || f.showIf(values));
  const isResult = step >= visibleFields.length;
  const totalSteps = visibleFields.length + 1;
  const currency = useCurrency();
  const money = useMoney();

  function setField(name: string, value: number | string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function inputFor(field: WizardField, big: boolean) {
    const value = values[field.name];
    const baseBig = "w-full bg-transparent text-3xl font-semibold tabular-nums text-ink outline-none placeholder:text-ink-faint";
    const baseSmall =
      "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm font-medium tabular-nums text-ink outline-none focus:border-accent";

    if (field.kind === "select") {
      return (
        <div className={big ? "flex flex-col gap-2" : ""}>
          {(field.options ?? []).map((opt) => {
            const active = value === opt.value;
            if (big) {
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setField(field.name, opt.value)}
                  className={`rounded-2xl border p-4 text-left text-sm font-medium transition-colors ${
                    active ? "border-accent bg-accent-soft text-ink" : "border-border bg-surface text-ink-muted hover:bg-surface-hover"
                  }`}
                >
                  {opt.label}
                </button>
              );
            }
            return null;
          })}
          {!big && (
            <select
              value={String(value)}
              onChange={(e) => setField(field.name, e.target.value)}
              className={baseSmall}
            >
              {(field.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      );
    }

    if (field.kind === "currency") {
      return (
        <input
          type="text"
          inputMode="decimal"
          autoFocus={big}
          placeholder={`${currencySymbol(currency)} 0,00`}
          value={currencyDisplay(value, money)}
          onChange={(e) => setField(field.name, parseCurrency(e.target.value))}
          className={big ? baseBig : baseSmall}
        />
      );
    }

    // percent e number
    const isPercent = field.kind === "percent";
    return (
      <div className={big ? "flex items-baseline gap-2" : "flex items-center gap-2"}>
        <input
          type="number"
          inputMode="decimal"
          autoFocus={big}
          step={isPercent ? "0.1" : "any"}
          value={
            isPercent
              ? percentDisplay(value)
              : value === "" || value === undefined
                ? ""
                : String(value)
          }
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return setField(field.name, isPercent ? 0 : 0);
            setField(field.name, isPercent ? Number(raw) / 100 : Number(raw));
          }}
          className={big ? baseBig : baseSmall}
        />
        {(isPercent || field.suffix) && (
          <span className={big ? "text-xl text-ink-muted" : "text-sm text-ink-muted"}>
            {isPercent ? `% ${field.suffix ?? "a.a."}` : field.suffix}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-ink-muted transition-colors hover:text-ink disabled:invisible"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <ProgressBar percent={(step + 1) / totalSteps} tone="accent" className="flex-1" />
      </div>

      {!isResult && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{eyebrow}</p>
            <h1 className="mt-1 flex items-center font-serif text-2xl text-ink">
              {visibleFields[step].label}
              {visibleFields[step].help && <HelpTooltip text={visibleFields[step].help} />}
            </h1>
          </div>

          <Card className="p-4">{inputFor(visibleFields[step], true)}</Card>

          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="mt-2 flex items-center justify-center gap-1 rounded-full bg-ink px-5 py-3 text-sm font-medium text-canvas transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            {step === visibleFields.length - 1 ? "Ver resultado" : "Continuar"}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {isResult && (
        <div className="flex flex-col gap-6">
          {renderResult(values)}

          {save && <SaveSimulation type={save.type} values={values} resumo={save.resumo(values)} />}

          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <Pencil className="h-3.5 w-3.5" /> Ajustar respostas
            </p>
            <Card className="flex flex-col divide-y divide-border p-0">
              {visibleFields.map((field) => (
                <div key={field.name} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center text-xs font-medium text-ink-muted">
                      {field.label}
                      {field.help && <HelpTooltip text={field.help} />}
                    </p>
                    <p className="truncate text-sm font-medium text-ink">{summarize(field, values[field.name], money)}</p>
                  </div>
                  <div className="w-36 shrink-0">{inputFor(field, false)}</div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
