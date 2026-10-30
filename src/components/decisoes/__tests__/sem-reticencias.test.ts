import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regra da Dani: texto nunca cortado com "…"; se não couber, quebra linha (17/10/2026). A 320 px o
 * "Quanto preciso guardar?" mostrava "Viagem Europa 2027 · até n…", sem o prazo que explica o valor.
 */
const RAIZ = join(__dirname, "..", "..", "..", "..");
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

describe("Decidir sem texto cortado", () => {
  it.each(["src/components/decisoes/Fluxos.tsx", "src/components/decisoes/RespostaDesenhada.tsx", "src/app/(app)/decidir/raio-x/RaioX.tsx"])("%s quebra linha em vez de cortar", (arquivo) => {
    expect(ler(arquivo)).not.toMatch(/\btruncate\b/);
  });
});
