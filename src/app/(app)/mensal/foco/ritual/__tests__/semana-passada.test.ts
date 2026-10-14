import { describe, expect, it } from "vitest";
import { semanaPassadaDoDiaADia } from "../semana-passada";

describe("Ritual: a semana passada é o dia a dia", () => {
  it("a semana do aluguel não vira '285% acima' nem 'o que mais pesou: Moradia'", () => {
    const r = semanaPassadaDoDiaADia([
      [{ parentCategory: "MORADIA", spent: 1800 }, { parentCategory: "ALIMENTACAO", spent: 400 }],
      [{ parentCategory: "ALIMENTACAO", spent: 380 }],
      [{ parentCategory: "ALIMENTACAO", spent: 420 }],
    ]);
    expect(r.total).toBe(400);
    expect(r.media).toBe(400);
    expect(r.maior?.parentCategory).toBe("ALIMENTACAO");
  });
});
