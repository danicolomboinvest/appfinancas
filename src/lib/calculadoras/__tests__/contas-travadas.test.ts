import { describe, expect, it } from "vitest";
import { simulateFinancingVsRent } from "@/lib/simulators/financing-vs-rent";
import { simulateAmortizeVsInvest } from "@/lib/simulators/amortize-vs-invest";
import { simulateConsortiumVsFinancing } from "@/lib/simulators/consortium";
import { simulateCarComparison } from "@/lib/simulators/car";
import { simulateMarkToMarket } from "@/lib/simulators/mark-to-market";
import { simulateWorthIt } from "@/lib/simulators/worth-it";
import {
  EXEMPLO_AMORTIZAR,
  EXEMPLO_CARRO,
  EXEMPLO_CONSORCIO,
  EXEMPLO_FINANCIAR,
  EXEMPLO_MARCACAO,
  entradaAmortizar,
  entradaCarro,
  entradaConsorcio,
  entradaFinanciar,
  entradaMarcacao,
} from "../entradas";
import { variacaoDoPreco, vereditoAmortizar, vereditoCarro, vereditoConsorcio, vereditoFinanciar, vereditoMarcacao } from "../vereditos";

/**
 * As contas das calculadoras NÃO mudam com a versão nova (plano, seção 2: "as contas não mudam").
 *
 * "Antes": os números abaixo saíram das fórmulas de `lib/simulators/*` em 11/10/2026, ANTES de a
 * interface ser refeita, rodando com os mesmos dados de entrada. "Depois": o que a tela nova
 * mostra (os vereditos, que leem as mesmas fórmulas pela tradução de `entradas.ts`). Se alguém
 * mexer numa fórmula ou na tradução dos campos, este teste quebra.
 */
const c = (n: number) => Math.round(n * 100) / 100;

describe("Financiar ou alugar: mesmo resultado antes e depois", () => {
  const casos = [
    { v: EXEMPLO_FINANCIAR, fin: 2160971.19, alu: 1441287.53, vence: "FINANCIAR", p1: 4604.95, meses: 360 },
    { v: { ...EXEMPLO_FINANCIAR, propertyValue: 650000, downPayment: 130000, cetAnnualRate: 0.115, system: "PRICE", monthlyRent: 3100 }, fin: 2809262.54, alu: 1698791.5, vence: "FINANCIAR", p1: 4926.54, meses: 360 },
    {
      v: { ...EXEMPLO_FINANCIAR, propertyValue: 300000, downPayment: 60000, cetAnnualRate: 0.09, propertyAppreciationAnnualRate: 0.03, termMonths: 240, monthlyRent: 2016, rentAnnualAdjustment: 0.04, investmentAnnualRate: 0.12, incomeTaxRate: 0.225 },
      fin: 541833.37, alu: -21194.41, vence: "FINANCIAR", p1: 2729.76, meses: 240,
    },
  ];
  for (const k of casos) {
    it(`imóvel de ${k.v.propertyValue}`, () => {
      const antes = simulateFinancingVsRent(entradaFinanciar(k.v));
      expect(c(antes.finalFinancingPatrimony)).toBe(k.fin);
      expect(c(antes.finalInvestedPatrimony)).toBe(k.alu);
      expect(antes.winner).toBe(k.vence);
      expect(c(antes.schedule[0].installment)).toBe(k.p1);
      expect(antes.schedule).toHaveLength(k.meses);
      const depois = vereditoFinanciar(k.v);
      expect(c(depois.veredito.barras[0].valor)).toBe(k.fin);
      expect(c(depois.veredito.barras[1].valor)).toBe(k.alu);
      expect(Math.abs(depois.veredito.numero - Math.abs(k.fin - k.alu))).toBeLessThan(0.011);
      expect(c(depois.primeiraParcela)).toBe(k.p1);
      // O ano a ano termina no mesmo patrimônio do veredito.
      expect(c(depois.anos.at(-1)!.financiar)).toBe(k.fin);
    });
  }
  it("prazo apagado não tem veredito", () => {
    expect(vereditoFinanciar({ ...EXEMPLO_FINANCIAR, termMonths: 0 }).veredito.erro).toBe("Informe o prazo do financiamento, em meses");
  });
});

describe("Quitar ou investir: mesmo resultado antes e depois", () => {
  const casos = [
    { v: EXEMPLO_AMORTIZAR, a: 128320.03, i: 119528.17, vence: "AMORTIZAR", d: 8791.87, js: 210503.71, jc: 170586.62, n2: 216 },
    { v: { ...EXEMPLO_AMORTIZAR, outstandingBalance: 18000, cetAnnualRate: 0.409, remainingMonths: 18, system: "PRICE", extraAmount: 2741 }, a: 1726.7, i: 429.89, vence: "AMORTIZAR", d: 1296.81, js: 5356.02, jc: 3674.08, n2: 15 },
    { v: { ...EXEMPLO_AMORTIZAR, outstandingBalance: 10000, cetAnnualRate: 0.2, remainingMonths: 12, system: "PRICE", extraAmount: 10000, incomeTaxRate: 0 }, a: 1616.67, i: 1200, vence: "AMORTIZAR", d: 416.67, js: 1022.82, jc: 0, n2: 0 },
  ];
  for (const k of casos) {
    it(`saldo de ${k.v.outstandingBalance}`, () => {
      const antes = simulateAmortizeVsInvest(entradaAmortizar(k.v));
      expect(c(antes.amortizeGain)).toBe(k.a);
      expect(c(antes.investmentGain)).toBe(k.i);
      expect(antes.winner).toBe(k.vence);
      expect(c(antes.differenceInFavorOfWinner)).toBe(k.d);
      expect(c(antes.totalInterestWithoutExtra)).toBe(k.js);
      expect(c(antes.totalInterestWithExtra)).toBe(k.jc);
      expect(antes.scheduleWithExtra).toHaveLength(k.n2);
      const depois = vereditoAmortizar(k.v);
      expect(c(depois.veredito.numero)).toBe(k.d);
      expect(c(depois.veredito.barras[0].valor)).toBe(k.a);
      expect(c(depois.veredito.barras[1].valor)).toBe(k.i);
      expect(depois.veredito.barras[0].vence).toBe(k.vence === "AMORTIZAR");
    });
  }
});

describe("Consórcio ou financiamento: mesmo resultado antes e depois", () => {
  const casos = [
    { v: EXEMPLO_CONSORCIO, con: 18000, fin: 91137.71, vence: "CONSORCIO", d: 73137.71, pc: 983.33, p1: 1119.58 },
    {
      v: { ...EXEMPLO_CONSORCIO, creditValue: 300000, consortiumAdminFeeRate: 0.15, consortiumTermMonths: 180, financingDownPayment: 60000, financingCetAnnualRate: 0.1, financingTermMonths: 180, financingSystem: "SAC" },
      con: 45000, fin: 400273.7, vence: "CONSORCIO", d: 355273.7, pc: 1916.67, p1: 3247.13,
    },
  ];
  for (const k of casos) {
    it(`bem de ${k.v.creditValue}`, () => {
      const antes = simulateConsortiumVsFinancing(entradaConsorcio(k.v));
      expect(c(antes.consortium.operationCost)).toBe(k.con);
      expect(c(antes.financing.totalCostWithOpportunity)).toBe(k.fin);
      expect(antes.winner).toBe(k.vence);
      expect(c(antes.differenceInFavorOfWinner)).toBe(k.d);
      expect(c(antes.consortium.installment)).toBe(k.pc);
      expect(c(antes.financing.firstInstallment)).toBe(k.p1);
      const depois = vereditoConsorcio(k.v);
      expect(c(depois.veredito.numero)).toBe(k.d);
      expect(c(depois.veredito.barras[0].valor)).toBe(k.con);
      expect(c(depois.veredito.barras[1].valor)).toBe(k.fin);
    });
  }
  it("prazo zero não tem veredito", () => {
    expect(vereditoConsorcio({ ...EXEMPLO_CONSORCIO, consortiumTermMonths: 0 }).veredito.erro).toBeDefined();
  });
});

describe("Carro: mesmo resultado antes e depois", () => {
  const casos = [
    { v: EXEMPLO_CARRO, as: 69600, co: 61800, vence: "COMPRA", d: 7800, op: 19200 },
    { v: { ...EXEMPLO_CARRO, carPrice: 120000, priceAfter1Year: 100000, priceAfter2Years: 88000, monthlyFuelCost: 450, subscriptionMonthlyFee: 2900, annualFixedCosts: 5000 }, as: 80400, co: 75840, vence: "COMPRA", d: 4560, op: 23040 },
  ];
  for (const k of casos) {
    it(`carro de ${k.v.carPrice}`, () => {
      const antes = simulateCarComparison(entradaCarro(k.v));
      expect(c(antes.netResultSubscription)).toBe(k.as);
      expect(c(antes.netResultPurchase)).toBe(k.co);
      expect(antes.winner).toBe(k.vence);
      expect(c(antes.differenceInFavorOfWinner)).toBe(k.d);
      expect(c(antes.opportunityCost)).toBe(k.op);
      const depois = vereditoCarro(k.v);
      expect(c(depois.veredito.numero)).toBe(k.d);
      // As partes das barras empilhadas somam exatamente o total de cada caminho.
      const p = depois.partesComprar;
      expect(c(p.perdaNaRevenda + p.rendimentoPerdido + p.ipvaESeguro + p.combustivel)).toBe(k.co);
      expect(c(depois.partesAssinar.mensalidade + depois.partesAssinar.combustivel)).toBe(k.as);
    });
  }
});

describe("Vender renda fixa antes: mesmo resultado antes e depois", () => {
  const casos = [
    { v: EXEMPLO_MARCACAO, car: 564.47, mer: 506.63, l: -57.84, s: -0.102472, sm: null, sl: null },
    { v: { ...EXEMPLO_MARCACAO, originalRate: 0.075, newRate: 0.085, yearsRemaining: 9, investedAmount: 10000 }, car: 521.58, mer: 479.88, l: -41.7, s: -0.079956, sm: 9200.44, sl: -799.56 },
    { v: { ...EXEMPLO_MARCACAO, newRate: 0.08, hasSemiannualCoupons: "sim", duration: 4 }, car: 683.01, mer: 735.03, l: 52.02, s: 0.076157, sm: null, sl: null },
  ];
  for (const k of casos) {
    it(`taxa ${k.v.originalRate} → ${k.v.newRate}`, () => {
      const antes = simulateMarkToMarket(entradaMarcacao(k.v));
      expect(c(antes.carryingPrice)).toBe(k.car);
      expect(c(antes.marketPrice)).toBe(k.mer);
      expect(c(antes.profitOrLoss)).toBe(k.l);
      expect(Math.round(antes.approximateSensitivity * 1e6) / 1e6).toBe(k.s);
      expect(antes.scaledMarketValue === undefined ? null : c(antes.scaledMarketValue)).toBe(k.sm);
      expect(antes.scaledProfitOrLoss === undefined ? null : c(antes.scaledProfitOrLoss)).toBe(k.sl);
      const depois = vereditoMarcacao(k.v);
      expect(c(depois.resultado)).toBe(k.sl ?? k.l);
      expect(c(depois.vendaHoje)).toBe(k.sm ?? k.mer);
      expect(depois.lucro).toBe((k.sl ?? k.l) >= 0);
    });
  }
  it("o mapa 'se a taxa mudar' é a mesma conta: taxa igual dá 0, subir derruba o preço", () => {
    expect(variacaoDoPreco(0.1, 6, 0)).toBeCloseTo(0, 9);
    expect(variacaoDoPreco(0.1, 6, 2)).toBeCloseTo(-10.2472, 3);
    expect(variacaoDoPreco(0.1, 6, -1)).toBeGreaterThan(0);
  });
});

describe("Vale a pena comprar: mesmo resultado antes e depois", () => {
  it("compra única de R$ 2.500 com renda de R$ 7.700", () => {
    const r = simulateWorthIt({ price: 2500, monthlyIncome: 7700, mode: "SINGLE", horizonYears: 5 });
    expect(c(r.hoursEquivalent!)).toBe(71.43);
    expect(c(r.hourlyRate)).toBe(35);
    expect(c(r.futureValueIfInvested)).toBe(4405.85);
    expect(c(r.totalInvested)).toBe(2500);
  });
  it("R$ 120 todo mês por 10 anos", () => {
    const r = simulateWorthIt({ price: 120, monthlyIncome: 7700, mode: "RECURRING", horizonYears: 10 });
    expect(c(r.hoursEquivalent!)).toBe(3.43);
    expect(c(r.futureValueIfInvested)).toBe(26631.6);
    expect(c(r.totalInvested)).toBe(14400);
  });
  it("sem renda, não conta horas", () => {
    const r = simulateWorthIt({ price: 800, monthlyIncome: 0, mode: "SINGLE", horizonYears: 1 });
    expect(r.hoursEquivalent).toBeNull();
    expect(c(r.futureValueIfInvested)).toBe(896);
  });
});
