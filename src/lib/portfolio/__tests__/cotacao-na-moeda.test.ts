import { describe, expect, it } from "vitest";
import { precoNaMoeda } from "../cotacao-na-moeda";

/** A cotação da B3 vem em reais; quem usa o app em euro não pode ver o número em reais com €. */
describe("precoNaMoeda", () => {
  it("em reais, o preço passa direto", () => {
    expect(precoNaMoeda(38.5, "BRL", null)).toBe(38.5);
  });

  it("em euro, divide pela cotação (1 € = 5,50 R$)", () => {
    expect(precoNaMoeda(38.5, "EUR", 5.5)).toBe(7);
  });

  it("sem cotação da moeda, não devolve preço (o valor dela fica como está)", () => {
    expect(precoNaMoeda(38.5, "EUR", null)).toBeNull();
    expect(precoNaMoeda(38.5, "USD", 0)).toBeNull();
    expect(precoNaMoeda(38.5, "GBP", Number.NaN)).toBeNull();
  });
});
