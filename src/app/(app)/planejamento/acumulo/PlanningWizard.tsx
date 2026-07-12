"use client";

import { useActionState, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { savePlanningParamsAction, type PlanningParamsState } from "./actions";

const initialState: PlanningParamsState = {};

type FieldDef = {
  name: string;
  label: string;
  affix: "R$" | "%" | null;
  optional?: boolean;
  placeholder?: string;
};

type StepDef = {
  question: string;
  hint?: string;
  fields: FieldDef[];
};

/** Um conceito por tela (item 4). Começa pelo custo da vida desejada, como pede o briefing. */
const STEPS: StepDef[] = [
  {
    question: "Quanto custa a vida que você quer?",
    hint: "O gasto mensal que você gostaria de bancar só com renda passiva, em valores de hoje.",
    fields: [{ name: "desiredPassiveIncome", label: "Gasto mensal desejado", affix: "R$", placeholder: "8.000" }],
  },
  {
    question: "Você já tem outras rendas?",
    hint: "Aluguel, INSS, pensão — rendas que continuarão quando você parar de trabalhar. Deixe zerado se não houver.",
    fields: [{ name: "otherPassiveIncome", label: "Outras rendas passivas por mês", affix: "R$", optional: true, placeholder: "0" }],
  },
  {
    question: "Quanto você já tem investido?",
    hint: "Tudo que já está aplicado hoje e vai compor esse patrimônio.",
    fields: [{ name: "currentPatrimony", label: "Patrimônio investido atual", affix: "R$", placeholder: "50.000" }],
  },
  {
    question: "Quanto consegue aportar por mês?",
    hint: "O valor médio que você consegue investir todo mês durante a fase de acúmulo.",
    fields: [{ name: "monthlyContributionAccumulation", label: "Aporte mensal médio", affix: "R$", placeholder: "2.000" }],
  },
  {
    question: "Sua idade e quando quer parar",
    hint: "A idade objetivo é quando você quer atingir a independência. A expectativa de vida é opcional.",
    fields: [
      { name: "currentAge", label: "Idade atual", affix: null, placeholder: "30" },
      { name: "retirementAge", label: "Idade objetivo", affix: null, placeholder: "50" },
      { name: "lifeExpectancyAge", label: "Expectativa de vida", affix: null, optional: true, placeholder: "90" },
    ],
  },
  {
    question: "Premissas de rentabilidade",
    hint: "Já preenchemos valores comuns — ajuste se quiser. Taxas ao ano.",
    fields: [
      { name: "accumulationAnnualRate", label: "Rendimento na fase de acúmulo", affix: "%", placeholder: "10" },
      { name: "inflationAnnualRate", label: "Inflação média", affix: "%", placeholder: "4,5" },
      { name: "usufructAnnualRate", label: "Rendimento vivendo de renda", affix: "%", placeholder: "6" },
    ],
  },
];

/** Percentuais como texto (o usuário digita "10"); convertidos para fração (0.10) na submissão,
 * no mesmo formato que o PercentField e o schema esperam. */
const RATE_FIELDS = new Set(["accumulationAnnualRate", "inflationAnnualRate", "usufructAnnualRate"]);
const DEFAULT_VALUES: Record<string, string> = {
  otherPassiveIncome: "0",
  accumulationAnnualRate: "10",
  inflationAnnualRate: "4.5",
  usufructAnnualRate: "6",
};

export function PlanningWizard() {
  const [state, formAction, isPending] = useActionState(savePlanningParamsAction, initialState);
  useSuccessToast(isPending, state.error);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(DEFAULT_VALUES);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Só avança quando os campos obrigatórios do passo atual estão preenchidos com número válido.
  const canAdvance = current.fields.every((f) => {
    if (f.optional) return true;
    const v = values[f.name];
    return v !== undefined && v.trim() !== "" && !Number.isNaN(Number(v));
  });

  return (
    <Card as="form" action={formAction} className="flex flex-col gap-6 p-6">
      {/* Progresso */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-caption text-ink-muted">
          <span>
            Passo {step + 1} de {STEPS.length}
          </span>
          <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-ink transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      {/* Pergunta do passo */}
      <div className="flex flex-col gap-1">
        <h2 className="text-h1 font-semibold tracking-tight text-ink">{current.question}</h2>
        {current.hint && <p className="text-sm text-ink-muted">{current.hint}</p>}
      </div>

      <div className="flex flex-col gap-4">
        {current.fields.map((f) => (
          <label key={f.name} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              {f.label}
              {f.optional && <span className="ml-1 text-ink-faint">(opcional)</span>}
            </span>
            <div className="flex items-center rounded-xl border border-border-strong bg-surface focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
              {f.affix === "R$" && <span className="pl-4 text-lg text-ink-muted">R$</span>}
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                autoFocus
                placeholder={f.placeholder}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                className="w-full bg-transparent px-4 py-3 text-2xl font-semibold tabular-nums text-ink placeholder:text-ink-faint placeholder:font-normal focus:outline-none"
              />
              {f.affix === "%" && <span className="pr-4 text-lg text-ink-muted">%</span>}
            </div>
          </label>
        ))}
      </div>

      {/* Hidden inputs: carregam TODOS os valores na submissão, no formato que a action espera. */}
      {Object.entries(values).map(([name, value]) => (
        <input
          key={name}
          type="hidden"
          name={name}
          value={RATE_FIELDS.has(name) ? (value === "" ? "" : String(Number(value) / 100)) : value}
        />
      ))}

      {/* Navegação */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:text-ink disabled:invisible"
        >
          <ChevronLeft size={16} /> Voltar
        </button>

        {isLast ? (
          <Button type="submit" disabled={isPending || !canAdvance}>
            {isPending ? "Calculando..." : "Ver meu plano"}
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!canAdvance}
            className="flex items-center gap-1 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            Próximo <ChevronRight size={16} />
          </button>
        )}
      </div>
    </Card>
  );
}
