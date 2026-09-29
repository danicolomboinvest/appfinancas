import { describe, expect, it } from "vitest";
import { assetSchema } from "../asset.schema";

const base = { name: "CDB Inter", assetClass: "RENDA_FIXA", currentValue: "20000" };

describe("assetSchema: objetivo Meta", () => {
  it("Meta sem meta escolhida é recusada com a mensagem certa", () => {
    const r = assetSchema.safeParse({ ...base, objective: "META" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Escolha a meta desse ativo.");
  });

  it("Meta com meta passa; outros objetivos não precisam de meta", () => {
    expect(assetSchema.safeParse({ ...base, objective: "META", goalId: "carro" }).success).toBe(true);
    expect(assetSchema.safeParse({ ...base, objective: "OUTRO" }).success).toBe(true);
  });
});
