import { describe, expect, it } from "vitest";
import { assetSchema } from "../asset.schema";

const base = { name: "Teste", assetClass: "ACAO", objective: "OUTRO", currentValue: 100 };

describe("limites do ativo", () => {
  it("aceita valor normal", () => {
    expect(assetSchema.safeParse(base).success).toBe(true);
  });
  it("recusa valor que não cabe no banco em vez de estourar", () => {
    expect(assetSchema.safeParse({ ...base, currentValue: 7e15 }).success).toBe(false);
    expect(assetSchema.safeParse({ ...base, quantity: 1e12 }).success).toBe(false);
  });
});
