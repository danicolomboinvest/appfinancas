import { describe, expect, it } from "vitest";
import { parseStatement } from "../statement-parser";

describe("CSV com a descrição entre aspas quebrada em duas linhas", () => {
  // Mesmo formato de um extrato real (20/10/2026): o banco quebra a descrição da compra no
  // cartão em duas linhas dentro das aspas. O app lia 1 de 40 lançamentos. Valores inventados.
  const csv = [
    "﻿Extrato de conta corrente",
    "Nome;FULANA EXEMPLO",
    "Agência;0001",
    "Conta;12.345678.9",
    "Período do extrato;01/09/2026 a 30/09/2026",
    "",
    "Lançamentos:",
    "Data;Descrição;Valor;Saldo",
    '01/09/2026;"Compra cartao final 1234',
    '31/08 PADARIA EXEMPLO .SAO PAULO BR";-12,50;987,50',
    '02/09/2026;"Compra cartao final 1234',
    '01/09 MERCADO TESTE .SAO PAULO";-80,35;907,15',
    '03/09/2026;"Pix recebido de EMPRESA TESTE";1500,00;2407,15',
    '04/09/2026;"Compra cartao final 1234',
    '03/09 FARMACIA DO BAIRRO";-7,90;2399,25',
  ].join("\n");

  it("lê todos os lançamentos, com centavos e a descrição inteira", () => {
    const txns = parseStatement(csv);
    expect(txns).toHaveLength(4);
    expect(txns.map((t) => t.amount)).toEqual([-12.5, -80.35, 1500, -7.9]);
    expect(txns[0].date).toBe("2026-09-01");
    expect(txns[0].description).toContain("PADARIA EXEMPLO");
  });

  it("aspas que nunca fecham não engolem o resto do arquivo", () => {
    const quebrado = [
      "Data;Descrição;Valor",
      '01/09/2026;TV 50" SALA;-1200,00',
      "02/09/2026;MERCADO;-50,00",
      "03/09/2026;PADARIA;-10,00",
      "04/09/2026;FARMACIA;-20,00",
    ].join("\n");
    const datas = parseStatement(quebrado).map((t) => t.date);
    expect(datas).toEqual(expect.arrayContaining(["2026-09-02", "2026-09-03", "2026-09-04"]));
  });
});
