import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 21/10/2026: o "Histórico de importações" ficava fechado no fim da lista e ninguém achava (nem a
 * Dani); no período nem existia. Os arquivos enviados, com o Desfazer, vêm ANTES da lista nas
 * duas telas de Transações.
 */
const ler = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("arquivos enviados no topo das Transações", () => {
  it.each(["[year]/[month]/page.tsx", "periodo/page.tsx"])("%s mostra os envios antes da lista", (arquivo) => {
    const s = ler(arquivo);
    expect(s.indexOf("<ImportHistory")).toBeGreaterThan(-1);
    expect(s.indexOf("<ImportHistory")).toBeLessThan(s.indexOf("<EntryList"));
  });

  it("não é mais uma seção fechada no fim", () => {
    expect(ler("[year]/[month]/ImportHistory.tsx")).not.toMatch(/CollapsibleSection/);
    // Regra da Dani: nada cortado com reticências; o nome do arquivo quebra linha.
    expect(ler("[year]/[month]/ImportHistory.tsx")).not.toMatch(/\btruncate\b/);
  });
});
