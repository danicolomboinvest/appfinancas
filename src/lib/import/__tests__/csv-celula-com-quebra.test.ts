import { describe, expect, it } from "vitest";
import { parseStatement } from "../statement-parser";

const CSV = [
  "Extrato de conta corrente",
  "Nome;Fulana",
  "Período do extrato;06/10/2026 a 20/10/2026",
  "",
  "Lançamentos:",
  "Data;Descrição;Valor;Saldo",
  '19/10/2026;"Compra cartao deb mc',
  '19/10 padaria exemplo";-18,84;1477,24',
  '16/10/2026;"Pix recebido',
  'Fulana de tal";1265,00;1726,50',
  "13/10/2026;Resgate cdb/rdb;2100,00;2192,90",
].join("\n");

describe("CSV com quebra de linha dentro das aspas", () => {
  it("lê todos os lançamentos, não só o da linha inteira", () => {
    const txns = parseStatement(CSV, "auto", 2026);
    expect(txns).toHaveLength(3);
    expect(txns.map((t) => Math.abs(t.amount)).sort((a, b) => a - b)).toEqual([18.84, 1265, 2100]);
    expect(txns.find((t) => Math.abs(t.amount) === 18.84)?.amount).toBeLessThan(0);
  });
});
