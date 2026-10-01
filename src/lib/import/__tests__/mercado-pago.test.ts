import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { pareceAplicacao, pareceResgate } from "../dinheiro-proprio";
import { isMercadoPagoStatement, parseMercadoPagoStatement } from "../mercado-pago-pdf";
import { normalizeDate, parseStatement, parseStatementComLeitor } from "../statement-parser";

/**
 * Extrato FICTÍCIO com a mesma estrutura do PDF da conta Mercado Pago: data com hífen, descrição
 * quebrada em várias linhas, ID da operação, valor com sinal e o saldo no fim de cada lançamento.
 */
const MP = [
  "1/2",
  "EXTRATO DE CONTA",
  "Pessoa Exemplo",
  "De 01-08-2026 al 31-08-2026\tPeriodo:",
  "Saldo inicial: R$ 0,08 Entradas: R$ 600,10",
  "Saidas: R$ -558,48",
  "DETALHE DOS MOVIMENTOS",
  "Data Descrição ID da operação Valor Saldo",
  "02-08-2026 Dinheiro retirado Reserva",
  "Viagem 170862863469 R$ 100,00 R$ 100,08",
  "02-08-2026",
  "Pagamento com QR Pix",
  "RESTAURANTE EXEMPLO",
  "LTDA",
  "171758506078 R$ -58,48 R$ 41,60",
  "03-08-2026 Rendimentos 1749239933489 R$ 0,10 R$ 41,70",
  "Saldo final: R$ 41,70",
  "-- 1 of 2 --",
  "2/2",
  "Data Descrição ID da operação Valor Saldo",
  "04-08-2026 Pix recebido PESSOA DOIS 176009734329 R$ 500,00 R$ 541,70",
  "05-08-2026 Dinheiro reservado Reserva Viagem 172196292432 R$ -500,00 R$ 41,70",
].join("\n");

describe("extrato Mercado Pago (PDF)", () => {
  it("reconhece o arquivo", () => {
    expect(isMercadoPagoStatement(MP)).toBe(true);
    expect(isMercadoPagoStatement("Extrato de Conta Corrente\n01/01/2026 PIX 10,00")).toBe(false);
  });

  it("junta a descrição quebrada, usa o valor (não o saldo) e lê a data com hífen", () => {
    expect(parseMercadoPagoStatement(MP)).toEqual([
      { date: "2026-08-02", description: "Dinheiro retirado Reserva Viagem", amount: 100 },
      { date: "2026-08-02", description: "Pagamento com QR Pix RESTAURANTE EXEMPLO LTDA", amount: -58.48 },
      { date: "2026-08-03", description: "Rendimentos", amount: 0.1 },
      { date: "2026-08-04", description: "Pix recebido PESSOA DOIS", amount: 500 },
      { date: "2026-08-05", description: "Dinheiro reservado Reserva Viagem", amount: -500 },
    ]);
  });

  it("fecha com as Entradas e Saídas impressas no topo", () => {
    const { txns, leitor } = parseStatementComLeitor(MP, "pdf");
    expect(leitor).toBe("mercado-pago");
    expect(conferirLeitura(MP, "extrato", txns).status).toBe("fechou");
  });

  it("caixinha do Mercado Pago: 'Dinheiro reservado' é guardar, 'Dinheiro retirado' é resgate", () => {
    expect(pareceAplicacao("Dinheiro reservado Reserva Viagem")).toBe(true);
    expect(pareceResgate("Dinheiro retirado Reserva Viagem")).toBe(true);
    expect(pareceResgate("Dinheiro reservado Reserva Viagem")).toBe(false);
  });
});

describe("extrato Mercado Pago (CSV) e datas com hífen", () => {
  it("a data com hífen é entendida: o extrato de agosto fica em agosto", () => {
    expect(normalizeDate("02-08-2026")).toBe("2026-08-02");
    expect(normalizeDate("02.08.2026")).toBe("2026-08-02");
    expect(normalizeDate("2026-08-02")).toBe("2026-08-02");
    const csv = [
      "data;descricao;id_operacao;tipo;entrada;saida;saldo",
      "02-08-2026;Dinheiro retirado Reserva;170862863469;Entrada;85,69;-0,0;85,77",
      "02-08-2026;Pagamento com QR Pix LOJA EXEMPLO;171758506078;Saída;0,0;58,48;27,29",
    ].join("\n");
    expect(parseStatement(csv).map((t) => [t.date, t.amount])).toEqual([
      ["2026-08-02", 85.69],
      ["2026-08-02", -58.48],
    ]);
  });
});
