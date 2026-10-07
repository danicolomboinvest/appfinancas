"use client";

import { Explica } from "@/components/ui/Explica";

import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

import { useActionState, useState, type ElementType } from "react";
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
  const { voz } = useProfileTheme();
  const [meses, setMeses] = useState<number | undefined>(defaultValue);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="targetMonths" className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        {voz.titulos.formMeses}
        <Explica>{voz.titulos.formMesesHint}</Explica>
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
            {voz.titulos.formReservaMesesChip(m)}
          </button>
        ))}
      </div>
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
  reserveInAssets = 0,
  semMoldura = false,
}: {
  defaults: Defaults;
  /** Dentro da janela do lápis (07/10/2026): sem o cartão em volta, que virava moldura dupla. */
  semMoldura?: boolean;
  /** Gasto médio dos últimos meses fechados, para o app não perguntar o que ele já sabe. */
  typicalExpense?: { monthlyAverage: number; monthsUsed: number } | null;
  /** Soma dos ativos marcados como reserva na carteira, pra sugerir o "já tenho guardado". */
  reserveInAssets?: number;
}) {
  const { voz } = useProfileTheme();
  const [state, formAction, isPending] = useActionState(saveEmergencyFundAction, initialState);
  useSuccessToast(isPending, state.error);
  // Na janela do lápis, um <form> simples; na tela, o cartão de sempre.
  const Raiz = (semMoldura ? "form" : Card) as ElementType;

  return (
    <Raiz {...(semMoldura ? {} : { as: "form" })} action={formAction} className={semMoldura ? "flex flex-col gap-5" : "flex flex-col gap-5 p-5"}>
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      {/* Uma pergunta por vez, em português, na ordem em que a conta nasce: quanto custa um
          mês, quantos meses guardar, onde você está e quanto consegue pôr. */}
      <div className="flex flex-col gap-5">
        <CurrencyField
          label={voz.titulos.formCusto}
          name="monthlyExpenseBase"
          defaultValue={defaults.monthlyExpenseBase ?? typicalExpense?.monthlyAverage}
          suggestion={
            typicalExpense
              ? {
                  value: typicalExpense.monthlyAverage,
                  label: voz.titulos.formReservaMediaSugestao(typicalExpense.monthsUsed),
                }
              : undefined
          }
          hint={voz.titulos.formCustoHint}
          required
        />

        <MonthsField defaultValue={defaults.targetMonths} />

        <div className="grid grid-cols-2 gap-4">
          {/* A chave é o valor salvo: o campo guarda o que foi digitado e só lê o valor inicial ao
              montar. Quando outra ação muda o "já tenho" ("Usar o da Carteira", a sobra do
              fechamento), o campo remonta com o número novo, senão o próximo Salvar regravava o
              antigo sem aviso. Só este campo: o formulário inteiro remontando perderia o aviso
              de "salvo". */}
          <CurrencyField
            key={`ja-tenho-${defaults.currentAmount ?? ""}`}
            label={voz.titulos.formJaTenho}
            name="currentAmount"
            defaultValue={defaults.currentAmount}
            suggestion={reserveInAssets > 0 ? { value: reserveInAssets, label: voz.titulos.formReservaCarteiraSugestao } : undefined}
          />
          <CurrencyField
            label={voz.titulos.formGuardoPorMes}
            name="monthlyContribution"
            defaultValue={defaults.monthlyContribution}
            required
          />
        </div>

        <PercentField
          label={voz.titulos.formRende}
          name="annualRate"
          defaultValue={defaults.annualRate}
          suggestions={[0.1, 0.12, 0.14]}
          hint={voz.titulos.formRendeHint}
          required
        />
      </div>
      <Button type="submit" disabled={isPending} className="w-fit" data-guia="reserva-salvar">
        {isPending ? voz.titulos.formSalvando : voz.titulos.formSalvar}
      </Button>
    </Raiz>
  );
}
