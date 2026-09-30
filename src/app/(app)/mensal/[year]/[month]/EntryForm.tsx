"use client";

import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import type { ParentCategory } from "@prisma/client";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { CurrencySwitch, ExchangeRateLine } from "@/components/forms/CurrencySwitch";
import { useCurrency } from "@/components/money/MoneyProvider";
import type { CurrencyCode } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { CategoryFields } from "@/components/forms/CategoryFields";
import { defaultEntryDateValue } from "@/lib/date/entry-date-default";
import type { TipoDoLancamento } from "@/lib/profiles/textos/shell";
import { createMonthlyEntryAction, updateMonthlyEntryAction, type MonthlyEntryState } from "./actions";

const initialState: MonthlyEntryState = {};

export function EntryForm({
  year,
  month,
  recentSubcategories = {},
  customCategories = [],
  goals = [],
  onSuccess,
  layout = "inline",
  entryId,
  defaultDescription,
  defaultAmount,
  defaultCategory,
  defaultParentCategory,
  defaultSubcategory,
  defaultCustomCategoryId,
  defaultEntryDate,
  defaultGoalId,
  defaultCurrency,
  defaultExchangeRate,
  recorrente = false,
  tipoRecorrente = "EXPENSE",
}: {
  year: number;
  month: number;
  /** Subcategorias mais usadas recentemente pelo usuário, por categoria-mãe, sugeridas como chips. */
  recentSubcategories?: Partial<Record<ParentCategory, string[]>>;
  /** Categorias personalizadas do usuário, exibidas como chips extras junto das 7 padrão. */
  customCategories?: { id: string; name: string }[];
  /** Metas do usuário, permite vincular um aporte à meta ("Aportar pra viagem"). */
  goals?: { id: string; name: string }[];
  /** Chamado quando o lançamento é salvo com sucesso, usado para fechar o modal, por exemplo. */
  onSuccess?: () => void;
  /** "stacked" empilha os campos verticalmente, melhor dentro de um modal estreito. */
  layout?: "inline" | "stacked";
  /** Presente = modo edição: salva por update em vez de criar um novo. */
  entryId?: string;
  /** Pré-preenchimento (ex.: vindo do lançamento por voz), o usuário sempre revisa antes de salvar. */
  defaultDescription?: string;
  defaultAmount?: number;
  defaultCategory?: string;
  defaultParentCategory?: ParentCategory;
  defaultSubcategory?: string;
  /** Categoria personalizada do lançamento (edição): sem ela o gasto de "Pet" abria sem categoria. */
  defaultCustomCategoryId?: string;
  /** Vazio na edição = lançamento sem data (compra de fatura), e continua sem data. */
  defaultEntryDate?: string;
  defaultGoalId?: string;
  /** Lançamento em outra moeda (salário em euro): `defaultAmount` vem NESSA moeda, com a cotação usada. */
  defaultCurrency?: CurrencyCode;
  defaultExchangeRate?: number;
  /** Editando uma cópia de despesa fixa: pergunta se a mudança vale só pra este mês ou daqui pra frente. */
  recorrente?: boolean;
  /** O tipo da cópia fixa: a pergunta diz "Despesa fixa", "Renda mensal" ou "Aporte mensal". */
  tipoRecorrente?: TipoDoLancamento;
}) {
  const isEditing = Boolean(entryId);
  const [state, formAction, isPending] = useActionState(
    isEditing ? updateMonthlyEntryAction : createMonthlyEntryAction,
    initialState,
  );
  const wasPending = useRef(false);
  const { voz, profileId } = useProfileTheme();
  const t = voz.titulos;
  // O perfil de quando o formulário abriu (não o de agora): se a tela se atualizar com outro
  // perfil enquanto ela preenche, o servidor recusa em vez de gravar no perfil novo.
  const [perfilDaTela] = useState(profileId);
  useSuccessToast(isPending, state.error, t.lancamentoSalvo);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      onSuccess?.();
    }
    wasPending.current = isPending;
  }, [isPending, state.error, onSuccess]);

  const stacked = layout === "stacked";

  // Moeda do lançamento: a do usuário por padrão; quem mora fora troca aqui, no próprio
  // lançamento, sem mexer na moeda principal do app.
  const userCurrency = useCurrency();
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency ?? userCurrency);
  const [amount, setAmount] = useState<number>(defaultAmount ?? 0);
  const [description, setDescription] = useState(defaultDescription ?? "");
  const foreign = currency !== userCurrency;

  return (
    <Card
      as="form"
      // onSubmit + startTransition em vez de action={formAction}: no React 19 o <form action>
      // reseta o formulário depois de TODA ação, inclusive quando ela volta com erro. A data
      // voltava pra hoje, a meta pra "Nenhuma" e o "Repetir" desmarcava — e na segunda tentativa
      // o gasto ia pro mês errado sem ela perceber. Aqui nada é apagado; no sucesso o modal fecha.
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className={stacked ? "flex flex-col gap-3 p-4" : "flex flex-wrap items-end gap-3 p-4"}
    >
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      {entryId && <input type="hidden" name="entryId" value={entryId} />}
      {perfilDaTela && <input type="hidden" name="profileId" value={perfilDaTela} />}
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      {/* A ordem da cabeça, não a do banco: "gastei 45 no mercado". Primeiro o VALOR (o que ela
          tem certeza), depois o que foi, e só então a categoria — que o app já sugere a partir da
          descrição (`descriptionHint`), então quase sempre chega pronta. Antes o formulário abria
          com o tipo e 8 chips de categoria, e o valor ficava lá embaixo. */}
      <div className={`flex flex-col gap-1.5 ${stacked ? "w-full" : "w-40"}`}>
        <CurrencyField
          label={t.formLancValor}
          id="amount"
          name="amount"
          defaultValue={defaultAmount}
          required
          currency={currency}
          onValueChange={setAmount}
          labelExtra={<CurrencySwitch value={currency} onChange={setCurrency} />}
        />
        <input type="hidden" name="currency" value={currency} />
        {foreign && (
          <ExchangeRateLine
            key={currency}
            from={currency}
            to={userCurrency}
            amount={amount}
            defaultRate={defaultCurrency === currency ? defaultExchangeRate : undefined}
          />
        )}
      </div>
      <Field
        label={t.formLancDescricao}
        id="description"
        name="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t.formLancDescricaoPlaceholder}
        className={stacked ? "w-full" : ""}
      />
      <CategoryFields
        recentSubcategories={recentSubcategories}
        customCategories={customCategories}
        stacked={stacked}
        defaultCategory={defaultCategory}
        defaultParentCategory={defaultParentCategory}
        defaultSubcategory={defaultSubcategory}
        defaultCustomCategoryId={defaultCustomCategoryId}
        descriptionHint={description}
      />
      <Field
        label={t.formLancData}
        id="entryDate"
        name="entryDate"
        type="date"
        defaultValue={defaultEntryDateValue({ defaultEntryDate, isEditing, year, month, today: new Date() })}
        className={stacked ? "w-full" : "w-36"}
      />
      {goals.length > 0 && (
        <label className={`flex flex-col gap-1.5 ${stacked ? "w-full" : ""}`}>
          <span className="text-xs font-medium text-ink-muted">{t.formLancMetaVinculada}</span>
          <select
            name="goalId"
            defaultValue={defaultGoalId ?? ""}
            className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="">{t.formLancNenhuma}</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!isEditing && (
        // min-h-11 + caixinha de 20px: a linha inteira é o alvo do toque (44px), não os 14px da caixa.
        <label className={`flex min-h-11 items-center gap-2.5 text-xs text-ink-muted ${stacked ? "w-full" : ""}`}>
          <input type="checkbox" name="repeatMonthly" className="h-5 w-5 shrink-0 accent-accent" />
          {t.formLancRepetir(year)}
        </label>
      )}
      {isEditing && recorrente && (
        <fieldset className={`flex flex-col gap-2 ${stacked ? "w-full" : ""}`}>
          <legend className="mb-1.5 text-xs font-medium text-ink-muted">{t.uiFixoEscopo(tipoRecorrente)}</legend>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="escopo" value="este" defaultChecked className="h-4 w-4 accent-accent" />
            {t.uiFixoSoEste}
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="escopo" value="proximos" className="h-4 w-4 accent-accent" />
            {t.uiFixoEsteEProximos}
          </label>
        </fieldset>
      )}
      {/* Na gaveta é o botão principal da tela: tamanho cheio (44px de altura), não o compacto. */}
      <Button type="submit" disabled={isPending} size={stacked ? "md" : "sm"} className={stacked ? "w-full" : ""}>
        {isPending ? t.formSalvando : isEditing ? t.formLancSalvar : t.formLancLancar}
      </Button>
    </Card>
  );
}
