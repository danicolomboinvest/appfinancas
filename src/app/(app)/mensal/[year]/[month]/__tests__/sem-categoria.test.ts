import { describe, expect, it } from "vitest";
import { rotuloSemCategoria } from "../sem-categoria";

describe("rotuloSemCategoria", () => {
  it("gasto sem categoria diz Sem categoria, como no Orçamento", () => expect(rotuloSemCategoria("EXPENSE", "Gasto")).toBe("Sem categoria"));
  it("renda e guardado seguem com o tipo", () => {
    expect(rotuloSemCategoria("INCOME", "Renda")).toBe("Renda");
    expect(rotuloSemCategoria("INVESTMENT_CONTRIBUTION", "Guardado")).toBe("Guardado");
  });
});
