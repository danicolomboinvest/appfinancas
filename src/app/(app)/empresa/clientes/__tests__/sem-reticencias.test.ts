import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regra da Dani: texto nunca cortado com "…"; se não couber, quebra linha. A 320 px a legenda dos
 * clientes mostrava "Café Lu…", "Buffet S…" e "Carla Me…" (21/10/2026).
 */
describe("Clientes da Empresa sem texto cortado", () => {
  it("o nome do cliente quebra linha em vez de cortar", () => {
    expect(readFileSync(join(__dirname, "..", "page.tsx"), "utf8")).not.toMatch(/\btruncate\b/);
  });
});
