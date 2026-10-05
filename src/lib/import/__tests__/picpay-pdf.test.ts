import { describe, expect, it } from "vitest";
import { isPicPayStatement, parsePicPayStatement } from "../picpay-pdf";
import { parseStatementComLeitor } from "../statement-parser";

// Amostra fictícia no formato do extrato PicPay (nomes e valores inventados).
const AMOSTRA = [
  "Período Saldo final do período",
  "Extrato de conta",
  "4 de agosto de 2026 a",
  "2 de outubro de 2026",
  "R$ 0,22",
  "Maria Exemplo da Silva",
  "CPF: 000.000.000-00 Agência: 0001 Conta: 00000000-0",
  "01 de outubro 2026 Saldo ao final do dia: R$ 0,22",
  "Hora Tipo Valor\tOrigem / Destino Forma de pagamento",
  "09:29 Pagamento realizado −R$ 6,90\tSeguro Fatura Protegida Com cartão",
  "25 de setembro 2026 Saldo ao final do dia: R$ 0,22",
  "Hora Tipo Valor\tOrigem / Destino Forma de pagamento",
  "21:36 Pix enviado −R$ 1.756,34\tMARIA EXEMPLO DA SILVA Com cartão",
  "17:39 Pix enviado −R$ 19,16",
  "\tJoana Exemplo Dos",
  "Santos Teste Com cartão",
  "Documento emitido em: PicPay Serviços S/A",
  "1 de 2\tCNPJ: 00.000.000/0001-00",
  "-- 1 of 2 --",
  "Maria Exemplo da Silva",
  "CPF: 000.000.000-00 Agência: 0001 Conta: 00000000-0",
  "10 de setembro 2026 Saldo ao final do dia: R$ 131,22",
  "Hora Tipo Valor\tOrigem / Destino Forma de pagamento",
  "10:55 Pix recebido +R$ 131,22",
  "\tPEDRO EXEMPLO",
  "05 de setembro 2026 Saldo ao final do dia: R$ 0,00",
  "08:00 Troco guardado −R$ 0,13\tNubank",
].join("\n");

describe("extrato PicPay em PDF", () => {
  it("reconhece e lê todos os lançamentos, com sinal e data corretos", () => {
    expect(isPicPayStatement(AMOSTRA + "\nPicPay")).toBe(true);
    const txns = parsePicPayStatement(AMOSTRA + "\nPicPay");
    expect(txns.map((t) => [t.date, t.amount])).toEqual([
      ["2026-10-01", -6.9],
      ["2026-09-25", -1756.34],
      ["2026-09-25", -19.16],
      ["2026-09-10", 131.22],
      ["2026-09-05", -0.13],
    ]);
  });

  it("junta o nome quebrado em duas linhas e não puxa o rodapé da página", () => {
    const txns = parsePicPayStatement(AMOSTRA + "\nPicPay");
    expect(txns[2].description).toBe("Pix enviado Joana Exemplo Dos Santos Teste");
    expect(txns[2].description).not.toMatch(/Documento|CNPJ|CPF/);
    expect(txns[3].description).toBe("Pix recebido PEDRO EXEMPLO");
  });

  it("entra no leitor geral pelo nome do banco", () => {
    expect(parseStatementComLeitor(AMOSTRA + "\nPicPay", "pdf", 2026).leitor).toBe("picpay");
  });
});
