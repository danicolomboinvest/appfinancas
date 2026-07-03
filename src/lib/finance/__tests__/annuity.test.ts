import { describe, expect, it } from "vitest";
import { fv } from "../fv";
import { pv } from "../pv";
import { pmt } from "../pmt";
import { nper } from "../nper";
import { bondPrice } from "../pv";

describe("fv", () => {
  it("matches manual compound-interest calc with no contributions", () => {
    // R$10.000 a 1% ao mês por 12 meses, sem aportes: 10000 * 1.01^12
    const result = fv(0.01, 12, 0, 10000);
    expect(result.toDecimalPlaces(2).toNumber()).toBeCloseTo(11268.25, 2);
  });

  it("matches manual calc with monthly contributions (end of period)", () => {
    // R$0 inicial, aporte de R$1.000/mês por 12 meses a 1% a.m.
    // FV = 1000 * ((1.01^12 - 1) / 0.01) = 1000 * 12.682503... = 12682.50
    const result = fv(0.01, 12, 1000, 0);
    expect(result.toDecimalPlaces(2).toNumber()).toBeCloseTo(12682.5, 2);
  });

  it("handles rate = 0 as simple sum", () => {
    const result = fv(0, 24, 500, 1000);
    expect(result.toNumber()).toBe(1000 + 500 * 24);
  });

  it("annuity-due (type=1) yields a higher value than ordinary annuity (type=0)", () => {
    const ordinary = fv(0.01, 12, 1000, 0, 0);
    const due = fv(0.01, 12, 1000, 0, 1);
    expect(due.toNumber()).toBeGreaterThan(ordinary.toNumber());
  });
});

describe("pv / fv inverse relationship", () => {
  it("pv(fv(...)) round-trips back to the original present value", () => {
    const rate = 0.008;
    const contributions = 750;
    const periods = 36;
    const originalPv = 5000;

    const futureValue = fv(rate, periods, contributions, originalPv);
    const recoveredPv = pv(rate, periods, contributions, futureValue);

    expect(recoveredPv.toDecimalPlaces(6).toNumber()).toBeCloseTo(originalPv, 6);
  });
});

describe("pmt", () => {
  it("computes the fixed installment for a Price-style loan (fv=0)", () => {
    // Financiamento de 100.000 a 1% a.m. em 24 meses -> parcela conhecida (Price).
    // Sinal negativo = o "aporte" está drenando o saldo devedor até zerar (ver pmt.ts).
    const installment = pmt(0.01, 24, 100000, 0);
    expect(installment.abs().toDecimalPlaces(2).toNumber()).toBeCloseTo(4707.35, 2);
  });

  it("computes the monthly contribution needed to reach a goal", () => {
    const contribution = pmt(0.006, 18, 2000, 20000);
    // sanity: reinserting into fv should reproduce the target future value
    const reconstructedFv = fv(0.006, 18, contribution.toNumber(), 2000);
    expect(reconstructedFv.toDecimalPlaces(2).toNumber()).toBeCloseTo(20000, 2);
  });
});

describe("nper", () => {
  it("computes months needed to reach a goal, matching fv/pmt inverses", () => {
    const rate = 0.007;
    const contribution = 800;
    const startingAmount = 3000;
    const target = 15000;

    const months = nper(rate, contribution, startingAmount, target);
    const reconstructedFv = fv(rate, months.toNumber(), contribution, startingAmount);

    expect(reconstructedFv.toDecimalPlaces(1).toNumber()).toBeCloseTo(target, 1);
  });

  it("handles rate = 0 as a simple division", () => {
    const months = nper(0, 500, 1000, 6000);
    expect(months.toNumber()).toBe((6000 - 1000) / 500);
  });
});

describe("bondPrice (marcação a mercado)", () => {
  it("prices a zero-coupon bond by discounting face value", () => {
    // Título prefixado: valor de face 1000, taxa 10% a.a., 2 anos até o vencimento
    const price = bondPrice(1000, 0.1, 2);
    expect(price.toDecimalPlaces(2).toNumber()).toBeCloseTo(826.45, 2);
  });

  it("shows price falls when market rate rises (marcação a mercado)", () => {
    const priceAtOriginalRate = bondPrice(1000, 0.1, 5);
    const priceAtHigherRate = bondPrice(1000, 0.14, 5);
    expect(priceAtHigherRate.toNumber()).toBeLessThan(priceAtOriginalRate.toNumber());
  });
});
