import { describe, expect, it } from "vitest";
import { isBanestesStatement, parseBanestesStatement } from "../banestes-pdf";
import { parseStatement } from "../statement-parser";

/**
 * Extrato FICTÍCIO com a mesma estrutura do que o Internet Banking do Banestes imprime em PDF:
 * dia e mês em duas linhas soltas, lançamentos sem data, linhas de saldo no meio, o ícone de
 * seta virando um caractere invisível numa linha "vazia", descrição quebrada com o valor sozinho
 * embaixo e os lançamentos previstos no fim.
 */
const ICONE = "";
const BANESTES = [
  "SALDO TOTAL",
  "R$ 100,00",
  "ENTRADAS E SAÍDAS",
  " R$ 3.050,00",
  " R$ 1.260,00",
  "CLIENTE: PESSOA DE EXEMPLO",
  "PERÍODO: 18/09/2026 À 24/09/2026",
  "DATA LANÇAMENTO \tVALOR (R$)",
  "18",
  "SET",
  "SALDO ANTERIOR \t-50,00",
  " PIX RECEBIDO 18/09/2026-16:59:09 \tLOJA MODELO \t50,00",
  ICONE,
  " LÍQUIDO DE VENCIMENTOS \t3.000,00",
  " PIX ENVIADO 18/09/2026-23:16:31 \tPADARIA FICTICIA \t-20,00",
  ICONE,
  "SALDO CONTA/RENDE+ \t2.980,00",
  "21",
  "SET",
  " DÉB AUTOMÁTICO CARTAO EXEMPLO \t-1.000,00",
  "SALDO CONTA/RENDE+ \t1.980,00",
  "LANÇAMENTOS PREVISTOS",
  " PIX ENVIADO 24/09/2026 11:14:04 \tFULANA DE TAL DA",
  "SILVA",
  "-240,00",
  "24/09/2026, 18:54 \tBanestes Internet Banking",
  "https://banco.exemplo/extrato \t1/2",
  "-- 1 of 2 --",
  "SALDOS",
  "SALDO CONTA/RENDE+ \t1.740,00",
  "CDB \t5.000,00",
].join("\n");

describe("extrato do Banestes (PDF do Internet Banking)", () => {
  it("reconhece o arquivo", () => {
    expect(isBanestesStatement(BANESTES)).toBe(true);
    expect(isBanestesStatement("Extrato de Conta Corrente\n01/01/2026 PIX 10,00")).toBe(false);
  });

  it("lê as linhas sem data, pula saldos e usa a data do próprio lançamento previsto", () => {
    expect(parseBanestesStatement(BANESTES)).toEqual([
      { date: "2026-09-18", description: "PIX RECEBIDO 18/09/2026-16:59:09 LOJA MODELO", amount: 50 },
      { date: "2026-09-18", description: "LÍQUIDO DE VENCIMENTOS", amount: 3000 },
      { date: "2026-09-18", description: "PIX ENVIADO 18/09/2026-23:16:31 PADARIA FICTICIA", amount: -20 },
      { date: "2026-09-21", description: "DÉB AUTOMÁTICO CARTAO EXEMPLO", amount: -1000 },
      { date: "2026-09-24", description: "PIX ENVIADO 24/09/2026 11:14:04 FULANA DE TAL DA SILVA", amount: -240 },
    ]);
  });

  it("fecha com as entradas e saídas do cabeçalho", () => {
    const txns = parseStatement(BANESTES, "pdf", 2026);
    expect(txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)).toBeCloseTo(3050, 2);
    expect(txns.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0)).toBeCloseTo(1260, 2);
  });
});
