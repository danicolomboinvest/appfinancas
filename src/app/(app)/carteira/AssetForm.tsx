"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, SelectField } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { PercentField } from "@/components/ui/PercentField";
import { Button } from "@/components/ui/Button";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { createAssetAction, updateAssetAction, type AssetFormState } from "./actions";

const initialState: AssetFormState = {};

const ASSET_CLASS_OPTIONS = [
  { value: "RENDA_FIXA", label: "Renda Fixa" },
  { value: "ACAO", label: "Ação" },
  { value: "FII", label: "FII" },
  { value: "TESOURO_DIRETO", label: "Tesouro Direto" },
  { value: "FUNDO", label: "Fundo" },
  { value: "CRIPTO", label: "Cripto" },
  { value: "OUTRO", label: "Outro" },
];

const OBJECTIVE_OPTIONS = [
  { value: "OUTRO", label: "Outro" },
  { value: "RESERVA_EMERGENCIA", label: "Reserva de emergência" },
  { value: "LIBERDADE_FINANCEIRA", label: "Liberdade financeira" },
  { value: "META", label: "Meta" },
];

type Defaults = {
  name?: string;
  ticker?: string;
  assetClass?: string;
  objective?: string;
  goalId?: string;
  investedValue?: number;
  currentValue?: number;
  idealAllocationPercent?: number;
};

/** Form de ativo — sem `assetId`/`defaults` cria um ativo novo; com eles, edita um existente. */
export function AssetForm({
  goals,
  assetId,
  defaults = {},
  submitLabel = "Adicionar",
  onSuccess,
}: {
  goals: { id: string; name: string }[];
  assetId?: string;
  defaults?: Defaults;
  submitLabel?: string;
  onSuccess?: () => void;
}) {
  const action = assetId ? updateAssetAction.bind(null, assetId) : createAssetAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [objective, setObjective] = useState(defaults.objective ?? "OUTRO");
  const wasPending = useRef(false);
  useSuccessToast(isPending, state.error, assetId ? "Ativo atualizado com sucesso." : "Ativo adicionado com sucesso.");

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      onSuccess?.();
    }
    wasPending.current = isPending;
  }, [isPending, state.error, onSuccess]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Field label="Nome" id="name" name="name" required defaultValue={defaults.name} placeholder="Ex.: Tesouro Selic 2029" />
      <Field label="Ticker (opcional)" id="ticker" name="ticker" className="w-24" defaultValue={defaults.ticker} />
      <SelectField label="Classe" id="assetClass" name="assetClass" defaultValue={defaults.assetClass}>
        {ASSET_CLASS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Objetivo"
        id="objective"
        name="objective"
        value={objective}
        onChange={(e) => setObjective(e.target.value)}
      >
        {OBJECTIVE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      {objective === "META" && (
        <SelectField label="Meta vinculada" id="goalId" name="goalId" defaultValue={defaults.goalId}>
          <option value="">Selecione...</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.name}
            </option>
          ))}
        </SelectField>
      )}
      <CurrencyField
        label="Valor investido (R$)"
        id="investedValue"
        name="investedValue"
        defaultValue={defaults.investedValue}
        className="w-32"
      />
      <CurrencyField
        label="Valor atual (R$)"
        id="currentValue"
        name="currentValue"
        required
        defaultValue={defaults.currentValue}
        className="w-32"
      />
      <PercentField label="Alocação ideal" id="idealAllocationPercent" name="idealAllocationPercent" defaultValue={defaults.idealAllocationPercent} />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
