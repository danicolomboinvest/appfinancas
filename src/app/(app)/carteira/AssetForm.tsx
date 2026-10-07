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
import { averagePriceOf, formatQuantityInput, investedToSend, parseQuantityInput } from "@/lib/portfolio/asset-form-values";
import { createAssetAction, updateAssetAction, type AssetFormState } from "./actions";
import { useCurrency } from "@/components/money/MoneyProvider";
import { getExchangeRateAction } from "@/lib/fx/actions";
import { currencySymbol, type CurrencyCode } from "@/lib/money";
import { CONTA_BRASIL, type MoedaDaConta } from "@/lib/portfolio/conta-exterior";

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
  /** "USD" na conta no exterior: aí investido, valor atual e preço médio vêm em dólar. */
  currency?: string;
};

/** "US$ 1 = R$ 5,02 hoje", embaixo dos valores de um ativo no exterior. */
function CambioDeHoje({ de, para }: { de: CurrencyCode; para: CurrencyCode }) {
  const [taxa, setTaxa] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    getExchangeRateAction(de).then((r) => vivo && setTaxa(r?.rate ?? null));
    return () => {
      vivo = false;
    };
  }, [de]);
  if (!taxa) return null;
  const valor = taxa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <p className="w-full text-caption tabular-nums text-ink-muted">
      {currencySymbol(de)} 1 = {currencySymbol(para)} {valor} hoje
    </p>
  );
}

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
  const moedaDoApp = useCurrency();
  // Conta Brasil ou exterior (07/10/2026): aparece em Internacional, e em qualquer ativo que já
  // está em dólar. Internacional novo começa no exterior, que é o caso da Avenue.
  const [conta, setConta] = useState<MoedaDaConta>(defaults.currency === "USD" ? "USD" : assetId ? CONTA_BRASIL : "USD");
  const mostraConta = assetClass === "INTERNACIONAL" || defaults.currency === "USD";
  const moedaDoAtivo: CurrencyCode = mostraConta ? conta : CONTA_BRASIL;
  const noExterior = moedaDoAtivo !== CONTA_BRASIL;
  // A busca muda com a conta: lá fora, ações e ETFs americanos; aqui, BDR e ETF da B3.
  const pickerKinds = assetClass === "INTERNACIONAL" ? (noExterior ? (["STOCK_INTL", "ETF_INTL"] as TickerKind[]) : (["BDR", "ETF"] as TickerKind[])) : PICKER_KINDS[assetClass];
  const moedaDosCampos = noExterior ? moedaDoAtivo : undefined;
  // Ação, FII, ETF: quem compra sabe "10 ações a R$ 30", não o valor de hoje. Quantidade e
  // preço médio dão o investido; a cotação de hoje o app busca sozinho ao salvar.
  const quoted = Boolean(pickerKinds);
  // Quantidade no campo com vírgula decimal: "1.000" é mil cotas (ver parseQuantityInput).
  const [quantity, setQuantity] = useState<string>(formatQuantityInput(defaults.quantity));
  const [avgPrice, setAvgPrice] = useState<number>(averagePriceOf(defaults.quantity, defaults.investedValue));
  const qtyNumber = parseQuantityInput(quantity);
  // Na edição, sem mexer em quantidade nem preço médio, volta o investido salvo (o preço médio
  // em centavos mudaria o investido sozinho — ver investedToSend).
  const investedFromQty = investedToSend({
    quantity: qtyNumber,
    avgPrice,
    original: assetId ? { quantity: defaults.quantity, investedValue: defaults.investedValue } : undefined,
  });
  // Mostra o número que o app entendeu quando há ponto ou vírgula: "1.000" e "1,000" são coisas
  // bem diferentes, e o engano não dava erro nenhum.
  const quantidadeLida =
    /[.,]/.test(quantity) && Number.isFinite(qtyNumber) && qtyNumber > 0
      ? qtyNumber.toLocaleString("pt-BR", { maximumFractionDigits: 6 })
      : null;
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
      {mostraConta && (
        <div className="flex w-full flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-muted">Conta</span>
          <div role="radiogroup" aria-label="Conta" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-0.5">
            {([CONTA_BRASIL, "USD"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={conta === c}
                onClick={() => setConta(c)}
                className={`min-h-10 rounded-full px-3 text-sm font-semibold transition-colors ${conta === c ? "bg-pill text-on-pill" : "text-ink-muted hover:text-ink"}`}
              >
                {c === CONTA_BRASIL ? "Conta Brasil" : `Exterior (${currencySymbol("USD")})`}
              </button>
            ))}
          </div>
        </div>
      )}
      <input type="hidden" name="assetCurrency" value={moedaDoAtivo} />
      {pickerKinds ? (
        // Escolher na lista preenche o nome junto — quem não sabe o código também não quer
        // digitar "Petrobras" duas vezes. O nome continua editável.
        <TickerPicker
          key={`${assetClass}-${moedaDoAtivo}`}
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
        // Obrigatória: "Meta" sem meta deixava o ativo fora de todos os cards do Por objetivo.
        <SelectField label={t.formAtivoMetaVinculada} id="goalId" name="goalId" required defaultValue={defaults.goalId}>
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
          <div className="flex flex-col gap-1">
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
            {quantidadeLida && <p className="text-caption text-ink-faint">{t.formAtivoQuantidadeLida(quantidadeLida)}</p>}
          </div>
          <CurrencyField
            label={t.formAtivoPrecoMedio}
            id="avgPrice"
            name="avgPrice"
            currency={moedaDosCampos}
            defaultValue={avgPrice || undefined}
            onValueChange={setAvgPrice}
            className="w-full sm:w-40"
          />
          <input type="hidden" name="investedValue" value={investedFromQty ?? ""} />
          {/* Na edição o valor atual vem preenchido com o salvo. Mandar o de antes deixa o
              servidor saber se ela mexeu nele; se não mexeu, vale a cotação de hoje × a
              quantidade nova, senão mudar a quantidade deixava o valor velho e um prejuízo falso. */}
          {assetId && (
            <>
              <input type="hidden" name="originalCurrentValue" value={defaults.currentValue ?? ""} />
              <input type="hidden" name="originalQuantity" value={defaults.quantity ?? ""} />
              <input type="hidden" name="originalInvestedValue" value={defaults.investedValue ?? ""} />
            </>
          )}
          <CurrencyField
            label={t.formAtivoValorAtualOpcional}
            id="currentValue"
            name="currentValue"
            currency={moedaDosCampos}
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
            currency={moedaDosCampos}
            defaultValue={defaults.investedValue}
            className="w-full sm:w-40"
          />
          {assetId && <input type="hidden" name="originalInvestedValue" value={defaults.investedValue ?? ""} />}
          <CurrencyField
            label={t.formAtivoValorAtual}
            id="currentValue"
            name="currentValue"
            required
            currency={moedaDosCampos}
            defaultValue={defaults.currentValue}
            className="w-full sm:w-40"
          />
        </>
      )}
      {noExterior && moedaDoAtivo !== moedaDoApp && <CambioDeHoje de={moedaDoAtivo} para={moedaDoApp} />}
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? t.formSalvando : (submitLabel ?? (assetId ? t.formAtivoSalvar : t.formAtivoAdicionar))}
      </Button>
    </form>
  );
}
