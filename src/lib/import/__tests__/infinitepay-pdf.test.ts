import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { isInfinitePayStatement, parseInfinitePayStatement } from "../infinitepay-pdf";
import { profileDocument } from "../profile";
import { parseStatement } from "../statement-parser";

/**
 * Relatório FICTÍCIO com a mesma estrutura do PDF da InfinitePay: resumo no topo, um cabeçalho
 * de tabela por dia, lançamento só com a hora, as datas dos blocos no pé da página, "Saldo do
 * dia", linha quebrada em duas, pagamento de fatura com "--R$" e o dia que continua na página 2.
 */
const AJUDA =
  "A Central de Ajuda está disponível todos os dias pelo chat no app, pelo e-mail ajuda@infinitepay.io ou de segunda a sexta das 09h às 17h, no 0800 000 0000";
const CABECALHO = "Data \tHora \tTipo de transação \tNome \tDetalhe \tValor (R$)";
const INFINITEPAY = [
  `Página 1 de 2\t${AJUDA}`,
  "Relatório de movimentações EMPRESA EXEMPLO LTDA - CNPJ: 00.000.000/0001-00",
  "CLOUDWALK - 0001 - 00000000-0",
  "01 Set, 2026 - 02 Set, 2026 \tValor em R$",
  "Saldo final do período",
  "R$ 100,00",
  "Saldo inicial \t+ 200,00",
  "Total de entradas \t+ 1.290,00",
  "Total de saídas \t- 1.390,00",
  "Saldo final do período \t+ 100,00",
  CABECALHO,
  "08:42 \tPix \tPix FULANA DE TAL \tRecebido \t+90,00",
  "10:04 \tPix \tPix LOJA MODELO LTDA \tEnviado \t-40,00",
  "Saldo do dia \t+ 250,00",
  CABECALHO,
  "00:09 \tDepósito de vendas \tVendas \tDepósito InfinitePay \t+1.000,00",
  "09:02 Fatura de cartão de",
  "crédito Fatura • Set 2026 \tPago \t--R$ 350,00",
  "01 Set, 2026",
  "02 Set, 2026",
  "",
  "-- 1 of 2 --",
  "",
  `Página 2 de 2\t${AJUDA}`,
  "Relatório de movimentações EMPRESA EXEMPLO LTDA - CNPJ: 00.000.000/0001-00",
  "CLOUDWALK - 0001 - 00000000-0",
  CABECALHO,
  "17:19 \tPix Pix CICLANA DE SOUZA E SILVA DE",
  "OLIVEIRA Recebido \t+200,00",
  "18:00 \tEmpréstimo Inteligente \tEmpréstimo Inteligente \tPagamento efetuado \t-1.000,00",
  "Saldo do dia \t+ 100,00",
  "02 Set, 2026",
  "",
  "-- 2 of 2 --",
].join("\n");

describe("relatório de movimentações da InfinitePay (PDF)", () => {
  it("reconhece o arquivo e o banco", () => {
    expect(isInfinitePayStatement(INFINITEPAY)).toBe(true);
    expect(isInfinitePayStatement("Extrato\n01/01/2026 PIX 10,00")).toBe(false);
    expect(profileDocument(INFINITEPAY).institution).toBe("InfinitePay");
  });

  it("põe cada lançamento na data do seu bloco, inclusive o dia que continua na outra página", () => {
    const txns = parseInfinitePayStatement(INFINITEPAY);
    expect(txns).toEqual([
      { date: "2026-09-01", description: "Pix FULANA DE TAL", amount: 90 },
      { date: "2026-09-01", description: "Pix LOJA MODELO LTDA", amount: -40 },
      { date: "2026-09-02", description: "Depósito de vendas Vendas · Depósito InfinitePay", amount: 1000 },
      { date: "2026-09-02", description: "Fatura de cartão de crédito Fatura • Set 2026 Pago", amount: -350 },
      { date: "2026-09-02", description: "Pix CICLANA DE SOUZA E SILVA DE OLIVEIRA", amount: 200 },
      { date: "2026-09-02", description: "Empréstimo Inteligente · Pagamento efetuado", amount: -1000 },
    ]);
  });

  it("fecha com o total de entradas e saídas do resumo", () => {
    const txns = parseStatement(INFINITEPAY, "pdf", 2026);
    expect(txns).toHaveLength(6);
    expect(conferirLeitura(INFINITEPAY, "extrato", txns).status).toBe("fechou");
  });

  it("bloco sem data no pé da página: não lê nada em vez de pôr no dia errado", () => {
    const semData = INFINITEPAY.replace("02 Set, 2026\n\n-- 2 of 2 --", "\n-- 2 of 2 --");
    expect(parseInfinitePayStatement(semData)).toEqual([]);
  });
});
