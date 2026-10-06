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

describe("extrato do Bradesco com histórico começando com 'Total'", () => {
  it("TOTAL EXPRESS no meio do extrato não corta o resto; só o rodapé encerra", () => {
    const texto = BRADESCO.replace("DES: PADARIA EXEMPLO 27/08 1000001 19,00 26,72", "VISA ELECTRON\nTOTAL EXPRESS 27/08 1000001 19,00 26,72");
    const lidos = parseBradescoStatement(texto);
    expect(lidos).toHaveLength(4);
    expect(lidos[0]).toEqual({ date: "2026-08-27", description: "PIX ENVIADO VISA ELECTRON TOTAL EXPRESS", amount: -19 });
    expect(lidos[3].description).toBe("PIX RECEBIDO REM: FULANO DE TAL");
  });
});

describe("Bradesco: tela 'Últimos Lançamentos' (débito já com sinal, duas tabelas)", () => {
  const texto = [
    "Extrato (Últimos Lançamentos)",
    "EMPRESA EXEMPLO LTDA | CNPJ: 00.000.000/0001-00",
    "Data Lançamento Dcto. Crédito (R$) Débito (R$) Saldo (R$)",
    "04/09/2026 SALDO ANTERIOR 1.000,00",
    "09/09/2026 PAGTO ELETRON COBRANCA",
    "ALUGUEL 6 -300,00 700,00",
    "PIX RECEBIDO",
    "REM: FULANO 09/09 1306184 2.000,00 2.700,00",
    "GASTOS CARTAO DE CREDITO 3990253 -3.000,00 -300,00",
    "Total 2.000,00 -3.300,00 -300,00",
    "Últimos Lançamentos",
    "Data Lançamento Dcto. Crédito (R$) Débito (R$) Saldo (R$)",
    "29/09/2026 SALDO ANTERIOR -300,00",
    "02/10/2026 ENCARGOS LIMITE DE CRED 4550275 -5,00 -305,00",
    "Total 0,00 -5,00 -305,00",
    "Lançamentos Futuros",
    "Data Lançamento Dcto. Crédito (R$) Débito (R$)",
    "13/10/2026 GASTOS CARTAO DE CREDITO 3720268 -1.522,00",
    "Total do Dia 0,00 -1.522,00",
  ].join("\n");

  it("lê as duas tabelas, com o sinal certo, e ignora os lançamentos futuros", () => {
    expect(isBradescoStatement(texto)).toBe(true);
    const t = parseBradescoStatement(texto);
    expect(t.map((x) => x.amount)).toEqual([-300, 2000, -3000, -5]);
    expect(t[3].date).toBe("2026-10-02");
  });
});
