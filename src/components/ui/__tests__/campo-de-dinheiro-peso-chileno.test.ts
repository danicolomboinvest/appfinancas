import { describe, expect, it, vi } from "vitest";

/** Peso chileno (20/10/2026): o campo digita pesos inteiros, não centavos. */
vi.mock("@/components/money/MoneyProvider", () => ({ useCurrency: () => "CLP" }));

import { campo, digitar } from "./digitar-no-campo";

describe("CampoDeDinheiro em peso chileno", () => {
  it("digitar 12500 dá doze mil e quinhentos pesos (em real seria 125,00)", () => {
    expect(digitar("12500")).toBe(12500);
  });
  it("mostra o valor sem centavos e apagar tira o último dígito", () => {
    expect(campo(12500, () => {}).value).toBe("12.500");
    expect(digitar("⌫", 12500)).toBe(1250);
    expect(digitar("12500⌫⌫")).toBe(125);
  });
  it("com o símbolo da moeda, sem ',00'", () => {
    expect(campo(12500, () => {}, { comSimbolo: true }).value).toMatch(/12\.500$/);
    expect(campo(12500, () => {}, { comSimbolo: true }).value).not.toMatch(/,/);
  });
  it("a moeda do campo manda: em real dentro de um app em peso, continua na maquininha", () => {
    expect(digitar("12500", null, { currency: "BRL" })).toBe(125);
  });
});
