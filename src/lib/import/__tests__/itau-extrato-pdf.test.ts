import { describe, expect, it } from "vitest";
import { isItauStatement, parseItauStatement } from "../itau-extrato-pdf";
import { linhasPorPosicao, precisaRemontarPorPosicao, type PedacoDoPdf } from "../pdf-por-posicao";
import { parseStatementComLeitor } from "../statement-parser";

// Amostras FICTÍCIAS, nos dois jeitos do extrato da conta do Itaú que chegaram em 13/10/2026.

const internet = [
  "saldo em conta \tLimite da Conta utilizado \tLimite da Conta disponível \tLimite da Conta total*",
  "R$ 1.000,00 \tR$ 0,00 \tR$ 2.000,00 \tR$ 2.000,00",
  "extrato conta corrente",
  "lançamentos",
  "período de visualização: de 07/10/2026 até 13/10/2026 \temitido em: 13/10/2026 10:00:00",
  "data \tlançamentos \tvalor (R$) \tsaldo (R$)",
  "06/10/2026 SALDO ANTERIOR \t3.000,00",
  "07/10/2026 PAG BOLETO ESTACIONAMENTO EXEMPLO \t-280,00",
  "07/10/2026 PIX TRANSF Fulana07/10 \t-200,00",
  "07/10/2026 REND PAGO APLIC AUT MAIS \t0,01",
  "07/10/2026 SALDO TOTAL DISPONÍVEL DIA \t2.520,01",
  "09/10/2026 RESGATE COFRINHOS \t950,00",
  "13/10/2026 PAG BOLETO COMPANHIA DE GAS EXEMPLO",
  "GASEX -12,40",
  "posição consolidada",
  "descrição \tvalor",
  "(+) LIMITE DA CONTA TOTAL \t2.000,00",
  "(=) saldo total disponível \t1.000,00",
].join("\n");

describe("extrato da conta do Itaú (PDF)", () => {
  it("lê as linhas, junta a descrição que quebrou e para na posição consolidada", () => {
    expect(isItauStatement(internet)).toBe(true);
    const r = parseItauStatement(internet);
    expect(r.map((t) => [t.date, t.amount])).toEqual([
      ["2026-10-07", -280],
      ["2026-10-07", -200],
      ["2026-10-07", 0.01],
      ["2026-10-09", 950],
      ["2026-10-13", -12.4],
    ]);
    expect(r[4].description).toBe("PAG BOLETO COMPANHIA DE GAS EXEMPLO GASEX");
  });

  it("é o leitor que o app usa pra esse PDF", () => {
    const r = parseStatementComLeitor(internet, "pdf");
    expect(r.leitor).toBe("itau-extrato");
    expect(r.txns).toHaveLength(5);
  });
});

describe("extrato do app do Itaú, guardado por coluna", () => {
  // Como o texto normal sai: todas as datas, depois as descrições, depois os valores.
  const porColuna = [
    "extrato conta / lançamentos",
    "período de visualização: 13/09/2026 até 13/10/2026",
    "data",
    "13/10/2026",
    "13/10/2026",
    "13/10/2026",
    "09/10/2026",
    "09/10/2026",
    "09/10/2026PAY MERCADO 09/10",
    "lançamentos",
    "PAY PADARIA 11/10",
    "PIX TRANSF FULANA11/10",
    "SALDO DO DIA",
    "PAY FARMACIA 09/10",
    "SALDO DO DIA",
    "-16,00",
    "180,00",
    "4.343,41",
    "valor (R$)",
    "saldo (R$)",
  ].join("\n");

  it("percebe que precisa remontar pela posição", () => {
    expect(precisaRemontarPorPosicao(porColuna)).toBe(true);
    expect(precisaRemontarPorPosicao(internet)).toBe(false);
    // Outro banco com data sozinha na linha (de propósito): não mexe.
    expect(precisaRemontarPorPosicao(porColuna.replace("extrato conta / lançamentos", "Extrato"))).toBe(false);
  });

  it("remonta as linhas: o valor vai pra data mais próxima, acima ou abaixo", () => {
    // y cresce pra cima, como no PDF. Linhas a cada 18 pontos (36 depois de uma descrição que
    // quebrou); o valor fica até 11 pontos acima ou abaixo da data, como no arquivo real.
    const p = (str: string, x: number, y: number): PedacoDoPdf => ({ str, x, y });
    const pedacos: PedacoDoPdf[] = [
      p("data", 31, 606), p("lançamentos", 96, 606), p("valor (R$)", 415, 606), p("saldo (R$)", 516, 606),
      p("13/10/2026", 31, 582), p("13/10/2026", 31, 564), p("13/10/2026", 31, 546),
      p("09/10/2026", 31, 528), p("09/10/2026PAY MERCADO 09/10", 31, 510), p("09/10/2026", 31, 474),
      p("PAY PADARIA 11/10", 96, 582), p("PIX TRANSF FULANA11/10", 96, 564), p("SALDO DO DIA", 96, 546),
      p("PAY FARMACIA 09/10", 96, 528), p("REND PAGO APLIC AUT", 96, 474),
      p("-16,00", 427, 588.7), p("180,00", 425, 570.6), p("4.343,41", 523, 545),
      p("-6,90", 433, 522), p("-30,90", 427, 504), p("0,01", 437, 484.7),
    ];
    const linhas = linhasPorPosicao(pedacos);
    expect(linhas).toEqual([
      "data\tlançamentos\tvalor (R$)\tsaldo (R$)",
      "13/10/2026\tPAY PADARIA 11/10\t-16,00",
      "13/10/2026\tPIX TRANSF FULANA11/10\t180,00",
      "13/10/2026\tSALDO DO DIA\t4.343,41",
      "09/10/2026\tPAY FARMACIA 09/10\t-6,90",
      "09/10/2026\tPAY MERCADO 09/10\t-30,90",
      "09/10/2026\tREND PAGO APLIC AUT\t0,01",
    ]);
    const texto = ["extrato conta / lançamentos", ...linhas].join("\n");
    const r = parseStatementComLeitor(texto, "pdf");
    expect(r.leitor).toBe("itau-extrato");
    expect(r.txns.map((t) => t.amount)).toEqual([-16, 180, -6.9, -30.9, 0.01]);
  });
});
