import { describe, expect, it } from "vitest";
import { mesmaDescricao } from "../duplicata-solta";
import { isBtgExtratoContaPdf, parseBtgExtratoContaPdf } from "../btg-extrato-pdf";
import { parseStatementComLeitor } from "../statement-parser";

/** Extrato da conta BTG em PDF, fictício, no layout real (texto como sai da extração). */
const PAGINA = (emissao: string, linhas: string[]) => [
  "Extrato de conta corrente",
  "Cliente:",
  "Período do extrato:",
  "Olá Fulana!",
  emissao,
  "Lançamentos: R$ 87,53",
  "Este é o extrato da sua conta corrente BTG Pactual",
  "01/01/2026 a 24/04/2026",
  "Saldo atual",
  "Data e hora Categoria Transação Descrição Valor",
  ...linhas,
];
const EXTRATO = [
  ...PAGINA("24/04/2026 09h30", [
    "05/10/2026 10h51 Investimentos Transferência enviada Fulana Exemplo -R$ 1.816,52",
    "05/10/2026 10h50 Seguro Pix recebido Empresa Exemplo R$ 1.769,18",
    "01/10/2026 08h09 Impostos e",
    "Tributos IOF limite da conta BTG Pactual -R$ 1,75",
    "01/10/2026 23h59 Saldo Diário R$ 1.694,29",
    "20/08/2026 09h12",
    "Lazer e",
    "Entretenimento Pix enviado Loja Exemplo S A -R$ 230,10",
  ]),
  "-- 1 of 2 --",
  ...PAGINA("24/04/2026 09h30", ["02/01/2026 22h21 Alimentação Compra no débito autorizada Restaurante Exemplo -R$ 206,34"]),
].join("\n");

describe("extrato da conta BTG em PDF", () => {
  it("reconhece e é o leitor usado", () => {
    expect(isBtgExtratoContaPdf(EXTRATO)).toBe(true);
    expect(parseStatementComLeitor(EXTRATO, "pdf").leitor).toBe("btg-extrato");
  });

  it("descrição sem a hora e sem a categoria, como na planilha; categoria do banco à parte só na compra e em Investimentos (no Pix o BTG chuta); sem saldo e sem o topo da página", () => {
    expect(parseBtgExtratoContaPdf(EXTRATO)).toEqual([
      { date: "2026-10-05", description: "Transferência enviada · Fulana Exemplo", amount: -1816.52, categoriaDoBanco: "Investimentos" },
      { date: "2026-10-05", description: "Pix recebido · Empresa Exemplo", amount: 1769.18 },
      { date: "2026-10-01", description: "IOF limite da conta · BTG Pactual", amount: -1.75, categoriaDoBanco: "Impostos e Tributos" },
      { date: "2026-08-20", description: "Pix enviado · Loja Exemplo S A", amount: -230.1 },
      { date: "2026-01-02", description: "Compra no débito autorizada · Restaurante Exemplo", amount: -206.34, categoriaDoBanco: "Alimentação" },
    ]);
  });
});


describe("o mesmo extrato BTG subido de novo, com a descrição lida do jeito antigo", () => {
  it("'10h50 Seguro Pix recebido Fulana' é o mesmo que 'Pix recebido · Fulana'", () => {
    expect(mesmaDescricao("10h50 Seguro Pix recebido Empresa Exemplo", "Pix recebido · Empresa Exemplo")).toBe(true);
    expect(mesmaDescricao("00h31 Contas Pagamento de fatura do cartão Fatura do cartão BTG Pactual", "Pagamento de fatura do cartão · Fatura do cartão BTG Pactual")).toBe(true);
  });

  it("mas não casa nomes diferentes", () => {
    expect(mesmaDescricao("10h50 Seguro Pix recebido Empresa Exemplo", "Pix recebido · Outra Pessoa")).toBe(false);
  });
});
