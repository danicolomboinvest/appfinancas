import { describe, expect, it } from "vitest";
import {
  annualToMonthly,
  monthlyToAnnual,
  annualToDailyBusiness,
  dailyBusinessToAnnual,
  nominalToReal,
  realToNominal,
} from "../rate-conversion";

describe("rate-conversion", () => {
  it("converts 12% a.a. to the known monthly equivalent (~0.9489%)", () => {
    expect(annualToMonthly(0.12).toDecimalPlaces(6).toNumber()).toBeCloseTo(0.009489, 6);
  });

  it("annualToMonthly and monthlyToAnnual are inverses", () => {
    const monthly = annualToMonthly(0.15);
    const backToAnnual = monthlyToAnnual(monthly);
    expect(backToAnnual.toDecimalPlaces(10).toNumber()).toBeCloseTo(0.15, 10);
  });

  it("annualToDailyBusiness and dailyBusinessToAnnual (base 252) are inverses", () => {
    const daily = annualToDailyBusiness(0.1);
    const backToAnnual = dailyBusinessToAnnual(daily);
    expect(backToAnnual.toDecimalPlaces(10).toNumber()).toBeCloseTo(0.1, 10);
  });

  it("nominalToReal applies Fisher and discounts inflation", () => {
    // nominal 10%, inflation 4% -> real = (1.10/1.04)-1 ~= 5.769%
    const real = nominalToReal(0.1, 0.04);
    expect(real.toDecimalPlaces(6).toNumber()).toBeCloseTo(0.057692, 6);
  });

  it("realToNominal is the inverse of nominalToReal", () => {
    const real = nominalToReal(0.12, 0.05);
    const nominal = realToNominal(real, 0.05);
    expect(nominal.toDecimalPlaces(10).toNumber()).toBeCloseTo(0.12, 10);
  });

  it("real rate is negative when inflation exceeds nominal rate", () => {
    const real = nominalToReal(0.03, 0.06);
    expect(real.toNumber()).toBeLessThan(0);
  });
});
