import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regra da Dani: texto nunca cortado com "…"; se não couber, quebra linha (17/10/2026). A 320 px a
 * escolha da dívida mostrava "Nubank · Fat…" e a lista das contas salvas cortava nome e resumo.
 */
const RAIZ = join(__dirname, "..", "..", "..", "..");
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

describe("Calculadoras sem texto cortado", () => {
  it.each(["src/components/calculadoras/fluxos/AmortizarGuiado.tsx", "src/components/calculadoras/TelaDasCalculadoras.tsx"])("%s quebra linha em vez de cortar", (arquivo) => {
    expect(ler(arquivo)).not.toMatch(/\btruncate\b/);
  });
});
