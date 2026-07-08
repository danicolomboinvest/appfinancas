import { describe, expect, it } from "vitest";
import { getCriteriaForSlot, SLOT_CRITERION_KEYS, type SheetCriterion } from "../document-extraction";

const ALL_STOCK_CRITERIA: SheetCriterion[] = [
  { id: "1", key: "tag_along", label: "Tag Along", helpText: null },
  { id: "2", key: "free_float", label: "Free Float", helpText: null },
  { id: "3", key: "socios_majoritarios", label: "Sócios Majoritários", helpText: null },
  { id: "4", key: "historico_polemicas", label: "Histórico de Polêmicas", helpText: null },
  { id: "5", key: "divida_liquida_ebitda", label: "Dívida Líquida / EBITDA", helpText: null },
  { id: "6", key: "roe", label: "ROE", helpText: null },
];

describe("getCriteriaForSlot", () => {
  it("returns only the criteria mapped to ESTATUTO_SOCIAL", () => {
    const result = getCriteriaForSlot("ESTATUTO_SOCIAL", ALL_STOCK_CRITERIA);
    expect(result.map((c) => c.key)).toEqual(["tag_along", "socios_majoritarios"]);
  });

  it("returns only the criteria mapped to RELATORIO_GERENCIAL", () => {
    const result = getCriteriaForSlot("RELATORIO_GERENCIAL", ALL_STOCK_CRITERIA);
    expect(result.map((c) => c.key)).toEqual(["divida_liquida_ebitda", "roe"]);
  });

  it("OUTRO is the complement of the two curated slots", () => {
    const result = getCriteriaForSlot("OUTRO", ALL_STOCK_CRITERIA);
    expect(result.map((c) => c.key)).toEqual(["free_float", "historico_polemicas"]);
  });

  it("never puts the same key in more than one curated slot", () => {
    const estatuto = new Set(SLOT_CRITERION_KEYS.ESTATUTO_SOCIAL);
    const relatorio = new Set(SLOT_CRITERION_KEYS.RELATORIO_GERENCIAL);
    const overlap = [...estatuto].filter((key) => relatorio.has(key));
    expect(overlap).toEqual([]);
  });
});
