"use client";

import { useActionState, useState } from "react";
import { Field, SelectField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createAssetAction, type AssetFormState } from "./actions";

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

export function AssetForm({ goals }: { goals: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(createAssetAction, initialState);
  const [objective, setObjective] = useState("OUTRO");

  return (
    <Card as="form" action={formAction} className="flex flex-wrap items-end gap-3 p-4">
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Field label="Nome" id="name" name="name" required placeholder="Ex.: Tesouro Selic 2029" />
      <Field label="Ticker (opcional)" id="ticker" name="ticker" className="w-24" />
      <SelectField label="Classe" id="assetClass" name="assetClass">
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
        <SelectField label="Meta vinculada" id="goalId" name="goalId">
          <option value="">Selecione...</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.name}
            </option>
          ))}
        </SelectField>
      )}
      <Field
        label="Valor atual (R$)"
        id="currentValue"
        name="currentValue"
        type="number"
        step="0.01"
        min="0"
        required
        className="w-32"
      />
      <Field
        label="Alocação ideal (ex.: 0.1 = 10%)"
        id="idealAllocationPercent"
        name="idealAllocationPercent"
        type="number"
        step="0.001"
        min="0"
        max="1"
        className="w-32"
      />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Salvando..." : "Adicionar"}
      </Button>
    </Card>
  );
}
