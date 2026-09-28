import { describe, expect, it } from "vitest";
import { isBradescoStatement, parseBradescoStatement } from "../bradesco-pdf";
import { parseStatement } from "../statement-parser";

/**
 * Extrato FICTÍCIO com a mesma estrutura do PDF do "Bradesco Celular": data só no primeiro
 * lançamento do dia, histórico numa linha e "docto valor saldo" na de baixo, crédito e débito
 * sem sinal (só a variação do saldo diz qual é qual), cabeçalho repetido por página e o total.
 */
const BRADESCO = [
  "Bradesco Celular",
  "Data: 25/09/2026 - 10h08",
  "Nome: PESSOA DE EXEMPLO",
  "Extrato de: Agência: 0000 | Conta: 000000-0 | Movimentação entre: 27/08/2026 e 25/09/2026 Folha: 1/2",
  "Data Histórico Docto. Crédito (R$) Débito (R$) Saldo (R$)",
  "26/08/2026 COD. LANC. 0 0,00 45,72",
  "27/08/2026 PIX ENVIADO",
  "DES: PADARIA EXEMPLO 27/08 1000001 19,00 26,72",
  "31/08/2026 TRANSF SALDO C/SAL P/CC",
  "EMPRESA FICTICIA PAGAMENTO 1000002 1.000,00 1.026,72",
  "SAQUE DINHEIRO ATM",
  "Ag00000maq000000seq0000000000000 1000003 600,00 426,72",
  "-- 1 of 2 --",
  "Bradesco Celular",
  "Data: 25/09/2026 - 10h08",
  "Nome: PESSOA DE EXEMPLO",
  "Data Histórico Docto. Crédito (R$) Débito (R$) Saldo (R$)",
  "PIX RECEBIDO",
  "REM: FULANO DE TAL 31/08 1000004 100,00 526,72",
  "Total 1.100,00 619,00 526,72",
].join("\n");

describe("extrato do Bradesco Celular (PDF)", () => {
  it("reconhece o arquivo", () => {
    expect(isBradescoStatement(BRADESCO)).toBe(true);
    expect(isBradescoStatement("Extrato de Conta Corrente\n01/01/2026 PIX 10,00")).toBe(false);
  });

  it("pega o valor (não o saldo), herda a data do dia e tira o sinal da variação do saldo", () => {
    expect(parseBradescoStatement(BRADESCO)).toEqual([
      { date: "2026-08-27", description: "PIX ENVIADO DES: PADARIA EXEMPLO", amount: -19 },
      { date: "2026-08-31", description: "TRANSF SALDO C/SAL P/CC EMPRESA FICTICIA PAGAMENTO", amount: 1000 },
      { date: "2026-08-31", description: "SAQUE DINHEIRO ATM Ag00000maq000000seq0000000000000", amount: -600 },
      { date: "2026-08-31", description: "PIX RECEBIDO REM: FULANO DE TAL", amount: 100 },
    ]);
  });

  it("é o leitor usado pro PDF, e fecha com o total do rodapé", () => {
    const txns = parseStatement(BRADESCO, "pdf");
    expect(txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)).toBeCloseTo(1100);
    expect(txns.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0)).toBeCloseTo(619);
  });
});
