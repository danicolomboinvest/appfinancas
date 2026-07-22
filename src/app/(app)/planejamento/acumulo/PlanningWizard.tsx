"use client";

import { useActionState, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { HelpTooltip } from "@/components/forms/HelpTooltip";
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
  /** Explicação que aparece atrás do "?" (mesma linguagem dos simuladores). */
  help?: string;
  fields: FieldDef[];
};

/** Um conceito por tela. Começa pelo custo da vida desejada, como pede o briefing. */
const STEPS: StepDef[] = [
  {
    question: "Quanto custa a vida que você quer?",
    help: "O gasto mensal que você gostaria de bancar só com renda passiva, em valores de hoje.",
    fields: [{ name: "desiredPassiveIncome", label: "Gasto mensal desejado", affix: "R$", placeholder: "8000" }],
  },
  {
    question: "Você já tem outras rendas?",
    help: "Aluguel, INSS, pensão, rendas que continuarão quando você parar de trabalhar. Deixe zerado se não houver.",
    fields: [{ name: "otherPassiveIncome", label: "Outras rendas passivas por mês", affix: "R$", optional: true, placeholder: "0" }],
  },
  {
    question: "Quanto você já tem investido?",
    help: "Tudo que já está aplicado hoje e vai compor esse patrimônio.",
    fields: [{ name: "currentPatrimony", label: "Patrimônio investido atual", affix: "R$", placeholder: "50000" }],
  },
  {
    question: "Quanto consegue aportar por mês?",
    help: "O valor médio que você consegue investir todo mês durante a fase de acúmulo.",
    fields: [{ name: "monthlyContributionAccumulation", label: "Aporte mensal médio", affix: "R$", placeholder: "2000" }],
  },
  {
    question: "Sua idade e quando quer parar",
    help: "A idade objetivo é quando você quer atingir a independência. A expectativa de vida é opcional.",
    fields: [
      { name: "currentAge", label: "Idade atual", affix: null, placeholder: "30" },
      { name: "retirementAge", label: "Idade objetivo", affix: null, placeholder: "50" },
      { name: "lifeExpectancyAge", label: "Expectativa de vida", affix: null, optional: true, placeholder: "90" },
    ],
  },
  {
    question: "Premissas de rentabilidade",
    help: "Já preenchemos valores comuns, ajuste se quiser. Taxas ao ano.",
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
  const single = current.fields.length === 1;

  // Só avança quando os campos obrigatórios do passo atual têm número válido.
  const canAdvance = current.fields.every((f) => {
    if (f.optional) return true;
    const v = values[f.name];
    return v !== undefined && v.trim() !== "" && !Number.isNaN(Number(v));
  });

  function setField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  /** Input no estilo dos simuladores: grande e limpo (big) no passo, com prefixo R$ / sufixo %. */
  function inputFor(field: FieldDef, big: boolean) {
    return (
      <div className="flex items-baseline gap-2">
        {field.affix === "R$" && <span className={big ? "text-2xl text-ink-muted" : "text-sm text-ink-muted"}>R$</span>}
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          autoFocus={big}
          placeholder={field.placeholder}
          value={values[field.name] ?? ""}
          onChange={(e) => setField(field.name, e.target.value)}
          className={
            big
              ? "w-full bg-transparent text-3xl font-semibold tabular-nums text-ink outline-none placeholder:font-normal placeholder:text-ink-faint"
              : "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-base font-medium tabular-nums text-ink outline-none focus:border-accent"
          }
        />
        {field.affix === "%" && <span className={big ? "text-2xl text-ink-muted" : "text-sm text-ink-muted"}>%</span>}
      </div>
    );
  }

  return (
    <form action={formAction} className="mx-auto flex w-full max-w-md flex-col gap-6">
      {/* Progresso + voltar (igual aos simuladores). */}
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
        <ProgressBar percent={(step + 1) / STEPS.length} tone="accent" className="flex-1" />
      </div>

      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div className="flex flex-col gap-5">
        {/* Pergunta com "?" explicando. */}
        <h1 className="flex items-center font-serif text-2xl text-ink">
          {current.question}
          {current.help && <HelpTooltip text={current.help} />}
        </h1>

        {single ? (
          <Card className="p-4">{inputFor(current.fields[0], true)}</Card>
        ) : (
          <Card className="flex flex-col gap-4 p-4">
            {current.fields.map((f) => (
              <label key={f.name} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">
                  {f.label}
                  {f.optional && <span className="ml-1 text-ink-faint">(opcional)</span>}
                </span>
                {inputFor(f, false)}
              </label>
            ))}
          </Card>
        )}

        {/* Hidden inputs: carregam TODOS os valores na submissão, no formato que a action espera. */}
        {Object.entries(values).map(([name, value]) => (
          <input
            key={name}
            type="hidden"
            name={name}
            value={RATE_FIELDS.has(name) ? (value === "" ? "" : String(Number(value) / 100)) : value}
          />
        ))}

        {/* Avançar / concluir, mesmo botão dos simuladores. */}
        <button
          type={isLast ? "submit" : "button"}
          onClick={isLast ? undefined : () => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          disabled={!canAdvance || (isLast && isPending)}
          className="mt-1 flex items-center justify-center gap-1 rounded-full bg-ink px-5 py-3 text-sm font-medium text-canvas transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
        >
          {isLast ? (isPending ? "Calculando..." : "Ver meu plano") : "Continuar"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
