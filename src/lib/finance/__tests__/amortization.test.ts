import { describe, expect, it } from "vitest";
import { generateAmortizationSchedule, totalInterest, totalPaid } from "../amortization";

describe("generateAmortizationSchedule - SAC", () => {
  const rows = generateAmortizationSchedule({ system: "SAC", principal: 120000, monthlyRate: 0.01, months: 12 });

  it("has constant amortization every month", () => {
    for (const row of rows) {
      expect(row.amortization).toBeCloseTo(10000, 6);
    }
  });

  it("computes month 1 interest and payment from the full principal", () => {
    expect(rows[0].interest).toBeCloseTo(1200, 6);
    expect(rows[0].payment).toBeCloseTo(11200, 6);
    expect(rows[0].balance).toBeCloseTo(110000, 6);
  });

  it("has strictly decreasing payments (SAC signature behavior)", () => {
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].payment).toBeLessThan(rows[i - 1].payment);
    }
  });

  it("zeroes the balance at the end of the term", () => {
    expect(rows[rows.length - 1].balance).toBeCloseTo(0, 6);
  });
});

describe("generateAmortizationSchedule - PRICE", () => {
  const rows = generateAmortizationSchedule({ system: "PRICE", principal: 120000, monthlyRate: 0.01, months: 12 });

  it("has a constant payment every month", () => {
    const firstPayment = rows[0].payment;
    for (const row of rows) {
      expect(row.payment).toBeCloseTo(firstPayment, 6);
    }
    // Valor de parcela conhecido para PMT(0.01, 12, 120000, 0): P*r / (1-(1+r)^-n)
    expect(firstPayment).toBeCloseTo(10661.85, 2);
  });

  it("has strictly increasing amortization and decreasing interest over time", () => {
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].amortization).toBeGreaterThan(rows[i - 1].amortization);
      expect(rows[i].interest).toBeLessThan(rows[i - 1].interest);
    }
  });

  it("zeroes the balance at the end of the term", () => {
    expect(rows[rows.length - 1].balance).toBeCloseTo(0, 6);
  });
});

describe("totalInterest / totalPaid", () => {
  it("PRICE pays more total interest than SAC for the same loan (classic result)", () => {
    const sacRows = generateAmortizationSchedule({ system: "SAC", principal: 100000, monthlyRate: 0.015, months: 24 });
    const priceRows = generateAmortizationSchedule({ system: "PRICE", principal: 100000, monthlyRate: 0.015, months: 24 });

    expect(totalInterest(priceRows).toNumber()).toBeGreaterThan(totalInterest(sacRows).toNumber());
  });

  it("totalPaid equals principal plus totalInterest", () => {
    const rows = generateAmortizationSchedule({ system: "PRICE", principal: 50000, monthlyRate: 0.008, months: 36 });
    const paid = totalPaid(rows);
    const interest = totalInterest(rows);
    expect(paid.minus(interest).toNumber()).toBeCloseTo(50000, 4);
  });
});
