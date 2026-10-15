import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { profileDocument } from "../profile";
import { isRecargaPayStatement, parseRecargaPayStatement } from "../recargapay-pdf";
import { parseStatementComLeitor } from "../statement-parser";

/**
 * Layout do extrato RecargaPay em PDF (texto como sai do leitor de PDF), com nomes, números de
 * ordem e valores inventados. O resumo do topo bate com as linhas que contam no saldo da carteira.
 */
const EXTRATO = [
  "FULANA DE TAL",
  "CPF: 000.000.000-00",
  "Se precisar de ajuda, acesse nossa Central de ajuda.",
  "Emitido por RecargaPay (08/10/2026 10:00:00).",
  "RECARGAPAY INSTITUIÇÃO DE PAGAMENTO LTDA., CNPJ sob n 00.000.000/0001-00",
  "Extrato",
  "Período: 01/09/2026 - 08/10/2026",
  "Saldo inicial: R$ 50,00 Entradas: R$ 1.070,00 Saídas: -R$ 1.035,00 Saldo final: R$ 85,00",
  "Detalhes dos movimentos",
  "Data ID da Ordem Movimentações Valor",
  "08/10/2026 #1000000001 Recebido - Pix com chave + R$ 70,00",
  "De Fulana de Tal",
  "BANCO EXEMPLO",
  "Agência: 1 - Conta: 0000000",
  "#1000000002 Rendimento CDI + R$ 0,03",
  "07/10/2026 #1000000003 Enviado - Pix com chave",
  "Para Loja Exemplo",
  "BANCO INTER",
  "Agência: 0001 - Conta: 0000000",
  "Pagamento com a carteira - R$ 35,00",
  "02/10/2026 #1000000004 Recebimento de cashback + R$ 1,00",
  "#1000000005 Pagamento de conta",
  "Pagamento com a carteira - R$ 1.000,00",
  "",
  "-- 1 of 2 --",
  "",
  "FULANA DE TAL",
  "Emitido por RecargaPay (08/10/2026 10:00:00).",
  "#1000000006 Recarga Celular",
  "Adição de saldo na carteira com cartão ****000 + R$ 20,00",
  "Pagamento com a carteira - R$ 20,00",
  "15/09/2026 #1000000007 Recebido - Pix + R$ 1.000,00",
  "De Empresa Exemplo",
].join("\n");

describe("extrato RecargaPay em PDF", () => {
  it("lê cada ordem com a data do dia, o sinal e quem está do outro lado", () => {
    expect(isRecargaPayStatement(EXTRATO)).toBe(true);
    expect(parseRecargaPayStatement(EXTRATO)).toEqual([
      { date: "2026-10-08", description: "Recebido - Pix com chave", amount: 70 },
      { date: "2026-10-07", description: "Enviado - Pix com chave · Loja Exemplo", amount: -35 },
      { date: "2026-10-02", description: "Pagamento de conta", amount: -1000 },
      { date: "2026-09-15", description: "Recebido - Pix", amount: 1000 },
    ]);
  });

  it("deixa de fora rendimento, cashback e a ordem paga com cartão, como o resumo do extrato, e fecha", () => {
    const { txns, leitor } = parseStatementComLeitor(EXTRATO, "pdf");
    expect(leitor).toBe("recargapay");
    expect(conferirLeitura(EXTRATO, "extrato", txns)).toEqual({ status: "fechou", lido: 2105, esperado: 2105 });
  });

  it("o banco é o RecargaPay, não o banco citado num Pix", () => {
    expect(profileDocument(EXTRATO, "extrato.pdf").institution).toBe("RecargaPay");
  });

  it("não reconhece extrato de outro banco", () => {
    expect(isRecargaPayStatement("Extrato\nDetalhes dos movimentos\n08/10/2026 Pix 10,00")).toBe(false);
  });
});
