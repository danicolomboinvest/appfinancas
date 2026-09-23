"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Repeat, ShoppingBag } from "lucide-react";
import { simulateWorthIt, WORTH_IT_ANNUAL_RATE, type WorthItMode } from "@/lib/simulators/worth-it";
import { formatHours } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { OutcomeComparison } from "@/components/charts/OutcomeComparison";
import { CountUp } from "@/components/ui/CountUp";
import { useMoney } from "@/components/money/MoneyProvider";
import { useCurrency } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Titulos } from "@/lib/profiles/voice";
import { currencySymbol } from "@/lib/money";
import type { MoneyFormatter } from "@/lib/money";

const HORIZONS = [1, 5, 10] as const;
const TOTAL_STEPS = 3;


function centsToCurrencyInput(cents: number | null, money: MoneyFormatter): string {
  if (cents === null) return "";
  return money(cents / 100);
}

function parseDigitsToCents(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  if (digits === "") return null;
  return Number(digits);
}

/** O tom é do desenho; a frase de cada escolha vem do catálogo de voz do tema. */
const CHOICE_COPY: Record<"comprar" | "nao" | "duvida", { tone: "success" | "neutral"; text: (t: Titulos) => string }> = {
  comprar: { tone: "success", text: (t) => t.simValeEscolhaComprar },
  nao: { tone: "success", text: (t) => t.simValeEscolhaNao },
  duvida: { tone: "neutral", text: (t) => t.simValeEscolhaDuvida },
};

export function WorthItCalculator({
  monthlyIncome,
  incomeMonthLabel,
}: {
  monthlyIncome: number;
  incomeMonthLabel: string;
}) {
  const currency = useCurrency();
  const money = useMoney();
  const { voz } = useProfileTheme();
  const t = voz.titulos;
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
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.simValeEyebrow}</p>
            <h1 className="mt-1 text-h2 font-bold tracking-tight text-ink">{t.simValePasso1Titulo}</h1>
            <p className="mt-2 text-sm text-ink-muted">{t.simValePasso1Sub}</p>
          </div>

          <Card className="p-4">
            <label htmlFor={priceInputId} className="mb-1.5 block text-xs font-medium text-ink-muted">
              {t.simValePreco}
            </label>
            <input
              id={priceInputId}
              type="text"
              inputMode="decimal"
              autoFocus
              placeholder={`${currencySymbol(currency)} 0,00`}
              value={centsToCurrencyInput(priceCents, money)}
              onChange={(e) => setPriceCents(parseDigitsToCents(e.target.value))}
              className="w-full bg-transparent text-3xl font-semibold tabular-nums text-ink outline-none placeholder:text-ink-faint"
            />
          </Card>

          {editingIncome ? (
            <div className="flex w-fit items-center gap-2 rounded-full border border-accent bg-accent-soft px-3.5 py-2 text-xs">
              <span className="shrink-0 text-ink-muted">{t.simValeSimularRenda}</span>
              <span className="text-ink-muted">{currencySymbol(currency)}</span>
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
                {t.simValeOk}
              </button>
            </div>
          ) : (
            <div className="flex w-fit items-center gap-2 rounded-full border border-border bg-surface-2 px-3.5 py-2 text-xs text-ink-muted">
              {hasIncome ? (
                <span>
                  {t.simValeRendaIntro} {isIncomeSimulated ? t.simValeRendaSimulada : t.simValeRendaSua}{" "}
                  <b className="font-semibold text-ink">{money(effectiveIncome, { round: true })}</b>
                  {!isIncomeSimulated && <> {t.simValeRendaMes(incomeMonthLabel)}</>}{" "}
                  <button type="button" onClick={startSimulatingIncome} className="font-medium text-accent-strong hover:underline">
                    {t.simValeAlterar}
                  </button>
                  {isIncomeSimulated && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        onClick={() => setSimulatedIncomeCents(null)}
                        className="font-medium text-accent-strong hover:underline"
                      >
                        {t.simValeUsarCadastrada}
                      </button>
                    </>
                  )}
                </span>
              ) : (
                <span>
                  {t.simValeSemRenda(incomeMonthLabel)}{" "}
                  <button type="button" onClick={startSimulatingIncome} className="font-medium text-accent-strong hover:underline">
                    {t.simValeSimuleValor}
                  </button>{" "}
                  {t.simValeSemRendaMeio}{" "}
                  <Link href="/mensal" target="_blank" className="font-medium text-accent-strong hover:underline">
                    {t.simValeCadastre}
                  </Link>
                  .
                </span>
              )}
            </div>
          )}

          <Button type="button" onClick={() => goToStep(2)} disabled={price <= 0} className="mt-2">
            {t.simContinuar}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.simValeEyebrow}</p>
            <h1 className="mt-1 text-h2 font-bold tracking-tight text-ink">{t.simValePasso2Titulo}</h1>
            <p className="mt-2 text-sm text-ink-muted">{t.simValePasso2Sub}</p>
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
              <span className="block text-sm font-semibold text-ink">{t.simValeCompraUnica}</span>
              <span className="block text-xs text-ink-muted">{t.simValeCompraUnicaDesc}</span>
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
              <span className="block text-sm font-semibold text-ink">{t.simValeHabito}</span>
              <span className="block text-xs text-ink-muted">{t.simValeHabitoDesc}</span>
            </span>
          </button>

          <Button type="button" onClick={() => goToStep(3)} className="mt-2">
            {t.simContinuar}
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.simResultado}</p>
            <h1 className="mt-1 text-h2 font-bold tracking-tight text-ink">{t.simValeTitulo}</h1>
          </div>

          <div className="text-center">
            <p className="text-xs font-medium text-ink-muted">
              {mode === "SINGLE" ? t.simValeTempoUnico : t.simValeTempoMensal}
            </p>
            <p className="mt-1.5 text-4xl font-semibold tracking-tight text-ink">
              {result.hoursEquivalent === null ? "—" : <CountUp value={result.hoursEquivalent} format={formatHours} />}
            </p>
          </div>

          <Card className="flex flex-col gap-4 p-4">
            <div>
              <p className="mb-2 text-xs font-medium text-ink-muted">{t.simValeHorizontePergunta}</p>
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
                    {t.simValeAnos(String(years))}
                  </button>
                ))}
              </div>
            </div>

            {/* As duas escolhas lado a lado, como comprimento: "R$ 3.000" e "R$ 5.280" em dois
                cartões pedem uma subtração de cabeça; duas barras dizem o tamanho da escolha
                antes de a pessoa ler qualquer número. */}
            <OutcomeComparison
              a={{
                label: mode === "SINGLE" ? t.simValeBarraInvestirUnico : t.simValeBarraInvestirMensal,
                value: result.futureValueIfInvested,
                hint: t.simValeBarraInvestirHint(String(horizonYears), String(WORTH_IT_ANNUAL_RATE * 100)),
              }}
              b={{
                label: t.simValeBarraGastar,
                value: result.totalInvested,
                hint: mode === "SINGLE" ? t.simValeBarraGastarUnicoHint : t.simValeBarraGastarMensalHint,
              }}
              winner="a"
              verdict={t.simValeVeredito(money(result.difference, { round: true }))}
            />

            {/* A nota fica escrita aqui (e não no catálogo) por causa do teste de jargão do Girly —
                ver o cabeçalho de textos/simuladores.ts. */}

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
              {t.simValeComprar}
            </button>
            <button
              type="button"
              onClick={() => setChoice("nao")}
              className={`flex-1 rounded-full px-2 py-3 text-xs font-semibold transition-colors ${
                choice === "nao" ? "ring-2 ring-danger" : ""
              } bg-danger-soft text-danger`}
            >
              {t.simValeNaoComprar}
            </button>
            <button
              type="button"
              onClick={() => setChoice("duvida")}
              className={`flex-1 rounded-full border border-border px-2 py-3 text-xs font-semibold text-ink-muted transition-colors ${
                choice === "duvida" ? "ring-2 ring-ink-faint" : ""
              } bg-surface-2`}
            >
              {t.simValeAindaNaoSei}
            </button>
          </div>

          {choice && (
            <div
              className={`rounded-2xl p-3.5 text-sm font-medium leading-relaxed ${
                CHOICE_COPY[choice].tone === "success" ? "bg-success-soft text-success" : "bg-surface-2 text-ink-muted"
              }`}
            >
              {CHOICE_COPY[choice].text(t)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
