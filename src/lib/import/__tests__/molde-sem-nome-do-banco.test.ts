import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { profileDocument } from "../profile";
import { parseCsv } from "../statement-parser";

// Planilha da fatura do BTG (xlsx convertido em CSV pelo app), fictícia, no formato real.
const PLANILHA_BTG = [
  "Fatura Cartão de Crédito;;;;;Junho/2026;",
  "Vencimento;;17/06;;Lançamentos Internacionais;;R$ 0.00 ",
  ";;;;Total da Fatura;;R$ 1,746.83 ",
  "Total de compras e despesas;;;R$ 1,746.83 ;;;",
  "Data;Descrição;;Valor;Tipo de compra;Código de autorização;Final Cartão",
  "11/05;Mercado Pago (2/6);;R$ 42.10 ;Parcela sem juros;AAAAAA;0000",
  "18/08;Loja Exemplo (10/12);;R$ 1,658.33 ;Parcela sem juros;BBBBBB;0000",
  "02/06;Mercado Pago;;R$ 31.00 ;Compra à vista;CCCCCC;0000",
].join("\n");

const NOH = [
  "Data,Iniciador,Método,Descrição,Valor,Tipo",
  '11/10/2026,Fulana,Pix,MERCADO PAGO LOJA,"-R$ 10,41",Saída',
  '10/10/2026,Fulano,Cartão,Padaria Exemplo,"-R$ 5,00",Saída',
].join("\n");

describe("banco pelo molde, quando o arquivo não escreve o nome", () => {
  it("planilha da fatura BTG não vira Mercado Pago por causa de uma compra", () => {
    expect(profileDocument(PLANILHA_BTG, "fatura jul.xlsx").institution).toBe("BTG Pactual");
  });

  it("CSV do Noh", () => {
    expect(profileDocument(NOH, "Noh_extrato.csv").institution).toBe("Noh");
  });
});

describe("conferência com valor no formato de planilha (vírgula de milhar)", () => {
  it("não lê 'R$ 1,746.83' como R$ 1,74 e acusa que não fechou", () => {
    const txns = [
      { date: "2026-05-11", description: "Mercado Pago (2/6)", amount: 42.1 },
      { date: "2025-08-18", description: "Loja Exemplo (10/12)", amount: 1658.33 },
      { date: "2026-06-02", description: "Mercado Pago", amount: 31 },
    ];
    expect(conferirLeitura(PLANILHA_BTG, "fatura", txns).status).not.toBe("nao-fechou");
  });
});

describe("extrato das caixinhas do Nubank", () => {
  const CAIXINHAS = [
    "Extrato de Rendimentos",
    "Caixinhas PJ Período: 01 JAN 2026 a 31 MAR 2026",
    "RDB Resgate Imediato Rendimento 30 dias",
    "Instituição 260 - Nu Financeira S.A.",
    "Transações concluídas Saldo no final do período: R$ 1.000,00",
    "Data Movimentação Rendimento Valor bruto IR IOF Saldo Líquido",
    "09/01/2026 Resgate R$ 200,00 R$ 0,00 R$ 0,00 R$ 200,00",
    "20/01/2026 Compra por",
    "aplicação R$ 800,00 R$ 0,00 R$ 0,00 R$ 800,00",
    "31/01/2026 Rendimento até",
    "essa data R$ 5,47",
  ].join("\n");

  it("é posição (aplicação e resgate dentro do banco), não extrato da conta com entradas e saídas", () => {
    const p = profileDocument(CAIXINHAS, "Nubank_Extrato_de_Caixinhas_2026-01.pdf");
    expect(p.kind).toBe("position");
    expect(p.contents).not.toContain("movements");
    expect(p.reason).toMatch(/caixinhas/);
  });
});


describe("planilha da fatura BTG: a coluna 'Tipo de compra' não entra no nome", () => {
  it("'Parcela sem juros' e 'Compra à vista' ficam de fora da descrição", () => {
    const txns = parseCsv(PLANILHA_BTG, 2026);
    expect(txns.map((t) => t.description)).toEqual(["Mercado Pago (2/6)", "Loja Exemplo (10/12)", "Mercado Pago"]);
  });
});
