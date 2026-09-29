import { describe, expect, it } from "vitest";
import { parsePortfolioStatement } from "../portfolio-parser";
import { profileDocument } from "../profile";
import { isSafraMonthlyReport } from "../safra-pdf";

/**
 * Relatório FICTÍCIO com a mesma estrutura do "Relatório Mensal" do Banco Safra: aplicações pelo
 * nome (sem código de ativo), "vencimento" repetido (o que fazia o app achar que era fatura),
 * tabela de posição com linhas de classe, tabela de cotas dos fundos, detalhe do CDB — e o
 * relatório inteiro repetido, como veio no arquivo de uma cliente.
 */
const PAGINAS = [
  "Relatório Mensal",
  "Composição da carteira Agência: 00000 / Conta: XXXX00-0",
  "Vencimento do suitability",
  "contacte a Central de Atendimento Safra para saber como atualizar",
  "14/05/2027",
  "Relatório Mensal",
  "Posição de Investimentos Agência: 00000 / Conta: XXXX00-0",
  "Data da posição: 31/08/2026",
  "Sld Bruto (R$) \tImpostos (R$) \tSld Líquido (R$) \t% PL \tMês (%) \tAno (%) \t12 Meses (%)",
  "RENDA FIXA \t60.000,00 \t100,00 \t59.899,99 \t100,00 \t1,07 \t9,25 \t14,44",
  "CDB PRE EXEMPLO \t40.000,00 \t- \t39.999,99 \t66,67 \t- \t- \t-",
  "SAF FUNDO EXEMPLO RF \t20.000,00 \t100,00 \t19.900,00 \t33,33 \t1,09 \t9,26 \t14,55",
  "Relatório Mensal - Agosto de 2026 \t4\tRelatório gerado em 28/09/2026 14:46",
  "Fundos \tQtde de Cotas \tValor Cotas (R$) \tSld. Aplicado (R$) \tSld. Bruto (R$) \tImpostos Previstos (R$) \tSld. Líquido (R$)",
  "RENDA FIXA",
  "SAF FUNDO EXEMPLO RF \t1.000,000000 \t20,000000 \t18.000,00 \t20.000,00 \t100,00 \t19.900,00",
  "Avo: CDB PRE EXEMPLO \tEmissor: BANCO EXEMPLO S A \tData Aplicação: 31/08/2026 \tData Vencimento: 31/08/2028",
  "CDB PRE EXEMPLO \tBANCO EXEMPLO S A \tPRE \t- +14,37 31/08/2026 \t31/08/2028 \t40,00 \t40.000,00 \t40.000,00 \t- \t39.999,99",
  "Vencimento / Repactuação",
];
const SAFRA = [...PAGINAS, ...PAGINAS].join("\n");

describe("relatório mensal do Safra (PDF)", () => {
  it("é posição da carteira, não fatura", () => {
    expect(isSafraMonthlyReport(SAFRA)).toBe(true);
    const perfil = profileDocument(SAFRA);
    expect(perfil.kind).toBe("position");
    expect(perfil.institution).toBe("Safra");
  });

  it("lê cada aplicação uma vez só, com cotas do fundo e o CDB prefixado", () => {
    expect(parsePortfolioStatement(SAFRA)).toEqual([
      { ticker: "CDB PRE EXEMPLO", quantity: 40, value: 40000, assetClass: "RENDA_FIXA", investedValue: 40000, fixedIncomeIndex: "PREFIXADO" },
      { ticker: "SAF FUNDO EXEMPLO RF", quantity: 1000, value: 20000, assetClass: "FUNDO", investedValue: 18000 },
    ]);
  });
});
