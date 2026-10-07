"use client";

import Link from "next/link";
import { CreditCard } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import type { ParentCategory } from "@prisma/client";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { CurrencySwitch, ExchangeRateLine } from "@/components/forms/CurrencySwitch";
import { useCurrency } from "@/components/money/MoneyProvider";
import { CURRENCIES, type CurrencyCode } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { CategoryFields } from "@/components/forms/CategoryFields";
import { CasalFields } from "@/components/forms/CasalFields";
import { defaultEntryDateValue } from "@/lib/date/entry-date-default";
import type { TipoDoLancamento } from "@/lib/profiles/textos/shell";
import { createMonthlyEntryAction, updateMonthlyEntryAction, type MonthlyEntryState } from "./actions";

const initialState: MonthlyEntryState = {};

/** A última escolha do "No cartão" (quem paga tudo no cartão não precisa marcar todo gasto). */
const ULTIMO_NO_CARTAO = "spi-ultimo-no-cartao";
function lerUltimoNoCartao(): boolean {
  try {
    return window.localStorage.getItem(ULTIMO_NO_CARTAO) === "1";
  } catch {
    return false;
  }
}

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
  defaultPessoa,
  defaultDoCasal,
  defaultNoCartao,
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
  /** Perfil Casal (edição): quem pagou e se era da casa. */
  defaultPessoa?: string | null;
  defaultDoCasal?: boolean | null;
  /** Edição: o gasto conta no limite do cartão (marcado ou linha de fatura). */
  defaultNoCartao?: boolean;
}) {
  const isEditing = Boolean(entryId);
  const [state, formAction, isPending] = useActionState(
    isEditing ? updateMonthlyEntryAction : createMonthlyEntryAction,
    initialState,
  );
  const wasPending = useRef(false);
  const { voz, profileId, cartaoComLimite } = useProfileTheme();
  const t = voz.titulos;
  // O perfil de quando o formulário abriu (não o de agora): se a tela se atualizar com outro
  // perfil enquanto ela preenche, o servidor recusa em vez de gravar no perfil novo.
  const [perfilDaTela] = useState(profileId);
  // Gasto no cartão com limite: o toast diz quanto falta no lugar do "Lançado".
  useSuccessToast(isPending, state.error, state.aviso ?? t.lancamentoSalvo);

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
  // O tipo escolhido nos chips: os campos do Casal perguntam "quem pagou" ou "quem recebeu".
  const [tipo, setTipo] = useState(defaultCategory ?? "EXPENSE");
  // "No cartão de crédito" (limite do cartão, 06/10/2026). Novo lançamento começa com a última
  // escolha; a edição, com o que o gasto já é. O formulário só existe dentro de um modal aberto
  // pela pessoa, então ler o aparelho aqui não desencontra do servidor.
  const [noCartao, setNoCartao] = useState<boolean>(() => (isEditing ? Boolean(defaultNoCartao) : lerUltimoNoCartao()));
  // "Esse dinheiro é para as contas do mês seguinte" (ver aplicarMesSeguinte em actions.ts). O mês
  // de base é o da DATA: na edição de uma entrada já empurrada, a página é a do mês seguinte e a
  // data continua no mês em que o dinheiro caiu, e é isso que diz que ela já está marcada.
  const mesDaData = defaultEntryDate ? Number(defaultEntryDate.slice(5, 7)) : month;
  const anoDaData = defaultEntryDate ? Number(defaultEntryDate.slice(0, 4)) : year;
  const jaNoMesSeguinte = isEditing && Boolean(defaultEntryDate) && (anoDaData !== year || mesDaData !== month);
  const nomeDoMesSeguinte = new Date(anoDaData, mesDaData, 1).toLocaleDateString("pt-BR", { month: "long" });

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
        if (cartaoComLimite && tipo === "EXPENSE" && !isEditing) {
          try {
            window.localStorage.setItem(ULTIMO_NO_CARTAO, noCartao ? "1" : "0");
          } catch {
            // Sem armazenamento no aparelho: só não lembra da escolha.
          }
        }
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
        {/* Quem mora fora e lança sempre em outra moeda não sabia que dava pra trocar a do app
            inteiro (cliente, 01/10/2026): o caminho fica aqui, na hora em que a moeda importa. */}
        {foreign && (
          <Link href="/configuracoes" className="text-caption font-medium text-accent-strong hover:underline">
            Usa sempre {CURRENCIES[currency].label.toLowerCase()}? Troque a moeda do app em Configurações →
          </Link>
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
        onTipoChange={setTipo}
      />
      <CasalFields tipo={tipo} defaultPessoa={defaultPessoa} defaultDoCasal={defaultDoCasal} />
      {/* Só para quem montou um limite do cartão no Orçamento (é opcional, 06/10/2026). Sem o
          botão, o campo nem vai e o que o gasto já era fica como estava. */}
      {cartaoComLimite && tipo === "EXPENSE" && (
        <>
          <input type="hidden" name="noCartao" value={noCartao ? "sim" : "nao"} />
          <button
            type="button"
            role="switch"
            aria-checked={noCartao}
            onClick={() => setNoCartao((v) => !v)}
            className={`flex min-h-12 items-center gap-3 rounded-2xl border px-3 text-left transition-colors ${stacked ? "w-full" : ""} ${
              noCartao ? "border-accent bg-accent-soft" : "border-border-strong bg-surface-2"
            }`}
          >
            <CreditCard size={18} strokeWidth={1.9} className={noCartao ? "text-accent-strong" : "text-ink-muted"} aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium text-ink">{t.limNoCartao}</span>
              {noCartao && <span className="text-caption text-ink-muted">{t.limNoCartaoNota}</span>}
            </span>
            <span aria-hidden className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${noCartao ? "bg-accent" : "bg-border-strong"}`}>
              <span className={`absolute top-0.5 size-5 rounded-full bg-surface shadow-sm transition-all ${noCartao ? "left-[18px]" : "left-0.5"}`} />
            </span>
          </button>
        </>
      )}
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
      {tipo === "INCOME" && (
        <label className={`flex min-h-11 items-start gap-2.5 text-xs text-ink-muted ${stacked ? "w-full" : ""}`}>
          <input type="checkbox" name="paraMesSeguinte" defaultChecked={jaNoMesSeguinte} className="mt-0.5 h-5 w-5 shrink-0 accent-accent" />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm text-ink">{t.formLancMesSeguinte(nomeDoMesSeguinte)}</span>
            <span>{t.formLancMesSeguinteNota}</span>
          </span>
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
