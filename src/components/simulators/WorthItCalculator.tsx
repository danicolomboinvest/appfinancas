"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Repeat, ShoppingBag } from "lucide-react";
import { simulateWorthIt, WORTH_IT_ANNUAL_RATE, type WorthItMode } from "@/lib/simulators/worth-it";
import { formatHours } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";
import { CountUp } from "@/components/ui/CountUp";

const HORIZONS = [1, 5, 10] as const;
const TOTAL_STEPS = 3;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function centsToBRLInput(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseDigitsToCents(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  if (digits === "") return null;
  return Number(digits);
}

const CHOICE_COPY: Record<"comprar" | "nao" | "duvida", { tone: "success" | "neutral"; text: string }> = {
  comprar: {
    tone: "success",
    text: "Se é prioridade pra você, ótimo, só garanta que cabe no seu orçamento do mês.",
  },
  nao: {
    tone: "success",
    text: "Boa escolha. Isso te aproxima das suas metas.",
  },
  duvida: {
    tone: "neutral",
    text: "Sem problema. Dá pra voltar aqui quando tiver mais clareza, a dúvida já é um sinal de que vale pensar mais um pouco.",
  },
};

export function WorthItCalculator({
  monthlyIncome,
  incomeMonthLabel,
}: {
  monthlyIncome: number;
  incomeMonthLabel: string;
}) {
  const priceInputId = useId();
  const [step, setStep] = useState(1);
  const [priceCents, setPriceCents] = useState<number | null>(null);
  const [mode, setMode] = useState<WorthItMode>("SINGLE");
  const [horizonYears, setHorizonYears] = useState<(typeof HORIZONS)[number]>(5);
  const [choice, setChoice] = useState<"comprar" | "nao" | "duvida" | null>(null);
  const [editingIncome, setEditingIncome] = useState(false);
  const [simulatedIncomeCents, setSimulatedIncomeCents] = useState<number | null>(null);

  const price = priceCents === null ? 0 : priceCents / 100;
  const isIncomeSimulated = simulatedIncomeCents !== null;
  const effectiveIncome = isIncomeSimulated ? simulatedIncomeCents / 100 : monthlyIncome;
  const hasIncome = effectiveIncome > 0;
  const result = simulateWorthIt({ price, monthlyIncome: effectiveIncome, mode, horizonYears });

  function startSimulatingIncome() {
    setSimulatedIncomeCents((prev) => prev ?? (monthlyIncome > 0 ? Math.round(monthlyIncome * 100) : null));
    setEditingIncome(true);
  }

  function goToStep(next: number) {
    setStep(next);
    setChoice(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => goToStep(step - 1)}
          disabled={step === 1}
          className="text-ink-muted transition-colors hover:text-ink disabled:invisible"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <ProgressBar percent={step / TOTAL_STEPS} tone="accent" className="flex-1" />
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Vale a pena comprar?</p>
            <h1 className="mt-1 font-serif text-2xl text-ink">Quanto custa isso?</h1>
            <p className="mt-2 text-sm text-ink-muted">Digite o preço do item que você está pensando em comprar.</p>
          </div>

          <Card className="p-4">
            <label htmlFor={priceInputId} className="mb-1.5 block text-xs font-medium text-ink-muted">
              Preço
            </label>
            <input
              id={priceInputId}
              type="text"
              inputMode="decimal"
              autoFocus
              placeholder="R$ 0,00"
              value={centsToBRLInput(priceCents)}
              onChange={(e) => setPriceCents(parseDigitsToCents(e.target.value))}
              className="w-full bg-transparent text-3xl font-semibold tabular-nums text-ink outline-none placeholder:text-ink-faint"
            />
          </Card>

          {editingIncome ? (
            <div className="flex w-fit items-center gap-2 rounded-full border border-accent bg-accent-soft px-3.5 py-2 text-xs">
              <span className="shrink-0 text-ink-muted">Simular com renda de</span>
              <span className="text-ink-muted">R$</span>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                placeholder="0,00"
                value={simulatedIncomeCents === null ? "" : (simulatedIncomeCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                onChange={(e) => setSimulatedIncomeCents(parseDigitsToCents(e.target.value))}
                className="w-20 bg-transparent font-semibold text-ink outline-none"
              />
              <button
                type="button"
                onClick={() => setEditingIncome(false)}
                className="font-medium text-accent-strong hover:underline"
              >
                ok
              </button>
            </div>
          ) : (
            <div className="flex w-fit items-center gap-2 rounded-full border border-border bg-surface-2 px-3.5 py-2 text-xs text-ink-muted">
              {hasIncome ? (
                <span>
                  Valor-hora calculado com {isIncomeSimulated ? "uma renda simulada de" : "sua renda de"}{" "}
                  <b className="font-semibold text-ink">{formatBRL(effectiveIncome)}</b>
                  {!isIncomeSimulated && <> em {incomeMonthLabel} (Fluxo Financeiro)</>}{" "}
                  <button type="button" onClick={startSimulatingIncome} className="font-medium text-accent-strong hover:underline">
                    alterar
                  </button>
                  {isIncomeSimulated && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        onClick={() => setSimulatedIncomeCents(null)}
                        className="font-medium text-accent-strong hover:underline"
                      >
                        usar renda cadastrada
                      </button>
                    </>
                  )}
                </span>
              ) : (
                <span>
                  Você ainda não lançou renda em {incomeMonthLabel}.{" "}
                  <button type="button" onClick={startSimulatingIncome} className="font-medium text-accent-strong hover:underline">
                    simule um valor
                  </button>{" "}
                  pra ver o tempo de trabalho equivalente, ou{" "}
                  <Link href="/mensal" target="_blank" className="font-medium text-accent-strong hover:underline">
                    cadastre em Fluxo Financeiro
                  </Link>
                  .
                </span>
              )}
            </div>
          )}

          <Button type="button" onClick={() => goToStep(2)} disabled={price <= 0} className="mt-2">
            Continuar
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Vale a pena comprar?</p>
            <h1 className="mt-1 font-serif text-2xl text-ink">Que tipo de gasto é esse?</h1>
            <p className="mt-2 text-sm text-ink-muted">Isso muda como calculamos o quanto você deixaria de ganhar.</p>
          </div>

          <button
            type="button"
            onClick={() => setMode("SINGLE")}
            className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors ${
              mode === "SINGLE" ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                mode === "SINGLE" ? "bg-accent text-canvas" : "bg-surface-2 text-ink-muted"
              }`}
            >
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">Compra única</span>
              <span className="block text-xs text-ink-muted">Algo pontual, uma roupa, um eletrônico, uma viagem.</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode("RECURRING")}
            className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors ${
              mode === "RECURRING" ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                mode === "RECURRING" ? "bg-accent text-canvas" : "bg-surface-2 text-ink-muted"
              }`}
            >
              <Repeat className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">Hábito mensal</span>
              <span className="block text-xs text-ink-muted">Se repete todo mês, assinatura, delivery, café.</span>
            </span>
          </button>

          <Button type="button" onClick={() => goToStep(3)} className="mt-2">
            Continuar
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Resultado</p>
            <h1 className="mt-1 font-serif text-2xl text-ink">Vale a pena?</h1>
          </div>

          <div className="text-center">
            <p className="text-xs font-medium text-ink-muted">
              {mode === "SINGLE" ? "Tempo de trabalho equivalente" : "Tempo de trabalho por mês"}
            </p>
            <p className="mt-1.5 text-4xl font-semibold tracking-tight text-ink">
              {result.hoursEquivalent === null ? "—" : <CountUp value={result.hoursEquivalent} format={formatHours} />}
            </p>
          </div>

          <Card className="flex flex-col gap-4 p-4">
            <div>
              <p className="mb-2 text-xs font-medium text-ink-muted">Se você não comprar e investir, em quanto tempo?</p>
              <div className="flex gap-1.5">
                {HORIZONS.map((years) => (
                  <button
                    key={years}
                    type="button"
                    onClick={() => setHorizonYears(years)}
                    className={`flex-1 rounded-full border px-2 py-1.5 text-xs font-medium transition-colors ${
                      horizonYears === years
                        ? "border-accent bg-accent text-canvas"
                        : "border-border bg-surface-2 text-ink-muted hover:bg-surface-hover"
                    }`}
                  >
                    {years === 1 ? "1 ano" : `${years} anos`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label={mode === "SINGLE" ? `Se investido (${horizonYears} ${horizonYears === 1 ? "ano" : "anos"})` : `Resistindo ${horizonYears} ${horizonYears === 1 ? "ano" : "anos"}`}
                value={formatBRL(result.futureValueIfInvested)}
                tone="accent"
              />
              <StatCard label="Diferença" value={`+${formatBRL(result.difference)}`} />
            </div>

            <p className="text-xs leading-relaxed text-ink-faint">
              Estimativa educada, não garantia de rentabilidade. Considera 220h úteis/mês e retorno composto de{" "}
              {WORTH_IT_ANNUAL_RATE * 100}% ao ano, sem descontar inflação ou impostos.
            </p>
          </Card>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setChoice("comprar")}
              className={`flex-1 rounded-full px-2 py-3 text-xs font-semibold transition-colors ${
                choice === "comprar" ? "ring-2 ring-success" : ""
              } bg-success-soft text-success`}
            >
              Comprar
            </button>
            <button
              type="button"
              onClick={() => setChoice("nao")}
              className={`flex-1 rounded-full px-2 py-3 text-xs font-semibold transition-colors ${
                choice === "nao" ? "ring-2 ring-danger" : ""
              } bg-danger-soft text-danger`}
            >
              Não comprar
            </button>
            <button
              type="button"
              onClick={() => setChoice("duvida")}
              className={`flex-1 rounded-full border border-border px-2 py-3 text-xs font-semibold text-ink-muted transition-colors ${
                choice === "duvida" ? "ring-2 ring-ink-faint" : ""
              } bg-surface-2`}
            >
              Ainda não sei
            </button>
          </div>

          {choice && (
            <div
              className={`rounded-2xl p-3.5 text-sm font-medium leading-relaxed ${
                CHOICE_COPY[choice].tone === "success" ? "bg-success-soft text-success" : "bg-surface-2 text-ink-muted"
              }`}
            >
              {CHOICE_COPY[choice].text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
