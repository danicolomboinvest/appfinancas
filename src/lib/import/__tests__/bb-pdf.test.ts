import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { isBancoDoBrasilStatement, parseBancoDoBrasilStatement } from "../bb-pdf";
import { profileDocument } from "../profile";
import { parseStatement } from "../statement-parser";

/**
 * Extrato FICTÍCIO com a mesma estrutura do PDF de conta corrente do Banco do Brasil: sinal
 * "(+)"/"(-)" depois do valor, lote e documento antes do histórico, descrição que desce pras
 * linhas de baixo, "Saldo do dia" no meio, cabeçalho repetido a cada página e o bloco de
 * "Informações Adicionais" com a oferta de crédito no rodapé.
 */
const BB = [
  "Extrato de Conta Corrente",
  "Cliente: PESSOA DE EXEMPLO",
  "Agência: 0000-0 Conta: 000000-0\tPeríodo: 01 a 25/09/2026",
  "Lançamentos",
  "Dia Documento Valor\tLote Histórico",
  "31/08/2026 0,00 (+)\tSaldo Anterior",
  "01/09/2026 1.260,00 (-)\t11111 90001",
  "Pagamento de Boleto",
  "ESCRITORIO FICTICIO",
  "ASSOCIADOS",
  "01/09/2026 20,00 (-)\t11111 90002 Pix - Enviado",
  "01/09 10:03 PADARIA EXEMPLO",
  "01/09/2026 900,00 (-)\t11112 20000001 Pagto cartão crédito",
  "VISA EXEMPLO",
  "01/09/2026 2.180,00 (+)\t9903 BB Rende Fácil",
  "Rende Facil",
  "01/09/2026 0,00 (+)\t22222 Saldo do dia",
  "-- 1 of 2 --",
  "Extrato de Conta Corrente",
  "Cliente: PESSOA DE EXEMPLO",
  "Lançamentos",
  "Dia Documento Valor\tLote Histórico",
  "02/09/2026 500,00 (+)\t22222 300000000000001 Transferência recebida",
  "02/09 17:31 FULANO DE TAL",
  "02/09/2026 500,00 (+)\t33333 Saldo do dia",
  "03/09/2026 500,00 (+)\tS A L D O",
  "Informações Adicionais",
  "1.000,00 (+)\tInvest. Resgate Autom.",
  "50.000,00 (+)\tCREDITO BB-MELHOR OFERTA*",
  "Lançamentos Futuros",
  "101,90 (-)\t25/09/2026 Tarifa Pacote de Serviços",
].join("\n");

describe("extrato de conta corrente do Banco do Brasil (PDF)", () => {
  it("reconhece o arquivo e chama pelo nome certo, mesmo com boleto pago a outro banco", () => {
    expect(isBancoDoBrasilStatement(BB)).toBe(true);
    expect(isBancoDoBrasilStatement("Extrato de Conta Corrente\n01/01/2026 PIX 10,00")).toBe(false);
    expect(profileDocument(BB + "\nBANCO C6 S.A.\nBANCO C6 S.A.").institution).toBe("Banco do Brasil");
  });

  it("usa o (+)/(-) como sinal, junta a descrição e pula saldos e o rodapé", () => {
    expect(parseBancoDoBrasilStatement(BB)).toEqual([
      { date: "2026-09-01", description: "Pagamento de Boleto ESCRITORIO FICTICIO ASSOCIADOS", amount: -1260 },
      { date: "2026-09-01", description: "Pix - Enviado PADARIA EXEMPLO", amount: -20 },
      { date: "2026-09-01", description: "Pagto cartão crédito VISA EXEMPLO", amount: -900 },
      { date: "2026-09-01", description: "BB Rende Fácil Rende Facil", amount: 2180 },
      { date: "2026-09-02", description: "Transferência recebida FULANO DE TAL", amount: 500 },
    ]);
  });

  it("é o leitor usado pro PDF, e a soma fecha com o saldo final", () => {
    const txns = parseStatement(BB, "pdf");
    expect(txns).toHaveLength(5);
    expect(txns.reduce((s, t) => s + t.amount, 0)).toBeCloseTo(500);
  });
});

describe("conferência pelo saldo do Banco do Brasil", () => {
  const txt = (corpo: string) => `Extrato de Conta Corrente\nDia Documento Valor Lote Histórico\n25/09/2026 1.060,00 (+)\tSaldo Anterior\n${corpo}\n05/10/2026 210,95 (-)\tS A L D O\n`;
  it("fecha quando saldo anterior + lançamentos = saldo final, mesmo com valores redondos", () => {
    const t = txt("25/09/2026 100,00 (+)\t1 2 Pix - Recebido\n25/09/2026 1.370,95 (-)\t1 2 Pix - Enviado");
    const r = conferirLeitura(t, "extrato", [
      { date: "2026-09-25", description: "Pix - Recebido", amount: 100 },
      { date: "2026-09-25", description: "Pix - Enviado", amount: -1370.95 },
    ]);
    expect(r.status).toBe("fechou");
  });
  it("acusa quando falta lançamento", () => {
    const t = txt("25/09/2026 100,00 (+)\t1 2 Pix - Recebido\n25/09/2026 1.370,95 (-)\t1 2 Pix - Enviado");
    const r = conferirLeitura(t, "extrato", [{ date: "2026-09-25", description: "Pix - Recebido", amount: 100 }]);
    expect(r.status).toBe("nao-fechou");
  });
});
