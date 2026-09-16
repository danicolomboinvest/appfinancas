"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { GoalIcon } from "@prisma/client";
import { Plane, Home, Car, PiggyBank, Target } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { PercentField } from "@/components/ui/PercentField";
import { MonthYearField } from "@/components/ui/MonthYearField";
import { Button } from "@/components/ui/Button";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { createGoalAction, updateGoalAction, type GoalFormState } from "./actions";
import { detectGoalKind } from "@/lib/planning/goal-kind";

const initialState: GoalFormState = {};

const ICON_OPTIONS: { value: GoalIcon; label: string; Icon: typeof Target }[] = [
  { value: "VIAGEM", label: "Viagem", Icon: Plane },
  { value: "CASA", label: "Casa", Icon: Home },
  { value: "CARRO", label: "Carro", Icon: Car },
  { value: "APOSENTADORIA", label: "Aposentadoria", Icon: PiggyBank },
  { value: "GENERICO", label: "Genérico", Icon: Target },
];

/**
 * O ícone acompanha o nome enquanto a pessoa digita — "Entrada do apê" acende a casinha
 * sozinha. Mas no instante em que ela toca num botão, o palpite para de valer para sempre:
 * um app que desfaz a escolha da pessoa a cada letra digitada é pior que um que não adivinha.
 */
function GoalIconPicker({ defaultValue = "GENERICO", nome }: { defaultValue?: GoalIcon; nome: string }) {
  const [icon, setIcon] = useState<GoalIcon>(defaultValue);
  const [escolhidoAMao, setEscolhidoAMao] = useState(defaultValue !== "GENERICO");
  const sugerido = detectGoalKind(nome);
  const atual: GoalIcon = escolhidoAMao ? icon : (sugerido ?? icon);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-muted">Ícone</span>
      <div className="flex gap-1.5">
        {ICON_OPTIONS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            title={label}
            onClick={() => {
              setIcon(value);
              setEscolhidoAMao(true);
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
              atual === value
                ? "border-accent bg-accent-soft text-accent-strong"
                : "border-border-strong bg-surface-2 text-ink-muted hover:text-ink"
            }`}
          >
            <Icon size={16} strokeWidth={1.75} />
          </button>
        ))}
      </div>
      <input type="hidden" name="icon" value={atual} />
    </div>
  );
}

type Defaults = {
  name?: string;
  targetAmount?: number;
  targetDate?: string;
  currentAmount?: number;
  annualRate?: number;
  icon?: GoalIcon;
};

export function GoalForm({
  goalId,
  defaults,
  submitLabel,
  onSuccess,
}: {
  /** Presente = editar meta existente; ausente = criar meta nova. */
  goalId?: string;
  defaults: Defaults;
  submitLabel: string;
  onSuccess?: () => void;
}) {
  const action = goalId ? updateGoalAction.bind(null, goalId) : createGoalAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [nome, setNome] = useState(defaults.name ?? "");
  const wasPending = useRef(false);
  useSuccessToast(isPending, state.error, goalId ? "Meta atualizada com sucesso." : "Meta criada com sucesso.");

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      onSuccess?.();
    }
    wasPending.current = isPending;
  }, [isPending, state.error, onSuccess]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Field
        label="Nome da meta"
        id="name"
        name="name"
        required
        placeholder="Ex.: Viagem, Entrada do apê, Trocar de carro"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <GoalIconPicker defaultValue={defaults.icon} nome={nome} />
      <CurrencyField
        label="Valor-alvo"
        id="targetAmount"
        name="targetAmount"
        required
        defaultValue={defaults.targetAmount}
      />
      <CurrencyField
        label="Já guardado"
        id="currentAmount"
        name="currentAmount"
        defaultValue={defaults.currentAmount ?? 0}
      />
      <MonthYearField label="Mês/ano alvo" id="targetDate" name="targetDate" required defaultValue={defaults.targetDate} />
      <PercentField label="Rentabilidade anual" id="annualRate" name="annualRate" required defaultValue={defaults.annualRate} />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
