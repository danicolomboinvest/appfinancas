import { describe, expect, it } from "vitest";
import { parseVoiceEntry } from "../voice-expense-parser";

describe("parseVoiceEntry", () => {
  it("parses a spoken amount in extenso with a category keyword", () => {
    const result = parseVoiceEntry("gastei quinhentos reais com farmácia");
    expect(result.category).toBe("EXPENSE");
    expect(result.parentCategory).toBe("SAUDE");
    expect(result.amount).toBe(500);
    expect(result.description).toBe("Farmácia");
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
  // O caso que a Dani gravou: "acabei de receber 4 mil reais" virava um GASTO de R$ 4,00 —
  // dois erros no mesmo áudio (o verbo no infinitivo e o "mil" solto).
  it("understands receber in any conjugation, not just the past tense", () => {
    const result = parseVoiceEntry("acabei de receber 4 mil reais");
    expect(result.category).toBe("INCOME");
    expect(result.amount).toBe(4000);
  });

  it.each([
    ["vou receber o pagamento amanhã", "INCOME"],
    ["me pagaram 500 reais", "INCOME"],
    ["caiu o salário hoje", "INCOME"],
    ["vendi a bicicleta por 300 reais", "INCOME"],
    ["o freela de setembro, 1200", "INCOME"],
    ["guardei 300 reais", "INVESTMENT_CONTRIBUTION"],
    ["comprei ações, 800 reais", "INVESTMENT_CONTRIBUTION"],
    ["comprei um presente de 80 reais", "EXPENSE"],
  ])("classifies %j as %s", (frase, tipo) => {
    expect(parseVoiceEntry(frase).category).toBe(tipo);
  });

  it("lets the first verb in the sentence win, not the first rule in the list", () => {
    // "salário" sozinho é renda, mas quem veio antes foi o "paguei".
    expect(parseVoiceEntry("paguei o salário da diarista, 200 reais").category).toBe("EXPENSE");
    expect(parseVoiceEntry("recebi o salário e paguei o aluguel").category).toBe("INCOME");
  });

  it("reads amounts spoken with mil, including the extenso tail", () => {
    expect(parseVoiceEntry("gastei 4 mil reais").amount).toBe(4000);
    expect(parseVoiceEntry("recebi 4 mil e quinhentos reais").amount).toBe(4500);
    expect(parseVoiceEntry("aportei 2,5 mil reais").amount).toBe(2500);
    expect(parseVoiceEntry("recebi 2 milhões").amount).toBe(2_000_000);
  });

  it("prefers the number glued to the money over a loose one", () => {
    expect(parseVoiceEntry("gastei 2 cafés de 15 reais").amount).toBe(15);
  });

  it("keeps income out of the expense categories", () => {
    const result = parseVoiceEntry("recebi 4 mil de aluguel");
    expect(result.category).toBe("INCOME");
    expect(result.parentCategory).toBeNull();
  });

  it("names the income in the description when the sentence says what it was", () => {
    expect(parseVoiceEntry("recebi 3000 reais de salário").description).toBe("Salário");
  });
});
