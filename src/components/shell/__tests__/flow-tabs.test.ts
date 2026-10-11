import { describe, expect, it } from "vitest";
import { ABAS_DA_VISAO_GERAL, abaAtiva, ehRotaDoFluxo } from "../flow-tabs";

describe("as abas da Visão geral", () => {
  it("são Resumo, Orçamento, Transações e Recorrentes", () => {
    expect(ABAS_DA_VISAO_GERAL.map((a) => a.label)).toEqual(["Resumo", "Orçamento", "Transações", "Recorrentes"]);
  });

  it("acende a aba de rota mais específica", () => {
    const aba = (r: string) => abaAtiva(r)?.label ?? null;
    expect(aba("/mensal/foco")).toBe("Resumo");
    expect(aba("/mensal/foco/fechamento")).toBe("Resumo");
    expect(aba("/dashboard")).toBe("Resumo");
    expect(aba("/orcamento")).toBe("Orçamento");
    expect(aba("/orcamento/2026")).toBe("Orçamento");
    expect(aba("/orcamento/contas")).toBe("Recorrentes");
    expect(aba("/mensal")).toBe("Transações");
    expect(aba("/mensal/2026/10")).toBe("Transações");
    expect(aba("/mensal/gastos")).toBe("Transações");
    expect(aba("/carteira")).toBeNull();
  });

  it("ehRotaDoFluxo reconhece só as pastas da Visão geral", () => {
    for (const rota of ["/mensal", "/mensal/foco", "/mensal/2026/9", "/orcamento", "/orcamento/contas", "/dashboard"]) expect(ehRotaDoFluxo(rota), rota).toBe(true);
    for (const rota of ["/mensalidade", "/orcamentos", "/planejamento/metas", "/carteira", "/"]) expect(ehRotaDoFluxo(rota), rota).toBe(false);
  });
});
