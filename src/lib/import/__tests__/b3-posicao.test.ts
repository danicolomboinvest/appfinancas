import { describe, expect, it } from "vitest";
import { isB3Position } from "../b3-posicao";
import { parsePortfolioStatement } from "../portfolio-parser";
import { profileDocument } from "../profile";

/**
 * Posição FICTÍCIA da Área do Investidor da B3, nos dois formatos que ela baixa. Uma cliente
 * subiu os dois 13 vezes e a Carteira respondia "isso é uma fatura de cartão".
 */

// Excel → CSV (todas as abas, ";"), como o extract-text entrega.
const B3_XLSX = [
  "Produto;Instituição;Emissor;Código;Indexador;Tipo de regime;Data de Emissão;Vencimento;Quantidade;Quantidade Disponível;Quantidade Indisponível;Motivo;Contraparte;Preço Atualizado MTM;Valor Atualizado MTM;Preço Atualizado CURVA;Valor Atualizado CURVA;Preço Atualizado FECHAMENTO;Valor Atualizado FECHAMENTO",
  "CDB - BANCO EXEMPLO S.A.;CORRETORA EXEMPLO S/A;BANCO EXEMPLO S.A.;CDB1111AAAA;DI;DEPOSITADO;09/01/2024;08/01/2027;5;5;-;-;-; - ; - ;1000.5;5002.5; - ; - ",
  "CDB - BANCO EXEMPLO S.A.;CORRETORA EXEMPLO S/A;BANCO EXEMPLO S.A.;CDB2222BBBB;DI;DEPOSITADO;10/10/2023;09/10/2029;1000;1000;-;-;-; - ; - ;1.2;1200; - ; - ",
  "CDB - FINANCEIRA MODELO S.A.;CORRETORA EXEMPLO S/A;FINANCEIRA MODELO S.A.;CDB3333CCCC;IPCA;DEPOSITADO;10/10/2023;09/10/2028;2;2;-;-;-; - ; - ;1500;3000; - ; - ",
  ";;;;;;;;;;;;;;;;;;",
  ";;;;;;;;;;;;;;;;Total;;Total",
  ";;;;;;;;;;;;;;;;9202.5;;9202.5",
  "Produto;Instituição;Código ISIN;Indexador;Vencimento;Quantidade;Quantidade Disponível;Quantidade Indisponível;Motivo;Valor Aplicado;Valor bruto;Valor líquido;Valor Atualizado",
  "Tesouro Selic 2029;CORRETORA EXEMPLO S/A;BRSTNCLF0000;SELIC;01/03/2029;0.5;0.5;-;-;7000;8000.1;7900;8000.1",
  ";;;;;;;;;;;;",
  "Produto;Instituição;Conta;Código de Negociação;CNPJ da Empresa;Código ISIN / Distribuição;Tipo;Escriturador;Quantidade;Quantidade Disponível;Quantidade Indisponível;Motivo;Preço de Fechamento;Valor Atualizado",
  "PETR4 - PETROLEO BRASILEIRO S.A. PETROBRAS;CORRETORA EXEMPLO S/A;1;PETR4;00.000.000/0001-00;BRPETRACNPR6;PN;BANCO;10;10;-;-;30.5;305",
].join("\n");

// "Extrato de Posição" em PDF: produto e instituição quebrados em várias linhas.
const B3_PDF = [
  "FULANA DE TAL | CPF/CNPJ: 00000000000",
  "Filtros aplicados",
  "Data: 05/10/2026",
  "CDB - Certificado de Depósito Bancário",
  "Produto \tInstituição \tVencimento Quantidade",
  "Preço",
  "unitário",
  "atualizado",
  "Valor",
  "atualizado",
  "CDB - BANCO EXEMPLO S.A. \tCORRETORA",
  "EXEMPLO",
  "S/A",
  "08/01/2027 \t5 R$",
  "1.000,50",
  "R$",
  "5.002,50",
  "CDB - BANCO EXEMPLO S.A. BANCO EXEMPLO S.A. \t09/10/2029 \t1000 \tR$ 1,20 R$",
  "1.200,00",
  "CDB - FINANCEIRA MODELO S.A. COM NOME",
  "COMPRIDO",
  "CORRETORA",
  "EXEMPLO",
  "S/A",
  "09/10/2028 \t2 R$",
  "1.500,00",
  "R$",
  "3.000,00",
  "Total",
  "R$ 9.202,50",
  "Tesouro Direto",
  "Produto \tInstituição \tVencimento \tQuantidade \tValor aplicado \tValor atualizado",
  "Tesouro Selic 2029 \tCORRETORA EXEMPLO S/A. \t01/03/2029 \t0,5 \tR$ 7.000,00 \tR$ 8.000,10",
  "Total",
  "R$ 8.000,10",
  "Extrato de Posição",
  "acesse investidor.B3.com.br \t1/1",
].join("\n");

describe("posição da Área do Investidor (B3)", () => {
  it("é posição, não fatura, nos dois formatos", () => {
    expect(isB3Position(B3_XLSX)).toBe(true);
    expect(isB3Position(B3_PDF)).toBe(true);
    expect(profileDocument(B3_XLSX).kind).toBe("position");
    expect(profileDocument(B3_PDF).kind).toBe("position");
  });

  it("Excel: renda fixa pelo nome com o valor na curva, tesouro e ação pelo ticker", () => {
    const h = parsePortfolioStatement(B3_XLSX);
    expect(h).toEqual([
      { ticker: "CDB - BANCO EXEMPLO S.A.", quantity: 1005, value: 6202.5, assetClass: "RENDA_FIXA", fixedIncomeIndex: "POS_FIXADO" },
      { ticker: "CDB - FINANCEIRA MODELO S.A.", quantity: 2, value: 3000, assetClass: "RENDA_FIXA", fixedIncomeIndex: "IPCA" },
      {
        ticker: "Tesouro Selic 2029",
        quantity: 0.5,
        value: 8000.1,
        assetClass: "TESOURO_DIRETO",
        fixedIncomeIndex: "POS_FIXADO",
        investedValue: 7000,
      },
      { ticker: "PETR4", quantity: 10, value: 305, assetClass: "ACAO" },
    ]);
  });

  it("PDF: separa o produto da instituição quebrada e soma o total impresso de cada seção", () => {
    const h = parsePortfolioStatement(B3_PDF);
    expect(h.map((x) => [x.ticker, x.value])).toEqual([
      ["CDB - BANCO EXEMPLO S.A.", 6202.5],
      ["CDB - FINANCEIRA MODELO S.A. COM NOME COMPRIDO", 3000],
      ["Tesouro Selic 2029", 8000.1],
    ]);
    const rendaFixa = h.filter((x) => x.assetClass === "RENDA_FIXA").reduce((s, x) => s + x.value, 0);
    expect(rendaFixa).toBeCloseTo(9202.5, 2);
    expect(h[2]).toMatchObject({ assetClass: "TESOURO_DIRETO", investedValue: 7000 });
  });
});
