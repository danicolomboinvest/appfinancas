import { describe, expect, it } from "vitest";
import { MOTIVO_MOVIMENTACAO_B3, profileDocument } from "../profile";

describe("extrato de movimentação da B3", () => {
  // Layout do PDF da Área do Investidor; nomes, ativos e valores inventados.
  const texto = [
    "FULANA DE TAL | CPF/CNPJ: 00000000000",
    "Filtros aplicados",
    "Data Inicial: 01/09/2026 | Data Final: 30/09/2026",
    "Tipo de Movimentação: Todos.",
    "22 de setembro de 2026",
    "Movimentação Produto \tInstituição \tQuantidade Preço Unitário Valor da Operação",
    "Rendimento ABCD11 - FUNDO EXEMPLO IMOBILIÁRIO",
    "BANCO BTG",
    "PACTUAL S/A. 100 \tR$ 0,10 \tR$ 10,00",
    "Transferência -",
    "Liquidação WXYZ3 - EMPRESA EXEMPLO S.A. BANCO BTG",
    "PACTUAL S/A. 5 \tR$ 20,00 \tR$ 100,00",
    "Extrato de Movimentação",
    "acesse investidor.B3.com.br \t1/1",
  ].join("\n");

  it("é dos investimentos, da B3, e não traz entradas e saídas da conta", () => {
    const p = profileDocument(texto, "extrato.pdf");
    expect(p.institution).toBe("B3");
    expect(p.kind).toBe("position");
    expect(p.reason).toBe(MOTIVO_MOVIMENTACAO_B3);
    expect(p.contents).not.toContain("movements");
  });
});
