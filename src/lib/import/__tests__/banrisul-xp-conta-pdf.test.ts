import { describe, expect, it } from "vitest";
import { isBanrisulStatement, parseBanrisulStatement } from "../banrisul-pdf";
import { isXpContaDigitalStatement, parseXpContaDigitalStatement } from "../xp-conta-pdf";
import { parseStatementComLeitor } from "../statement-parser";
import { profileDocument } from "../profile";

/**
 * Extrato FICTÍCIO com a mesma estrutura do PDF de conta corrente do Banrisul: dia só no primeiro
 * lançamento do dia, sinal "-" depois do número, "NOME:" embaixo do Pix, saldos no meio e
 * movimentos futuros (agendados) no fim.
 */
const BANRISUL = [
  "B A N R I S U L",
  "AGENCIA: 0001",
  "NOME...: PESSOA DE EXEMPLO",
  "-------- PARA SIMPLES CONFERENCIA --------",
  "SALDO DEVEDOR..............R$ 10,00-",
  "DIA HISTORICO DOCUMENTO V A L O R",
  "---------- MOVIMENTOS DA CONTA CORRENTE ----------",
  "SALDO ANT EM 31/08/2026 1.000,00",
  "++ MOVIMENTOS SET/2026",
  "01 REND CDB AUT 0000RC 0,05",
  "IOF ADICIONAL 000000 0,02-",
  "SALDO NA DATA 1.000,03",
  "05 PGTO CARTAO CRED 100003 800,00-",
  "SALDO NA DATA 200,03",
  "",
  "-- 1 of 2 --",
  "",
  "10 PIX RECEBIDO AB12CD 33,00",
  "NOME: FULANA DE TESTE",
  "28 CRED FOLHA PGTO 514185 3.500,00",
  "PIX 030037 1.200,00-",
  "NOME: LOJA FICTICIA S.A.",
  "SALDO NA DATA 2.533,03",
  "------ MOVIMENTOS FUTUROS DA CONTA CORRENTE ------",
  "++ MOVIMENTOS OUT/2026",
  "08 PGTO CONSORCIO 150049 400,00-",
  "----- EXTRATO EMITIDO AS 08:09 DE 02/10/2026 -----",
].join("\n");

/** Extrato FICTÍCIO da Conta Digital XP: ano com dois dígitos, "às" + hora, e a descrição longa
 * que quebra com o valor descendo pra linha de baixo. */
const XP = [
  "01/10/2026 17:42:10 Conta Digital XP | Extrato",
  "Conta Digital Extrato",
  "PESSOA DE EXEMPLO Banco XP S.A | Agência: 0001 | Conta: 123",
  "Saldo disponível no final do período filtrado: R$ 110,00",
  "Data Descrição Valor Saldo",
  "30/09/26 às 16:25:48 Pagamento para BANCO C6 S.A. -R$ 1.000,00 R$ 110,00",
  "29/09/26 às 08:31:22 Pix recebido de Pessoa de Exemplo R$ 1.050,00 R$ 1.110,00",
  "20/09/26 às 17:56:26 Pix enviado para Empresa Ficticia de Pagamento e Servicos de",
  "Pagamentos Ltda",
  "-R$ 40,00 R$ 60,00",
  "",
  "-- 1 of 2 --",
  "",
  "Data Descrição Valor Saldo",
  "03/08/26 às 08:31:26 Transferência recebida da conta investimento R$ 100,00 R$ 100,00",
  "Extrato simples para conferência, sujeito a atualizações.",
].join("\n");

describe("extrato Banrisul em PDF", () => {
  it("reconhece e lê cada lançamento com dia, sinal e quem mandou", () => {
    expect(isBanrisulStatement(BANRISUL)).toBe(true);
    const txns = parseBanrisulStatement(BANRISUL);
    expect(txns).toEqual([
      { date: "2026-09-01", description: "REND CDB AUT", amount: 0.05 },
      { date: "2026-09-01", description: "IOF ADICIONAL", amount: -0.02 },
      { date: "2026-09-05", description: "PGTO CARTAO CRED", amount: -800 },
      { date: "2026-09-10", description: "PIX RECEBIDO FULANA DE TESTE", amount: 33 },
      { date: "2026-09-28", description: "CRED FOLHA PGTO", amount: 3500 },
      { date: "2026-09-28", description: "PIX LOJA FICTICIA S.A.", amount: -1200 },
    ]);
  });

  it("fecha com o saldo: anterior + movimentos = saldo final, sem os agendados", () => {
    const soma = parseBanrisulStatement(BANRISUL).reduce((s, t) => s + t.amount, 0);
    expect(Math.round((1000 + soma) * 100) / 100).toBe(2533.03);
  });

  it("passa pelo leitor próprio e o banco aparece como Banrisul", () => {
    expect(parseStatementComLeitor(BANRISUL, "pdf", 2026).leitor).toBe("banrisul");
    expect(profileDocument(BANRISUL).institution).toBe("Banrisul");
  });
});

describe("extrato da Conta Digital XP em PDF", () => {
  it("lê data de dois dígitos, sinal e descrição quebrada", () => {
    expect(isXpContaDigitalStatement(XP)).toBe(true);
    expect(parseXpContaDigitalStatement(XP)).toEqual([
      { date: "2026-09-30", description: "Pagamento para BANCO C6 S.A.", amount: -1000 },
      { date: "2026-09-29", description: "Pix recebido de Pessoa de Exemplo", amount: 1050 },
      { date: "2026-09-20", description: "Pix enviado para Empresa Ficticia de Pagamento e Servicos de Pagamentos Ltda", amount: -40 },
      { date: "2026-08-03", description: "Transferência recebida da conta investimento", amount: 100 },
    ]);
  });

  it("passa pelo leitor próprio e o banco é XP, não o C6 que aparece num pagamento", () => {
    expect(parseStatementComLeitor(XP, "pdf", 2026).leitor).toBe("xp-conta-digital");
    expect(profileDocument(XP).institution).toBe("XP");
  });
});
