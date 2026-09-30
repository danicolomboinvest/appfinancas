import { describe, expect, it } from "vitest";
import { simulateAmortizeVsInvest } from "../amortize-vs-invest";
import { simulateCarComparison } from "../car";
import { simulateConsortiumVsFinancing, type ConsortiumVsFinancingInput } from "../consortium";
import { dividirDespesasDoCasal } from "../divisao-casal";
import { faixaDoCampo } from "../faixa";
import { simulateFinancingVsRent } from "../financing-vs-rent";
import { simularInvestimentoNaEmpresa } from "../investir-na-empresa";
import { simulateMarkToMarket } from "../mark-to-market";
import { parseWizardNumber } from "../wizard-number";
import { simulateWorthIt } from "../worth-it";

/**
 * Bordas dos simuladores. O campo de texto do simulador aceita qualquer número digitado (o
 * controle deslizante tem faixa, o texto não: SimulatorWizard.tsx grava o que parseWizardNumber
 * devolve), então "0" num prazo chega nas contas de verdade.
 *
 * `it.fails` = bug encontrado e não corrigido aqui.
 */
const semNaN = (o: unknown) => expect(JSON.stringify(o, (_k, v) => (typeof v === "number" && !Number.isFinite(v) ? `!${v}` : v))).not.toMatch(/"!(NaN|Infinity|-Infinity)"/);

const consorcio: ConsortiumVsFinancingInput = {
  creditValue: 100000,
  consortiumAdminFeeRate: 0.18,
  consortiumTermMonths: 60,
  financingDownPayment: 20000,
  financingCetAnnualRate: 0.12,
  financingTermMonths: 60,
  financingSystem: "PRICE",
  opportunityCostAnnualRate: 0.1,
};

describe("consórcio vs financiamento: prazo zero digitado", () => {
  // Era bug (corrigido): prazo do consórcio "0" digitado → parcela = total / 0 = Infinity, e a tela mostra
  // money(Infinity) em "Parcela do consórcio" (consorcio/page.tsx:94 e :99).
  it("prazo do consórcio zero não gera parcela infinita", () => {
    semNaN(simulateConsortiumVsFinancing({ ...consorcio, consortiumTermMonths: 0 }).consortium);
  });

  // Era bug (corrigido): prazo do financiamento "0" → tabela vazia, total pago 0, custo -R$ 80.000, e o
  // financiamento "vence" por R$ 98.000. Prazo zero deveria ser recusado (como o invalidTerm do
  // Financiar vs Alugar), não virar veredito.
  it("prazo do financiamento zero não faz o financiamento 'vencer' com custo negativo", () => {
    const r = simulateConsortiumVsFinancing({ ...consorcio, financingTermMonths: 0 });
    expect(r.financing.operationCost).toBeGreaterThanOrEqual(0);
  });

  it("sem taxa de administração: custo do consórcio zero e parcela = valor / prazo", () => {
    const r = simulateConsortiumVsFinancing({ ...consorcio, consortiumAdminFeeRate: 0 });
    expect(r.consortium.operationCost).toBe(0);
    expect(r.consortium.installment).toBeCloseTo(100000 / 60, 8);
  });
});

describe("financiar vs alugar: prazo", () => {
  it("prazo zero ou fração de mês é marcado como inválido, sem tabela", () => {
    for (const termMonths of [0, 0.5, -12]) {
      const r = simulateFinancingVsRent({ propertyValue: 500000, downPayment: 100000, cetAnnualRate: 0.11, propertyAppreciationAnnualRate: 0.04, termMonths, system: "SAC", monthlyRent: 2500, rentAnnualAdjustment: 0.05, investmentAnnualRate: 0.1, incomeTaxRate: 0.15 });
      expect(r.invalidTerm).toBe(true);
      expect(r.schedule).toEqual([]);
    }
  });
});

describe("amortizar vs investir: bordas", () => {
  it("tudo a 0% (sem juros e sem rendimento): nenhum resultado com NaN", () => {
    for (const system of ["SAC", "PRICE"] as const) {
      semNaN(simulateAmortizeVsInvest({ outstandingBalance: 100000, cetAnnualRate: 0, remainingMonths: 120, system, extraAmount: 10000, investmentAnnualRate: 0, incomeTaxRate: 0 }));
    }
  });

  it("extra maior que o saldo quita a dívida: juros com o extra = 0, economia = juros todos", () => {
    const r = simulateAmortizeVsInvest({ outstandingBalance: 100000, cetAnnualRate: 0.12, remainingMonths: 120, system: "SAC", extraAmount: 200000, investmentAnnualRate: 0.1, incomeTaxRate: 0.15 });
    expect(r.totalInterestWithExtra).toBe(0);
    expect(r.interestSavings).toBeCloseTo(r.totalInterestWithoutExtra, 6);
  });

  // Era bug (corrigido): com juros 0% e rendimento 0% os dois caminhos empatam, mas o veredito sai
  // "AMORTIZAR" por uma diferença de 8e-13 (ruído de ponto flutuante).
  it("tudo a 0%: diferença a favor do vencedor é zero (empate), não ruído de centavo", () => {
    const r = simulateAmortizeVsInvest({ outstandingBalance: 100000, cetAnnualRate: 0, remainingMonths: 120, system: "SAC", extraAmount: 10000, investmentAnnualRate: 0, incomeTaxRate: 0 });
    expect(r.differenceInFavorOfWinner).toBe(0);
  });
});

describe("carro: preço zero", () => {
  // Preço do carro "0" digitado: a depreciação divide por zero. Hoje ela não aparece na tela
  // (carro/page.tsx só mostra caixa e custo de oportunidade), mas o resultado carrega NaN.
  it("preço zero não devolve depreciação NaN", () => {
    semNaN(simulateCarComparison({ carPrice: 0, priceAfter1Year: 0, priceAfter2Years: 0, monthlyFuelCost: 400, subscriptionMonthlyFee: 2500, annualFixedCosts: 4000, opportunityCostMonthlyRate: 0.008 }));
  });

  it("empate exato vai pra assinatura (regra '<=')", () => {
    const r = simulateCarComparison({ carPrice: 0, priceAfter1Year: 0, priceAfter2Years: 0, monthlyFuelCost: 0, subscriptionMonthlyFee: 0, annualFixedCosts: 0, opportunityCostMonthlyRate: 0 });
    expect(r.winner).toBe("ASSINATURA");
    expect(r.differenceInFavorOfWinner).toBe(0);
  });
});

describe("marcação a mercado: valor de face zero", () => {
  it("valor de face zero não devolve sensibilidade NaN", () => {
    semNaN(simulateMarkToMarket({ faceValue: 0, originalRate: 0.1, newRate: 0.12, totalYears: 5, yearsRemaining: 3 }).approximateSensitivity);
  });

  it("no vencimento (0 anos) o preço é o valor de face e não há lucro nem prejuízo", () => {
    const r = simulateMarkToMarket({ faceValue: 1000, originalRate: 0.1, newRate: 0.15, totalYears: 5, yearsRemaining: 0 });
    expect(r.carryingPrice).toBe(1000);
    expect(r.marketPrice).toBe(1000);
    expect(r.profitOrLoss).toBe(0);
  });
});

describe("vale a pena? / casal / empresa: zeros", () => {
  it("vale a pena: horizonte zero não rende nada; renda zero ou negativa não dá horas", () => {
    expect(simulateWorthIt({ price: 100, monthlyIncome: 0, mode: "SINGLE", horizonYears: 0 })).toMatchObject({ hoursEquivalent: null, futureValueIfInvested: 100, difference: 0 });
    expect(simulateWorthIt({ price: 100, monthlyIncome: -1000, mode: "RECURRING", horizonYears: 1 }).hoursEquivalent).toBeNull();
  });

  it("casal: as duas rendas zero dividem 50/50, sem NaN; renda negativa conta como zero", () => {
    const r = dividirDespesasDoCasal({ rendaA: 0, rendaB: 0, despesasComuns: 3000 });
    expect(r).toMatchObject({ pctA: 0.5, pctB: 0.5, contribuicaoA: 1500, contribuicaoB: 1500 });
    expect(dividirDespesasDoCasal({ rendaA: 5000, rendaB: -1000, despesasComuns: 3000 }).pctB).toBe(0);
  });

  it("casal: percentual manual fora de 0–100% é travado nas pontas", () => {
    expect(dividirDespesasDoCasal({ rendaA: 1, rendaB: 1, despesasComuns: 100, pctBManual: 1.5 }).pctB).toBe(1);
    expect(dividirDespesasDoCasal({ rendaA: 1, rendaB: 1, despesasComuns: 100, pctBManual: -0.2 }).pctB).toBe(0);
    expect(dividirDespesasDoCasal({ rendaA: 1, rendaB: 1, despesasComuns: 100, pctBManual: Number.NaN }).manual).toBe(false);
  });

  it("empresa: tudo zero (e horizonte zero) não divide por zero", () => {
    const r = simularInvestimentoNaEmpresa({ investimento: 0, receitaMensal: 0, margem: 0, custoMensal: 0, horizonteMeses: 0, taxaAnualAlternativa: 0 });
    semNaN(r);
    expect(r.veredito).toBe("nunca-se-paga");
    expect(r.receitaNecessariaParaSePagar).toBeNull();
  });

  it("empresa: payback arredonda pra cima (10.000 / 3.000 por mês = 4 meses)", () => {
    const r = simularInvestimentoNaEmpresa({ investimento: 10000, receitaMensal: 10000, margem: 0.3, custoMensal: 0, horizonteMeses: 12, taxaAnualAlternativa: 0.1 });
    expect(r.paybackMeses).toBe(4);
  });
});

describe("faixa do controle e número digitado", () => {
  // Latente: nenhuma página hoje tem percentual ao ano sem `max`, mas a regra promete "até 20%
  // ao ano" e, com exemplo 0% (ex.: IR 0%) ou negativo (imóvel que desvaloriza), a faixa vira 0–100%.
  it("percentual ao ano com exemplo 0% vai até 20%, não até 100%", () => {
    expect(faixaDoCampo({ kind: "percent" }, 0).max).toBe(0.2);
  });

  it("dinheiro com exemplo zero ainda tem faixa e passo positivos", () => {
    const f = faixaDoCampo({ kind: "currency" }, 0);
    expect(f.max).toBeGreaterThan(0);
    expect(f.step).toBeGreaterThan(0);
  });

  it("parseWizardNumber: meio de digitação é null; vírgula e milhar à brasileira", () => {
    expect(parseWizardNumber("")).toBeNull();
    expect(parseWizardNumber("-")).toBeNull();
    expect(parseWizardNumber(",")).toBeNull();
    expect(parseWizardNumber("10,")).toBe(10);
    expect(parseWizardNumber("1.234,56")).toBe(1234.56);
    expect(parseWizardNumber("0")).toBe(0);
    expect(parseWizardNumber("-2,5")).toBe(-2.5);
  });
});
