import { describe, expect, it } from "vitest";
import { quedaDe15 } from "../queda";

describe("a queda de 15% do Montar minha estratégia", () => {
  it("usa a carteira dela quando tem", () => {
    expect(quedaDe15(41569.51)).toEqual({ antes: 41569.51, depois: 41569.51 * 0.85, exemplo: false });
  });
  it("com a carteira vazia, mostra um exemplo em vez de R$ 0 era R$ 0", () => {
    expect(quedaDe15(0)).toEqual({ antes: 10000, depois: 8500, exemplo: true });
    expect(quedaDe15(Number.NaN).exemplo).toBe(true);
  });
});
