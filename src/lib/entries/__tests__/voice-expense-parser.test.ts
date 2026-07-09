import { describe, expect, it } from "vitest";
import { parseVoiceEntry } from "../voice-expense-parser";

describe("parseVoiceEntry", () => {
  it("parses a spoken amount in extenso with a category keyword", () => {
    const result = parseVoiceEntry("gastei quinhentos reais com farmácia");
    expect(result.category).toBe("EXPENSE");
    expect(result.parentCategory).toBe("SAUDE");
    expect(result.amount).toBe(500);
    expect(result.description).toBe("Farmacia");
  });

  it("parses a digit amount with R$ prefix", () => {
    const result = parseVoiceEntry("gastei R$45,90 no mercado");
    expect(result.category).toBe("EXPENSE");
    expect(result.parentCategory).toBe("ALIMENTACAO");
    expect(result.amount).toBeCloseTo(45.9, 6);
  });

  it("recognizes INCOME verbs", () => {
    const result = parseVoiceEntry("recebi 3000 reais de salário");
    expect(result.category).toBe("INCOME");
    expect(result.amount).toBe(3000);
    expect(result.parentCategory).toBeNull();
  });

  it("recognizes INVESTMENT_CONTRIBUTION verbs", () => {
    const result = parseVoiceEntry("investi mil reais em cdb");
    expect(result.category).toBe("INVESTMENT_CONTRIBUTION");
    expect(result.parentCategory).toBe("FINANCEIRO");
    expect(result.amount).toBe(1000);
  });

  it("defaults to EXPENSE when no verb is recognized", () => {
    const result = parseVoiceEntry("cem reais de uber");
    expect(result.category).toBe("EXPENSE");
    expect(result.parentCategory).toBe("TRANSPORTE");
    expect(result.amount).toBe(100);
  });

  it("returns null amount when nothing matches", () => {
    const result = parseVoiceEntry("comprei um presente pra ela");
    expect(result.amount).toBeNull();
  });

  it("returns null parentCategory when no keyword matches", () => {
    const result = parseVoiceEntry("gastei 50 reais com uma coisa qualquer");
    expect(result.parentCategory).toBeNull();
    expect(result.amount).toBe(50);
  });

  it("is accent-insensitive when matching keywords", () => {
    const result = parseVoiceEntry("paguei a conta de água esse mês, 120 reais");
    expect(result.parentCategory).toBe("MORADIA");
    expect(result.amount).toBe(120);
  });

  it("handles compound extenso numbers with mil", () => {
    const result = parseVoiceEntry("recebi mil e duzentos reais");
    expect(result.amount).toBe(1200);
  });

  it("falls back the description to the raw text when no category matches", () => {
    const result = parseVoiceEntry("gastei 30 reais com uma coisa qualquer");
    expect(result.description).toBe("gastei 30 reais com uma coisa qualquer");
  });
});
