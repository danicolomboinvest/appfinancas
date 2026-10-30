import { describe, expect, it } from "vitest";
import { lerExtratoPeloSaldo } from "../extrato-pelo-saldo";
import { parseStatementComLeitor } from "../statement-parser";

// Extratos FICTÍCIOS de um "banco novo", sem leitor próprio.

describe("extrato lido pela conta do saldo", () => {
  it("mais novo primeiro, data e hora em linhas separadas, valores sem sinal: o sinal sai do saldo", () => {
    const texto = [
      "Banco Exemplo | Extrato",
      "Data Descrição Valor Saldo",
      "05/10/26 às",
      "07:01:00",
      "Transferência enviada para investimento R$ 600,00 R$ 0,00",
      "03/10/26 às",
      "10:29:07",
      "Pagamento de boleto R$ 381,10 R$ 600,00",
      "01/10/26 às",
      "09:00:00",
      "Pix recebido de Fulana R$ 981,10 R$ 981,10",
    ].join("\n");
    expect(lerExtratoPeloSaldo(texto)).toEqual([
      { date: "2026-10-05", description: "Transferência enviada para investimento", amount: -600 },
      { date: "2026-10-03", description: "Pagamento de boleto", amount: -381.1 },
      { date: "2026-10-01", description: "Pix recebido de Fulana", amount: 981.1 },
    ]);
  });

  it("mais antigo primeiro, nome em duas linhas, data por extenso e o saldo anterior dando o sinal do primeiro", () => {
    const texto = [
      "Saldo anterior 1.000,00",
      "10 de Setembro de 2026",
      "Compra no débito Mercado",
      "Exemplo 150,00 850,00",
      "11 de Setembro de 2026",
      "Pix recebido Fulano 50,00 900,00",
      "Tarifa 10,00 890,00",
    ].join("\n");
    expect(lerExtratoPeloSaldo(texto)).toEqual([
      { date: "2026-09-10", description: "Compra no débito Mercado Exemplo", amount: -150 },
      { date: "2026-09-11", description: "Pix recebido Fulano", amount: 50 },
      { date: "2026-09-11", description: "Tarifa", amount: -10 },
    ]);
  });

  it("um degrau que não fecha no centavo e não lê nada (melhor nada que dinheiro errado)", () => {
    const texto = ["Saldo anterior 1.000,00", "10/09/2026 Compra 150,00 850,00", "11/09/2026 Pix 50,00 901,00", "12/09/2026 Tarifa 10,00 891,00"].join("\n");
    expect(lerExtratoPeloSaldo(texto)).toBeNull();
  });

  it("sem como saber o sinal do primeiro lançamento, não chuta", () => {
    const texto = ["10/09/2026 Compra 150,00 850,00", "11/09/2026 Pix 50,00 900,00"].join("\n");
    expect(lerExtratoPeloSaldo(texto)).toBeNull();
  });

  it("sinal impresso que contradiz o saldo: não é extrato com saldo, desiste", () => {
    const texto = ["Saldo anterior 1.000,00", "10/09/2026 Compra -150,00 1.150,00", "11/09/2026 Pix 50,00 1.200,00"].join("\n");
    expect(lerExtratoPeloSaldo(texto)).toBeNull();
  });

  it("fatura com valor em dólar e em real no fim da linha não vira extrato", () => {
    const texto = ["Fatura Exemplo", "10/09 Loja Exterior 10,00 52,70", "11/09 Outra Loja 20,00 105,40", "Total da fatura R$ 158,10"].join("\n");
    expect(lerExtratoPeloSaldo(texto)).toBeNull();
  });

  it("é usado no PDF quando nenhum leitor de banco reconhece o arquivo", () => {
    const texto = ["Banco Exemplo", "Saldo anterior 100,00", "10/09/2026 Pix recebido 50,00 150,00", "11/09/2026 Compra 30,00 120,00"].join("\n");
    expect(parseStatementComLeitor(texto, "pdf")).toEqual({
      leitor: "pelo-saldo",
      txns: [
        { date: "2026-09-10", description: "Pix recebido", amount: 50 },
        { date: "2026-09-11", description: "Compra", amount: -30 },
      ],
    });
  });
});

describe("extrato espanhol com € colado no número (colunas Importe e Saldo)", () => {
  it("lê o Importe, não o Saldo, e o sinal sai da conta: salário entra, gasto sai", () => {
    // FICTÍCIO, mais novo primeiro.
    const texto = [
      "IBAN: ES0000000000000000000000 \tSaldo disponible: 900,00€",
      "Periodo: 01/10/2026 - 30/10/2026",
      "Concepto \tFecha \tImporte \tSaldo",
      "CAFE EXEMPLO \t30/10/2026 \t-5,00€ \t900,00€",
      "NOMINA (TRF) \t29/10/2026 \t1.500,00€ \t905,00€",
      "BIZUM RECIBIDO \t20/10/2026 \t20,00€ \t-595,00€",
      "SUPERMERCADO X \t10/10/2026 \t-35,50€ \t-615,00€",
      "BIZUM ENVIADO \t02/10/2026 \t-100,00€ \t-579,50€",
    ].join("\n");
    const { txns, leitor } = parseStatementComLeitor(texto, "pdf");
    expect(leitor).toBe("pelo-saldo");
    expect(txns.map((t) => t.amount)).toEqual([-5, 1500, 20, -35.5, -100]);
  });
});
