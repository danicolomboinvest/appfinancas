"use client";

import { useActionState, useState } from "react";
import { CONTROL_CLASSES } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { PercentField } from "@/components/ui/PercentField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { saveEmergencyFundAction, type EmergencyFundState } from "./actions";

const initialState: EmergencyFundState = {};

/**
 * "Quantos meses guardar" com atalhos: o campo numérico vazio obrigava a pessoa a inventar um
 * número sem referência nenhuma. Os atalhos dizem o que cada escolha significa na vida dela.
 */
function MonthsField({ defaultValue }: { defaultValue?: number }) {
  const [meses, setMeses] = useState<number | undefined>(defaultValue);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="targetMonths" className="text-xs font-medium text-ink-muted">
        Quantos meses quer ter guardados?
      </label>
      <input
        id="targetMonths"
        name="targetMonths"
        type="number"
        min={1}
        required
        value={meses ?? ""}
        onChange={(e) => setMeses(e.target.value === "" ? undefined : Number(e.target.value))}
        className={`${CONTROL_CLASSES} w-full`}
      />
      <div className="flex flex-wrap gap-2">
        {MESES_SUGERIDOS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={meses === m}
            onClick={() => setMeses(m)}
            className={`rounded-full border px-3 py-1.5 text-caption transition-colors ${
              meses === m
                ? "border-accent bg-accent-soft font-semibold text-accent-strong"
                : "border-border-strong text-ink-muted hover:border-accent hover:text-ink"
            }`}
          >
            {m} meses
          </button>
        ))}
      </div>
      <p className="text-caption leading-relaxed text-ink-faint">
        Renda estável costuma pedir 6. Autônomo ou renda variável, 12.
      </p>
    </div>
  );
}

type Defaults = {
  targetMonths?: number;
  monthlyExpenseBase?: number;
  currentAmount?: number;
  monthlyContribution?: number;
  annualRate?: number;
};

/** Quantos meses guardar. Chips em vez de um campo numérico vazio: ninguém sabe "o número certo". */
const MESES_SUGERIDOS = [3, 6, 8, 12];

export function EmergencyFundForm({
  defaults,
  typicalExpense,
}: {
  defaults: Defaults;
  /** Gasto médio dos últimos meses fechados, para o app não perguntar o que ele já sabe. */
  typicalExpense?: { monthlyAverage: number; monthsUsed: number } | null;
}) {
  const [state, formAction, isPending] = useActionState(saveEmergencyFundAction, initialState);
  useSuccessToast(isPending, state.error);

  return (
    <Card as="form" action={formAction} className="flex flex-col gap-5 p-5">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      {/* Uma pergunta por vez, em português, na ordem em que a conta nasce: quanto custa um
          mês, quantos meses guardar, onde você está e quanto consegue pôr. */}
      <div className="flex flex-col gap-5">
        <CurrencyField
          label="Quanto custa um mês da sua vida?"
          name="monthlyExpenseBase"
          defaultValue={defaults.monthlyExpenseBase ?? typicalExpense?.monthlyAverage}
          suggestion={
            typicalExpense
              ? {
                  value: typicalExpense.monthlyAverage,
                  label: `Seus gastos dos últimos ${typicalExpense.monthsUsed === 1 ? "mês fechado" : `${typicalExpense.monthsUsed} meses fechados`} dão essa média.`,
                }
              : undefined
          }
          hint="É esse valor que a reserva precisa cobrir enquanto a renda não volta."
          required
        />

        <MonthsField defaultValue={defaults.targetMonths} />

        <div className="grid grid-cols-2 gap-4">
          <CurrencyField label="Já tenho guardado" name="currentAmount" defaultValue={defaults.currentAmount} />
          <CurrencyField
            label="Guardo por mês"
            name="monthlyContribution"
            defaultValue={defaults.monthlyContribution}
            required
          />
        </div>

        <PercentField
          label="Quanto a reserva rende por ano"
          name="annualRate"
          defaultValue={defaults.annualRate}
          suggestions={[0.1, 0.12, 0.14]}
          hint="Reserva fica em aplicação de liquidez diária, então costuma render perto do CDI."
          required
        />
      </div>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </Card>
  );
}
