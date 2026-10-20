import { describe, expect, it } from "vitest";
import { MAIOR_VALOR } from "../digitado";
import { MAX_CENTAVOS, teclar } from "@/lib/entries/digitar";
import { clampCategoryValue } from "@/lib/travel/estimates";

// 20/10/2026, primeira cliente na Argentina: em pesos os valores têm 2 ou 3 dígitos a mais. Um
// financiamento de imóvel passa de ARS 100 milhões, e o app cortava em silêncio.
describe("valores grandes em pesos", () => {
  it("o teto é de 10 bilhões, longe de qualquer valor em reais e acima de um imóvel em pesos", () => {
    expect(MAIOR_VALOR).toBe(10_000_000_000);
  });
  it("o Digitar aceita ARS 150.000.000,00", () => {
    expect(teclar(1_500_000_000, "0")).toBe(15_000_000_000);
    expect(MAX_CENTAVOS).toBeGreaterThanOrEqual(150_000_000_00);
  });
  it("a Viagem aceita ARS 5.000.000 numa categoria", () => {
    expect(clampCategoryValue(5_000_000)).toBe(5_000_000);
  });
});
