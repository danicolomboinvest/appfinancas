import { describe, expect, it } from "vitest";
import { ehRotaDoFluxo } from "../flow-tabs";
import { MOBILE_TABS, NAV_SECTIONS, sectionMatches } from "../nav-sections";

describe("a aba Fluxo acende em todas as abas do Fluxo, inclusive o Orçamento", () => {
  it("ehRotaDoFluxo reconhece /mensal e /orcamento e o que vem dentro deles", () => {
    for (const rota of ["/mensal", "/mensal/foco", "/mensal/2026/9", "/mensal/gastos", "/orcamento", "/orcamento/2026"]) {
      expect(ehRotaDoFluxo(rota), rota).toBe(true);
    }
  });

  it("não confunde rota com nome parecido nem outras seções", () => {
    for (const rota of ["/mensalidade", "/orcamentos", "/planejamento/metas", "/carteira", "/"]) {
      expect(ehRotaDoFluxo(rota), rota).toBe(false);
    }
  });

  it("o Fluxo da barra de baixo acende no Orçamento", () => {
    const fluxo = MOBILE_TABS.find((t) => t.basePath === "/mensal")!;
    expect(sectionMatches(fluxo, "/orcamento")).toBe(true);
    expect(sectionMatches(fluxo, "/orcamento/2026")).toBe(true);
    expect(sectionMatches(fluxo, "/mensal/foco")).toBe(true);
    // E só ele: Metas e Carteira continuam apagadas no Orçamento.
    const acesas = MOBILE_TABS.filter((t) => sectionMatches(t, "/orcamento")).map((t) => t.basePath);
    expect(acesas).toEqual(["/mensal"]);
  });

  it("o Fluxo do menu lateral acende no Orçamento (e abre o submenu com a aba Orçamento)", () => {
    const acesas = NAV_SECTIONS.filter((s) => sectionMatches(s, "/orcamento/2026")).map((s) => s.basePath);
    expect(acesas).toEqual(["/mensal"]);
  });
});
