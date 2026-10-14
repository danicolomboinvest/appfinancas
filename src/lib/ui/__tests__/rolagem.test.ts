import { describe, expect, it } from "vitest";
import { rolouDeVerdade } from "../rolagem";

describe("o menu do … e a rolagem", () => {
  it("o fim do embalo (poucos pixels) não fecha o menu", () => {
    expect(rolouDeVerdade(800, 812)).toBe(false);
    expect(rolouDeVerdade(800, 790)).toBe(false);
  });
  it("rolar a página de verdade fecha", () => {
    expect(rolouDeVerdade(800, 900)).toBe(true);
    expect(rolouDeVerdade(800, 700)).toBe(true);
  });
});
