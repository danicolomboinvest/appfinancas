"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, SelectField } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { TickerPicker } from "@/components/forms/TickerPicker";
import type { TickerKind } from "@/lib/market/ticker-search";
import { Button } from "@/components/ui/Button";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { ClasseDeAtivo, IndexadorRendaFixa, ObjetivoDeAtivo } from "@/lib/profiles/textos/formularios";
import { createAssetAction, updateAssetAction, type AssetFormState } from "./actions";

const initialState: AssetFormState = {};

// Só a ORDEM das opções fica aqui; o nome de cada uma vem da voz do tema (formAtivoClasses etc.).
const ASSET_CLASS_OPTIONS: ClasseDeAtivo[] = ["RENDA_FIXA", "ACAO", "FII", "TESOURO_DIRETO", "FUNDO", "CRIPTO", "INTERNACIONAL", "OUTRO"];
const OBJECTIVE_OPTIONS: ObjetivoDeAtivo[] = ["OUTRO", "RESERVA_EMERGENCIA", "LIBERDADE_FINANCEIRA", "META"];
const FIXED_INCOME_OPTIONS: IndexadorRendaFixa[] = ["", "POS_FIXADO", "IPCA", "PREFIXADO"];

/** Classes em que faz sentido buscar o código pelo nome; nas outras (CDB, Tesouro) o ticker é livre. */
const PICKER_KINDS: Partial<Record<string, TickerKind[]>> = {
  ACAO: ["STOCK", "BDR"],
  FII: ["FII"],
  FUNDO: ["ETF"],
  INTERNACIONAL: ["STOCK_INTL", "ETF_INTL", "BDR"],
};

type Defaults = {
  name?: string;
  ticker?: string;
  quantity?: number;
  assetClass?: string;
  objective?: string;
  goalId?: string;
  investedValue?: number;
  currentValue?: number;
  fixedIncomeIndex?: string;
};

/** Form de ativo, sem `assetId`/`defaults` cria um ativo novo; com eles, edita um existente. */
export function AssetForm({
  goals,
  assetId,
  defaults = {},
  submitLabel,
  onSuccess,
}: {
  goals: { id: string; name: string }[];
  assetId?: string;
  defaults?: Defaults;
  /** Sem isso, o botão fala na voz do tema: "Adicionar" ao criar, "Salvar alterações" ao editar. */
  submitLabel?: string;
  onSuccess?: () => void;
}) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const action = assetId ? updateAssetAction.bind(null, assetId) : createAssetAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [objective, setObjective] = useState(defaults.objective ?? "OUTRO");
  const [assetClass, setAssetClass] = useState(defaults.assetClass ?? "RENDA_FIXA");
  const [assetName, setAssetName] = useState(defaults.name ?? "");
  const pickerKinds = PICKER_KINDS[assetClass];
  // Ação, FII, ETF: quem compra sabe "10 ações a R$ 30", não o valor de hoje. Quantidade e
  // preço médio dão o investido; a cotação de hoje o app busca sozinho ao salvar.
  const quoted = Boolean(pickerKinds);
  const [quantity, setQuantity] = useState<string>(defaults.quantity ? String(defaults.quantity) : "");
  const [avgPrice, setAvgPrice] = useState<number>(
    defaults.quantity && defaults.investedValue ? Math.round((defaults.investedValue / defaults.quantity) * 100) / 100 : 0,
  );
  const qtyNumber = Number(quantity.replace(",", "."));
  const investedFromQty = Number.isFinite(qtyNumber) && qtyNumber > 0 && avgPrice > 0 ? Math.round(qtyNumber * avgPrice * 100) / 100 : undefined;
  const isFixedIncome = assetClass === "RENDA_FIXA" || assetClass === "TESOURO_DIRETO";
  const wasPending = useRef(false);
  useSuccessToast(isPending, state.error, assetId ? t.formAtivoAtualizado : t.formAtivoAdicionado);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      onSuccess?.();
    }
    wasPending.current = isPending;
  }, [isPending, state.error, onSuccess]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <SelectField
        label={t.formAtivoClasse}
        id="assetClass"
        name="assetClass"
        value={assetClass}
        onChange={(e) => setAssetClass(e.target.value)}
      >
        {ASSET_CLASS_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {t.formAtivoClasses[value]}
          </option>
        ))}
      </SelectField>
      {pickerKinds ? (
        // Escolher na lista preenche o nome junto — quem não sabe o código também não quer
        // digitar "Petrobras" duas vezes. O nome continua editável.
        <TickerPicker
          key={assetClass}
          kinds={pickerKinds}
          label={t.formAtivoQual}
          placeholder={t.formAtivoQualPlaceholder}
          defaultValue={defaults.ticker}
          className="w-full sm:w-64"
          onSelect={(hit) => {
            if (hit.name) setAssetName(hit.name);
          }}
        />
      ) : (
        <Field label={t.formAtivoTicker} id="ticker" name="ticker" className="w-24" defaultValue={defaults.ticker} />
      )}
      <Field
        label={t.formAtivoNome}
        id="name"
        name="name"
        required
        value={assetName}
        onChange={(e) => setAssetName(e.target.value)}
        placeholder={pickerKinds ? t.formAtivoNomePlaceholderLista : t.formAtivoNomePlaceholder}
      />
      {isFixedIncome && (
        <SelectField
          label={t.formAtivoIndexador}
          id="fixedIncomeIndex"
          name="fixedIncomeIndex"
          defaultValue={defaults.fixedIncomeIndex ?? ""}
        >
          {FIXED_INCOME_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {t.formAtivoIndexadores[value]}
            </option>
          ))}
        </SelectField>
      )}
      <SelectField
        label={t.formAtivoObjetivo}
        id="objective"
        name="objective"
        value={objective}
        onChange={(e) => setObjective(e.target.value)}
      >
        {OBJECTIVE_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {t.formAtivoObjetivos[value]}
          </option>
        ))}
      </SelectField>
      {objective === "META" && (
        <SelectField label={t.formAtivoMetaVinculada} id="goalId" name="goalId" defaultValue={defaults.goalId}>
          <option value="">{t.formSelecione}</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.name}
            </option>
          ))}
        </SelectField>
      )}
      {quoted ? (
        <>
          <Field
            label={t.formAtivoQuantidade}
            id="quantity"
            name="quantity"
            type="text"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={t.formAtivoQuantidadePlaceholder}
            className="w-full sm:w-28"
          />
          <CurrencyField
            label={t.formAtivoPrecoMedio}
            id="avgPrice"
            name="avgPrice"
            defaultValue={avgPrice || undefined}
            onValueChange={setAvgPrice}
            className="w-full sm:w-40"
          />
          <input type="hidden" name="investedValue" value={investedFromQty ?? ""} />
          <CurrencyField
            label={t.formAtivoValorAtualOpcional}
            id="currentValue"
            name="currentValue"
            defaultValue={defaults.currentValue}
            hint={t.formAtivoValorAtualHint}
            className="w-full sm:w-40"
          />
        </>
      ) : (
        <>
          <CurrencyField
            label={t.formAtivoValorInvestido}
            id="investedValue"
            name="investedValue"
            defaultValue={defaults.investedValue}
            className="w-full sm:w-40"
          />
          <CurrencyField
            label={t.formAtivoValorAtual}
            id="currentValue"
            name="currentValue"
            required
            defaultValue={defaults.currentValue}
            className="w-full sm:w-40"
          />
        </>
      )}
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? t.formSalvando : (submitLabel ?? (assetId ? t.formAtivoSalvar : t.formAtivoAdicionar))}
      </Button>
    </form>
  );
}
