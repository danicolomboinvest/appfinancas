import type { FinancingVsRentInput } from "@/lib/simulators/financing-vs-rent";
import type { AmortizeVsInvestFormValues } from "@/lib/validations/amortize-vs-invest.schema";
import type { ConsortiumFormValues } from "@/lib/validations/consortium.schema";
import type { CarComparisonFormValues } from "@/lib/validations/car.schema";
import type { MarkToMarketFormValues } from "@/lib/validations/mark-to-market.schema";

/**
 * Os números de cada calculadora, como a tela guarda (11/10/2026, versão nova).
 *
 * Estes exemplos e conversões estavam dentro de cada página (`app/(app)/simuladores/<calc>/page.tsx`)
 * e vieram para cá SEM mudar nada, para o assistente guiado, a tela ao vivo e a simulação salva
 * usarem a mesma tradução. As contas continuam em `lib/simulators/*` e não mudaram: o teste
 * `contas-travadas.test.ts` trava o resultado de antes e de depois para os mesmos dados.
 *
 * As chaves são as mesmas que já estão gravadas nas simulações salvas (`Simulation.inputJson`):
 * mudar um nome aqui faria a simulação de quem já salvou abrir com o número errado.
 */
export type ValoresDaCalculadora = Record<string, number | string>;

export const EXEMPLO_FINANCIAR: ValoresDaCalculadora = {
  propertyValue: 500000,
  downPayment: 100000,
  cetAnnualRate: 0.11,
  propertyAppreciationAnnualRate: 0.05,
  termMonths: 360,
  system: "SAC",
  monthlyRent: 2200,
  rentAnnualAdjustment: 0.05,
  investmentAnnualRate: 0.11,
  incomeTaxRate: 0.15,
};

/**
 * A entrada nunca passa do valor do bem (14/10/2026): baixar o imóvel (ou o bem do consórcio)
 * para menos que a entrada já digitada deixava o valor financiado NEGATIVO, e a conta seguia
 * com juros ao contrário. Abaixo do valor, nada muda.
 */
function entradaAteOValor(entrada: number | string | undefined, valor: number | string | undefined): number {
  const e = Number(entrada);
  const v = Number(valor);
  return Number.isFinite(e) && Number.isFinite(v) && v >= 0 && e > v ? v : e;
}

export function entradaFinanciar(values: ValoresDaCalculadora): FinancingVsRentInput {
  return {
    propertyValue: Number(values.propertyValue),
    downPayment: entradaAteOValor(values.downPayment, values.propertyValue),
    cetAnnualRate: Number(values.cetAnnualRate),
    propertyAppreciationAnnualRate: Number(values.propertyAppreciationAnnualRate),
    termMonths: Number(values.termMonths),
    system: values.system === "PRICE" ? "PRICE" : "SAC",
    monthlyRent: Number(values.monthlyRent),
    rentAnnualAdjustment: Number(values.rentAnnualAdjustment),
    investmentAnnualRate: Number(values.investmentAnnualRate),
    incomeTaxRate: Number(values.incomeTaxRate),
  };
}

export const EXEMPLO_AMORTIZAR: ValoresDaCalculadora = {
  outstandingBalance: 200000,
  cetAnnualRate: 0.11,
  remainingMonths: 240,
  system: "SAC",
  extraAmount: 20000,
  investmentAnnualRate: 0.12,
  incomeTaxRate: 0.15,
};

export function entradaAmortizar(values: ValoresDaCalculadora): AmortizeVsInvestFormValues {
  return {
    outstandingBalance: Number(values.outstandingBalance),
    cetAnnualRate: Number(values.cetAnnualRate),
    remainingMonths: Number(values.remainingMonths),
    system: values.system === "PRICE" ? "PRICE" : "SAC",
    extraAmount: Number(values.extraAmount),
    investmentAnnualRate: Number(values.investmentAnnualRate),
    incomeTaxRate: Number(values.incomeTaxRate),
  };
}

export const EXEMPLO_CONSORCIO: ValoresDaCalculadora = {
  creditValue: 100000,
  consortiumAdminFeeRate: 0.18,
  consortiumTermMonths: 120,
  financingDownPayment: 20000,
  financingCetAnnualRate: 0.12,
  financingTermMonths: 120,
  financingSystem: "PRICE",
  opportunityCostAnnualRate: 0.11,
};

/** O preço de partida do bem no consórcio: o da meta de carro (quando é ela), senão o exemplo. */
export function valorInicialDoBem(bem: "meta" | "imovel" | "outro" | null, alvoDaMeta: number | undefined): number {
  if (bem === "imovel") return 300000;
  if (bem === "meta" && alvoDaMeta && alvoDaMeta > 0) return alvoDaMeta;
  return Number(EXEMPLO_CONSORCIO.creditValue);
}

export function entradaConsorcio(values: ValoresDaCalculadora): ConsortiumFormValues {
  return {
    creditValue: Number(values.creditValue),
    consortiumAdminFeeRate: Number(values.consortiumAdminFeeRate),
    consortiumTermMonths: Number(values.consortiumTermMonths),
    financingDownPayment: entradaAteOValor(values.financingDownPayment, values.creditValue),
    financingCetAnnualRate: Number(values.financingCetAnnualRate),
    financingTermMonths: Number(values.financingTermMonths),
    financingSystem: values.financingSystem === "SAC" ? "SAC" : "PRICE",
    opportunityCostAnnualRate: Number(values.opportunityCostAnnualRate),
  };
}

export const EXEMPLO_CARRO: ValoresDaCalculadora = {
  carPrice: 100000,
  priceAfter1Year: 85000,
  priceAfter2Years: 75000,
  monthlyFuelCost: 400,
  subscriptionMonthlyFee: 2500,
  annualFixedCosts: 4000,
  opportunityCostMonthlyRate: 0.008,
};

/**
 * A revenda do carro daqui a 2 anos acompanha o preço (14/10/2026). Antes, trocar o preço no
 * passo 1 deixava a revenda do exemplo (R$ 75.000): um carro de R$ 45.000 "valia" 167% do preço
 * depois de 2 anos e comprar saía barato demais. A proporção fica na régua do passo 2 (40% a 95%)
 * e o valor, de 100 em 100, como o arrastar.
 */
export const PROPORCAO_DA_REVENDA = 0.75;
export function revendaPelaProporcao(preco: number, proporcao: number): number {
  const p = Number.isFinite(proporcao) ? Math.min(0.95, Math.max(0.4, proporcao)) : PROPORCAO_DA_REVENDA;
  return preco > 0 ? Math.round((preco * p) / 100) * 100 : 0;
}

export function entradaCarro(values: ValoresDaCalculadora): CarComparisonFormValues {
  return {
    carPrice: Number(values.carPrice),
    priceAfter1Year: Number(values.priceAfter1Year),
    priceAfter2Years: Number(values.priceAfter2Years),
    monthlyFuelCost: Number(values.monthlyFuelCost),
    subscriptionMonthlyFee: Number(values.subscriptionMonthlyFee),
    annualFixedCosts: Number(values.annualFixedCosts),
    opportunityCostMonthlyRate: Number(values.opportunityCostMonthlyRate),
  };
}

export const EXEMPLO_MARCACAO: ValoresDaCalculadora = {
  faceValue: 1000,
  originalRate: 0.1,
  newRate: 0.12,
  totalYears: 10,
  yearsRemaining: 6,
  hasSemiannualCoupons: "nao",
  duration: 0,
  investedAmount: 0,
};

export function entradaMarcacao(values: ValoresDaCalculadora): MarkToMarketFormValues {
  const semiannual = values.hasSemiannualCoupons === "sim";
  const duration = Number(values.duration);
  const invested = Number(values.investedAmount);
  return {
    faceValue: Number(values.faceValue),
    originalRate: Number(values.originalRate),
    newRate: Number(values.newRate),
    totalYears: Number(values.totalYears),
    yearsRemaining: Number(values.yearsRemaining),
    hasSemiannualCoupons: semiannual,
    duration: semiannual && duration > 0 ? duration : undefined,
    investedAmount: invested > 0 ? invested : undefined,
  };
}

/** Os tipos que o banco aceita para guardar uma simulação (o "Vale a pena" não é guardado). */
export type TipoDeSimulacao = "FINANCIAR_VS_ALUGAR" | "AMORTIZAR_VS_INVESTIR" | "CONSORCIO_VS_FINANCIAMENTO" | "MARCACAO_MERCADO" | "CARRO";
