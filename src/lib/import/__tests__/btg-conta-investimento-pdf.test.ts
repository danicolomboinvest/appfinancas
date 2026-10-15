import { describe, expect, it } from "vitest";
import { isBtgContaInvestimento, parseBtgContaInvestimento } from "../btg-conta-investimento-pdf";
import { parseStatementComLeitor } from "../statement-parser";

/**
 * Layout do "Extrato da Conta Investimento" (BTG/EQI) como sai do leitor de PDF, com a ligadura
 * "ta" perdida ("Cont", "Dat"). Conta, empresas e valores inventados.
 */
const EXTRATO = [
  "Extrato d",
  "Cont Investimento",
  "Informações detalhadas sobre",
  "investimentos",
  "FULANA DE TAL",
  "Período de 01/09/26  30/09/26",
  "",
  "-- 1 of 3 --",
  "",
  "Fundo de Investimento - Movimentação - FUNDO EXEMPLO RF",
  "Dat \tTransação \tQuantidade de Cotas \tValor d Cot R$ \tValor Bruto R$ \tIR R$ \tIOF R$ \tValor Líquido R$",
  "04/09/26 \tRESGATE REF. APLIC. 15/09/2025 \t7,01402900 \t5,67006481 \t39,77 \t0,46 \t- \t39,31",
  "04/09/26 \tRESGATE REF. APLIC. 08/05/2026 \t9,53428200 \t5,67006481 \t54,06 \t0,48 \t- \t53,58",
  "Total de",
  "Resgates 16,54830000 \t93,83 \t0,94 \t- \t92,89",
  "",
  "-- 2 of 3 --",
  "",
  "Extrato d Cont Investimento",
  "Cont corrente - Posição",
  "Dat \tValor nanceiro R$",
  "30/09/26 \t71,74",
  "Cont corrente - Movimentação",
  "Dat \tDescrição \tMovimentação R$ \tSaldo cont investimentos R$",
  "01/09/26 \tSaldo Anterior \t-",
  "04/09/26 \t000000000 - TAXA DE CONSULTORIA - 8/2026 - EMPRESA EXEMPLO LTDA \t-20,00 \t-20,00",
  "04/09/26 \tRESGATE DE COTAS NO FUNDO - FUNDO EXEMPLO RF \t92,89 \t72,89",
  "29/09/26 \tCASHBACK B2B - CRÉDITO - BANCO EXEMPLO \t1,00 \t73,89",
  "30/09/26 \tTED ENVIADA - FULANA DE TAL \t-2,15 \t71,74",
  "30/09/26 \tSaldo Final + Rendimento Provisionado de Saldo Remunerado \t- \t71,74",
  "Total de",
  "Créditos 93,89",
].join("\n");

describe("extrato da Conta Investimento do BTG/EQI", () => {
  it("lê só a conta corrente, com a data do lançamento, e não as linhas dos fundos", () => {
    expect(isBtgContaInvestimento(EXTRATO)).toBe(true);
    expect(parseBtgContaInvestimento(EXTRATO)).toEqual([
      { date: "2026-09-04", description: "TAXA DE CONSULTORIA - 8/2026 - EMPRESA EXEMPLO LTDA", amount: -20 },
      { date: "2026-09-04", description: "RESGATE DE COTAS NO FUNDO - FUNDO EXEMPLO RF", amount: 92.89 },
      { date: "2026-09-29", description: "CASHBACK B2B - CRÉDITO - BANCO EXEMPLO", amount: 1 },
      { date: "2026-09-30", description: "TED ENVIADA - FULANA DE TAL", amount: -2.15 },
    ]);
    expect(parseStatementComLeitor(EXTRATO, "pdf").leitor).toBe("btg-conta-investimento");
  });

  it("um saldo que não fecha com o lançamento faz o leitor desistir, em vez de gravar valor errado", () => {
    const torto = EXTRATO.replace("\t92,89 \t72,89", "\t92,89 \t82,89");
    expect(parseBtgContaInvestimento(torto)).toEqual([]);
  });
});
