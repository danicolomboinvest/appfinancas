import { describe, expect, it } from "vitest";
import { NAV_SECTIONS, rotuloDoMenu, secoesVisiveis, sectionMatches, tituloDaTela } from "../nav-sections";

const bases = (lista: { basePath: string }[]) => lista.map((x) => x.basePath);

describe("o menu ☰ da versão nova", () => {
  it("tem a ordem do protótipo, com Dívidas logo depois de Metas", () => {
    const pessoa = secoesVisiveis(NAV_SECTIONS, { empresa: false, casal: false });
    expect(pessoa.map((s) => s.label)).toEqual([
      "Visão geral", "Metas", "Dívidas", "Carteira", "Viagem", "Calculadoras", "Análises", "Decidir", "Configurações", "Como funciona",
    ]);
  });

  it("a Empresa troca o que é de pessoa física pelo 'Vale a pena investir?' e chama a Carteira de Caixa", () => {
    const empresa = secoesVisiveis(NAV_SECTIONS, { empresa: true, casal: false });
    expect(bases(empresa)).toEqual(["/mensal", "/planejamento", "/carteira", "/investir", "/configuracoes", "/guia"]);
    expect(rotuloDoMenu(empresa[2], true)).toBe("Caixa");
  });

  it("o Casal ganha o 'Nós dois' sem perder nada", () => {
    const casal = secoesVisiveis(NAV_SECTIONS, { empresa: false, casal: true });
    expect(bases(casal)).toContain("/divisao");
    // O título do topo do perfil Casal é "Nós dois", como no protótipo (não a calculadora cortada).
    expect(tituloDaTela("/divisao", casal)).toBe("Nós dois");
    expect(tituloDaTela("/divisao/fechar", casal)).toBe("Nós dois");
    // As outras telas continuam com o título delas.
    expect(tituloDaTela("/planejamento/metas", casal)).toBe("Metas");
    expect(tituloDaTela("/mensal/foco", casal)).toBe("Visão geral");
    expect(casal).toHaveLength(11);
  });

  it("toda tela da Visão geral acende a Visão geral, e só ela", () => {
    for (const rota of ["/mensal/foco", "/mensal/2026/10", "/mensal/gastos", "/orcamento", "/orcamento/contas", "/dashboard"]) {
      expect(NAV_SECTIONS.filter((s) => sectionMatches(s, rota)).map((s) => s.basePath), rota).toEqual(["/mensal"]);
    }
  });

  it("o título do topo é o nome da seção", () => {
    expect(tituloDaTela("/orcamento", NAV_SECTIONS)).toBe("Visão geral");
    expect(tituloDaTela("/planejamento/reserva-emergencia", NAV_SECTIONS)).toBe("Metas");
    expect(tituloDaTela("/perfis", NAV_SECTIONS)).toBe("Configurações");
    expect(tituloDaTela("/money-reset", NAV_SECTIONS)).toBe("SPI Finance");
  });
});
