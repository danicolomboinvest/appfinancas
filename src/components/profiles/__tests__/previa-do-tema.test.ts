import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { vozDoTema } from "@/lib/profiles/voice";

describe("prévia do tema no Novo perfil", () => {
  it("não cumprimenta a Dani na conta de outra pessoa", () => {
    expect(readFileSync("src/components/profiles/ProfilesManager.tsx", "utf8")).not.toMatch(/saudacao\([^)]*"Dani"\)/);
  });
  it("cada tema tem saudação sem nome", () => {
    for (const tema of ["padrao", "girly", "manifestacao", "titanio"]) expect(vozDoTema(tema).saudacao("manha", undefined)).not.toMatch(/Dani|undefined/);
  });
});
