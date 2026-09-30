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
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { createGoalAction, updateGoalAction, type GoalFormState } from "./actions";
import { detectGoalKind } from "@/lib/planning/goal-kind";

const initialState: GoalFormState = {};

/** Só o desenho de cada ícone; o nome que aparece ao passar o mouse vem da voz do tema. */
const ICON_OPTIONS: { value: GoalIcon; Icon: typeof Target }[] = [
  { value: "VIAGEM", Icon: Plane },
  { value: "CASA", Icon: Home },
  { value: "CARRO", Icon: Car },
  { value: "APOSENTADORIA", Icon: PiggyBank },
  { value: "GENERICO", Icon: Target },
];

/**
 * O ícone acompanha o nome enquanto a pessoa digita — "Entrada do apê" acende a casinha
 * sozinha. Mas no instante em que ela toca num botão, o palpite para de valer para sempre:
 * um app que desfaz a escolha da pessoa a cada letra digitada é pior que um que não adivinha.
 */
function GoalIconPicker({ defaultValue = "GENERICO", nome }: { defaultValue?: GoalIcon; nome: string }) {
  const { voz } = useProfileTheme();
  const [icon, setIcon] = useState<GoalIcon>(defaultValue);
  const [escolhidoAMao, setEscolhidoAMao] = useState(defaultValue !== "GENERICO");
  const sugerido = detectGoalKind(nome);
  const atual: GoalIcon = escolhidoAMao ? icon : (sugerido ?? icon);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-muted">{voz.titulos.formMetaIcone}</span>
      {/* No celular não existe "passar o mouse": o nome do ícone vai no aria-label e o do
          escolhido aparece escrito do lado, senão ninguém sabe o que o cofrinho quer dizer. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {ICON_OPTIONS.map(({ value, Icon }) => (
          <button
            key={value}
            type="button"
            title={voz.titulos.formMetaIcones[value]}
            aria-label={voz.titulos.formMetaIcones[value]}
            aria-pressed={atual === value}
            onClick={() => {
              setIcon(value);
              setEscolhidoAMao(true);
            }}
            className={`flex size-11 items-center justify-center rounded-xl border transition-colors ${
              atual === value
                ? "border-accent bg-accent-soft text-accent-strong"
                : "border-border-strong bg-surface-2 text-ink-muted hover:text-ink"
            }`}
          >
            <Icon size={18} strokeWidth={1.75} />
          </button>
        ))}
        <span className="ml-1 text-caption text-ink-muted">{voz.titulos.formMetaIcones[atual]}</span>
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
  /** Sem isso, o botão fala na voz do tema: "Adicionar meta" ao criar, "Salvar alterações" ao editar. */
  submitLabel?: string;
  onSuccess?: () => void;
}) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const action = goalId ? updateGoalAction.bind(null, goalId) : createGoalAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [nome, setNome] = useState(defaults.name ?? "");
  const wasPending = useRef(false);
  useSuccessToast(isPending, state.error, goalId ? t.formMetaAtualizada : t.formMetaCriada);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      onSuccess?.();
    }
    wasPending.current = isPending;
  }, [isPending, state.error, onSuccess]);

  return (
    // Em coluna, como os outros formulários do app (reserva, aposentadoria). O flex-wrap em
    // linha deixava cada campo com uma largura no modal de 375px e o botão de salvar era o
    // menor elemento da tela, sobrando no canto.
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label={t.formMetaNome}
        id="name"
        name="name"
        required
        placeholder={t.formMetaNomePlaceholder}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <GoalIconPicker defaultValue={defaults.icon} nome={nome} />
      <CurrencyField
        label={t.formMetaValorAlvo}
        id="targetAmount"
        name="targetAmount"
        required
        defaultValue={defaults.targetAmount}
      />
      <CurrencyField
        label={t.formMetaJaGuardado}
        id="currentAmount"
        name="currentAmount"
        defaultValue={defaults.currentAmount ?? 0}
        hint={t.formMetaJaGuardadoHint}
      />
      <MonthYearField label={t.formMetaMesAno} id="targetDate" name="targetDate" required defaultValue={defaults.targetDate} />
      <PercentField
        label={t.formMetaRende}
        id="annualRate"
        name="annualRate"
        required
        defaultValue={defaults.annualRate ?? 0.1}
        suggestions={[0.06, 0.1, 0.12]}
        hint={t.formMetaRendeHint}
      />
      {/* O erro fica colado no botão: no topo, depois de rolar o modal até aqui, ele sumia da vista. */}
      {state.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="w-full sm:w-fit">
        {isPending ? t.formSalvando : (submitLabel ?? (goalId ? t.formMetaSalvar : t.formMetaAdicionar))}
      </Button>
    </form>
  );
}
