import { describe, expect, it } from "vitest";
import { isExtratoDeAppPdf, parseExtratoDeAppPdf } from "../extrato-de-app-pdf";
import { profileDocument } from "../profile";
import { parseStatementComLeitor } from "../statement-parser";

/** Layout do "Extrato de transações" exportado por outro app de finanças; valores inventados. */
const EXTRATO = [
  "Saldo no dia 30/09/26 R$ 1.000,00",
  "01/10/2026, Quinta-feira",
  "Unha (4 / 4) Salão de Belez Pessoal -45,00",
  "Saldo do dia R$ 955,00",
  "07/10/2026, Quarta-feira",
  "Colar + Anel Sem Categoria Pessoal -120,00",
  "Adiantamento Sem Categoria Pessoal +3.000,00",
  "Saldo do dia R$ 3.835,00",
  "25/10/2026, Domingo",
  "Seguro celular (9 / 12) Celular Pessoal -19,90",
  "Lentes de contato (10 / 10) Sem Categoria Pessoal -80,00",
  "21 de Outubro de 2026",
  "Extrato de transações De 01/10/26 até 31/10/26",
  "Página 1",
  "",
  "-- 1 of 2 --",
  "",
  "Cinema Cinema/Teatro Pessoal -60,00",
  "Academia (1 / 5) Academia Pessoal -110,00",
  "Saldo do dia R$ 3.565,10",
  "21 de Outubro de 2026",
  "Extrato de transações De 01/10/26 até 31/10/26",
  "Página 2",
  "",
  "-- 2 of 2 --",
].join("\n");

describe("extrato de transações exportado por outro app de finanças", () => {
  it("lê todo lançamento do dia, não só o primeiro, e passa pela quebra de página", () => {
    expect(isExtratoDeAppPdf(EXTRATO)).toBe(true);
    const txns = parseExtratoDeAppPdf(EXTRATO);
    expect(txns.map((t) => [t.date, t.amount])).toEqual([
      ["2026-10-01", -45],
      ["2026-10-07", -120],
      ["2026-10-07", 3000],
      ["2026-10-25", -19.9],
      ["2026-10-25", -80],
      ["2026-10-25", -60],
      ["2026-10-25", -110],
    ]);
    // O saldo de cada dia fecha com o que foi lido.
    expect(1000 + txns.reduce((s, t) => s + t.amount, 0)).toBeCloseTo(3565.1, 2);
  });

  it("tira da descrição o \"Sem Categoria\" e o nome da conta do outro app", () => {
    const desc = parseExtratoDeAppPdf(EXTRATO).map((t) => t.description);
    expect(desc).toEqual([
      "Unha (4 / 4) Salão de Belez",
      "Colar + Anel",
      "Adiantamento",
      "Seguro celular (9 / 12) Celular",
      "Lentes de contato (10 / 10)",
      "Cinema Cinema/Teatro",
      "Academia (1 / 5) Academia",
    ]);
  });

  it("é o leitor usado no PDF e o arquivo é tratado como extrato", () => {
    const { txns, leitor } = parseStatementComLeitor(EXTRATO, "pdf");
    expect(leitor).toBe("extrato-de-app");
    expect(txns).toHaveLength(7);
    expect(profileDocument(EXTRATO, null).kind).toBe("statement");
  });

  it("não pega extrato de banco que só fala em \"saldo do dia\"", () => {
    expect(isExtratoDeAppPdf("Extrato\n01/10/2026 Pix recebido 100,00\nSaldo do dia R$ 100,00")).toBe(false);
  });
});
