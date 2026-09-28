import { describe, expect, it } from "vitest";
import { preferencesSchema } from "../user-settings.schema";

/** Nos temas que já decidem claro/escuro o formulário não manda "theme": a moeda tem que salvar. */
describe("preferências", () => {
  it("salva a moeda sem o campo de modo (temas que não sejam o Padrão)", () => {
    const r = preferencesSchema.safeParse({ currency: "EUR", theme: undefined });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ currency: "EUR" });
  });

  it("com o seletor à mostra, grava o modo escolhido", () => {
    expect(preferencesSchema.parse({ currency: "BRL", theme: "light" })).toEqual({ currency: "BRL", theme: "light" });
  });

  it("valor fora da lista dá erro em português", () => {
    const r = preferencesSchema.safeParse({ currency: "JPY", theme: "roxo" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual(["Escolha uma moeda da lista.", "Escolha claro ou escuro."]);
  });
});
