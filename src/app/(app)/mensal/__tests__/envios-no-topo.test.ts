import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 21/10/2026: o "Histórico de importações" ficava fechado no fim da lista e ninguém achava (nem a
 * Dani); no período nem existia. Agora é o botãozinho "Importações" nas duas telas de Transações.
 */
const ler = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("arquivos enviados à vista nas Transações", () => {
  it.each(["[year]/[month]/page.tsx", "periodo/page.tsx"])("%s passa os envios para a lista e mostra também com o mês vazio", (arquivo) => {
    const s = ler(arquivo);
    expect(s).toMatch(/<ImportHistory/);
    expect(s).toMatch(/importacoes=\{importacoes\}/);
    expect(s).toMatch(/<VazioDeTransacoes \/>\s*<div className="flex justify-center">\{importacoes\}<\/div>/);
  });

  it("o botãozinho fica no fim da fileira de filtros, depois de Categoria (escolha da Dani)", () => {
    const lista = ler("[year]/[month]/EntryList.tsx");
    const filtros = lista.slice(lista.indexOf('aria-label="Filtrar"'));
    expect(filtros.indexOf("{importacoes}")).toBeGreaterThan(filtros.indexOf("Categoria <ChevronDown"));
    expect(filtros.indexOf("{importacoes}")).toBeLessThan(filtros.indexOf("data-filtro-categoria"));
  });

  it("não é mais uma seção fechada no fim", () => {
    expect(ler("[year]/[month]/ImportHistory.tsx")).not.toMatch(/CollapsibleSection/);
    // Regra da Dani: nada cortado com reticências; o nome do arquivo quebra linha.
    expect(ler("[year]/[month]/ImportHistory.tsx")).not.toMatch(/\btruncate\b/);
  });
});
