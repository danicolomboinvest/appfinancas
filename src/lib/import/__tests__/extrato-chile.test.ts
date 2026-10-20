import { describe, expect, it } from "vitest";
import { parseStatement } from "../statement-parser";
import { formatMoney } from "@/lib/money";
import { centavosDoTexto } from "@/lib/dinheiro/digitado";
import { centavosDoCampo, teclar } from "@/lib/entries/digitar";

/**
 * Peso chileno (20/10/2026, pedido dela): não tem centavo ("12.500" são doze mil e quinhentos
 * pesos), o ponto é o separador de milhar e os bancos dizem "Cargos" e "Abonos". Amostras
 * FICTÍCIAS no desenho dos bancos do Chile; falta conferir com um extrato real.
 */
describe("extrato em peso chileno", () => {
  it("planilha com colunas Cargos e Abonos: cargo é saída, abono é entrada", () => {
    const csv = [
      "Cartola de cuenta corriente",
      "Fecha;Descripción;Canal o Sucursal;Cargos (CLP);Abonos (CLP);Saldo (CLP)",
      "02/10/2026;COMPRA NACIONAL LIDER EXPRESS;Internet;12.500;;345.200",
      "03/10/2026;TRASPASO DE FULANO;Internet;;150.000;495.200",
      "05/10/2026;PAGO SERVIPAG LUZ;Internet;38.990;;456.210",
    ].join("\n");
    const t = parseStatement(csv, "auto", 2026);
    expect(t.map((x) => x.amount)).toEqual([-12500, 150000, -38990]);
    expect(t[0].date).toBe("2026-10-02");
  });

  it("planilha com uma coluna de Monto com sinal", () => {
    const csv = ["Fecha,Glosa,Monto,Saldo", "02/10/2026,COMPRA FARMACIA,-9990,100000", "03/10/2026,ABONO SUELDO,850000,950000"].join("\n");
    expect(parseStatement(csv, "auto", 2026).map((x) => x.amount)).toEqual([-9990, 850000]);
  });

  it("PDF em texto, sem centavos: o saldo depois de cada linha diz quem é entrada e quem é saída", () => {
    const pdf = [
      "Cartola 01/10/2026 al 31/10/2026",
      "Saldo inicial $ 357.700",
      "Fecha Descripción Canal Cargos Abonos Saldo",
      "02/10 COMPRA NACIONAL LIDER EXPRESS Internet 12.500 345.200",
      "03/10 TRASPASO DE FULANO Internet 150.000 495.200",
      "05/10 PAGO SERVIPAG LUZ Internet 38.990 456.210",
      "Saldo final $ 456.210",
    ].join("\n");
    const t = parseStatement(pdf, "pdf", 2026);
    expect(t.map((x) => x.amount)).toEqual([-12500, 150000, -38990]);
    expect(t.map((x) => x.date)).toEqual(["2026-10-02", "2026-10-03", "2026-10-05"]);
  });

  it("saldo que não fecha: não lê nada (melhor nada do que dinheiro errado)", () => {
    const pdf = ["Saldo inicial $ 357.700", "02/10 COMPRA LIDER Internet 12.500 345.200", "03/10 TRASPASO Internet 150.000 999.999"].join("\n");
    expect(parseStatement(pdf, "pdf", 2026)).toEqual([]);
  });

  it("o extrato em real continua igual", () => {
    const pdf = ["Saldo anterior 1.000,00", "02/10 PIX ENVIADO 100,00 900,00", "03/10 PIX RECEBIDO 50,00 950,00"].join("\n");
    expect(parseStatement(pdf, "pdf", 2026).map((x) => x.amount)).toEqual([-100, 50]);
  });
});

describe("peso chileno na tela", () => {
  it("sem centavos, com o símbolo da moeda do Intl", () => {
    expect(formatMoney(12500, "CLP")).toMatch(/12\.500$/);
    expect(formatMoney(12500, "CLP")).not.toMatch(/,/);
    expect(formatMoney(12500, "CLP", { bare: true })).toBe("12.500");
    expect(formatMoney(12500, "BRL", { bare: true })).toBe("12.500,00");
  });
});

describe("digitar valor em peso chileno (sem centavos)", () => {
  it("o teclado entra em pesos inteiros: 1, 2, 5, 0, 0 é 12.500, não 125,00", () => {
    let c = 0;
    for (const k of ["1", "2", "5", "0", "0"]) c = teclar(c, k, true);
    expect(c / 100).toBe(12500);
    expect(teclar(c, "del", true) / 100).toBe(1250);
    // O mesmo teclado em real continua na maquininha.
    let r = 0;
    for (const k of ["1", "2", "5", "0", "0"]) r = teclar(r, k);
    expect(r / 100).toBe(125);
  });
  it("a tecla 00 e o campo do celular também contam pesos inteiros", () => {
    expect(teclar(teclar(0, "5", true), "00", true) / 100).toBe(500);
    expect(centavosDoCampo("8000", true)! / 100).toBe(8000);
    expect(centavosDoCampo("8000")! / 100).toBe(80);
  });
  it("o campo de valor lê os dígitos como pesos", () => {
    expect(centavosDoTexto("CLP 12.500", true)! / 100).toBe(12500);
    expect(centavosDoTexto("12.500,00")! / 100).toBe(12500);
  });
});
