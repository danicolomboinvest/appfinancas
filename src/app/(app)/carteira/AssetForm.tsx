"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, SelectField } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { TickerPicker } from "@/components/forms/TickerPicker";
import type { TickerKind } from "@/lib/market/ticker-search";
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
  { value: "INTERNACIONAL", label: "Internacional" },
  { value: "OUTRO", label: "Outro" },
];

const OBJECTIVE_OPTIONS = [
  { value: "OUTRO", label: "Outro" },
  { value: "RESERVA_EMERGENCIA", label: "Reserva de emergência" },
  { value: "LIBERDADE_FINANCEIRA", label: "Liberdade financeira" },
  { value: "META", label: "Meta" },
];

/** Classes em que faz sentido buscar o código pelo nome; nas outras (CDB, Tesouro) o ticker é livre. */
const PICKER_KINDS: Partial<Record<string, TickerKind[]>> = {
  ACAO: ["STOCK", "BDR"],
  FII: ["FII"],
  FUNDO: ["ETF"],
  INTERNACIONAL: ["STOCK_INTL", "ETF_INTL", "BDR"],
};

const FIXED_INCOME_OPTIONS = [
  { value: "", label: "Não definido" },
  { value: "POS_FIXADO", label: "Pós-fixado (CDI/Selic)" },
  { value: "IPCA", label: "IPCA+" },
  { value: "PREFIXADO", label: "Prefixado" },
];

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
      <SelectField
        label="Classe"
        id="assetClass"
        name="assetClass"
        value={assetClass}
        onChange={(e) => setAssetClass(e.target.value)}
      >
        {ASSET_CLASS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      {pickerKinds ? (
        // Escolher na lista preenche o nome junto — quem não sabe o código também não quer
        // digitar "Petrobras" duas vezes. O nome continua editável.
        <TickerPicker
          key={assetClass}
          kinds={pickerKinds}
          label="Qual ativo?"
          placeholder="Nome ou código"
          defaultValue={defaults.ticker}
          className="w-full sm:w-64"
          onSelect={(hit) => {
            if (hit.name) setAssetName(hit.name);
          }}
        />
      ) : (
        <Field label="Ticker (opcional)" id="ticker" name="ticker" className="w-24" defaultValue={defaults.ticker} />
      )}
      <Field
        label="Nome"
        id="name"
        name="name"
        required
        value={assetName}
        onChange={(e) => setAssetName(e.target.value)}
        placeholder={pickerKinds ? "Preenchido ao escolher na lista" : "Ex.: Tesouro Selic 2029"}
      />
      {isFixedIncome && (
        <SelectField
          label="Indexador"
          id="fixedIncomeIndex"
          name="fixedIncomeIndex"
          defaultValue={defaults.fixedIncomeIndex ?? ""}
        >
          {FIXED_INCOME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      )}
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
      {quoted ? (
        <>
          <Field
            label="Quantidade"
            id="quantity"
            name="quantity"
            type="text"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Ex.: 10"
            className="w-full sm:w-28"
          />
          <CurrencyField
            label="Preço médio de compra"
            id="avgPrice"
            name="avgPrice"
            defaultValue={avgPrice || undefined}
            onValueChange={setAvgPrice}
            className="w-full sm:w-40"
          />
          <input type="hidden" name="investedValue" value={investedFromQty ?? ""} />
          <CurrencyField
            label="Valor atual (opcional)"
            id="currentValue"
            name="currentValue"
            defaultValue={defaults.currentValue}
            hint="Deixe em branco: o app busca a cotação de hoje e multiplica pela quantidade."
            className="w-full sm:w-40"
          />
        </>
      ) : (
        <>
          <CurrencyField
            label="Valor investido"
            id="investedValue"
            name="investedValue"
            defaultValue={defaults.investedValue}
            className="w-full sm:w-40"
          />
          <CurrencyField
            label="Valor atual"
            id="currentValue"
            name="currentValue"
            required
            defaultValue={defaults.currentValue}
            className="w-full sm:w-40"
          />
        </>
      )}
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
