import { describe, expect, it } from "vitest";
import { isContaEntradaSaidaPdf, parseContaEntradaSaidaPdf } from "../conta-entrada-saida-pdf";
import { parseStatementComLeitor } from "../statement-parser";

/**
 * Extrato FICTÍCIO com a mesma estrutura do PDF de conta PJ com colunas Entrada e Saída: totais no
 * topo, "Saldo do dia" solto, lançamento quebrado em linhas, entrada com o valor na 1ª coluna
 * ("R$ x -") e saída na 2ª ("- R$ x"), e um nome de PIX que ocupa três linhas.
 */
const EXTRATO = `EMPRESA EXEMPLO LTDA
CNPJ 00.000.000/0001-00 Banco 301 Agência 0001 Conta 1234567-8
De 01/09/2026 a 30/09/2026
Total de entradas R$ 6.855,00 \tTotal de saídas R$ 3.980,57
Movimentações
Data \tCategoria \tLançamento Descrição \tEntrada \tSaída
Saldo do dia
-
R$ 2.641,49
11/09/2026
Pessoa
Jurídica
Pagamento AMIL ASSISTENCIA ME \t- \tR$ 2.041,49
11/09/2026
Pessoa
Jurídica PIX \tPAULO SILVESTRE MENDES DINIZ \t- \tR$ 600,00
Saldo do dia \tR$ 6.669,00
15/09/2026 Pessoa
Jurídica
Pagamento CONTABILIZEI TECNOLOGIA LTDA \t- \tR$ 156,00
15/09/2026
Pessoa
Jurídica
PIX \tCLINICA EXEMPLO SERVIC \tR$ 6.825,00 -
Saldo do dia \t-R$ 178,31
18/09/2026
Pessoa
Jurídica
Pagamento DARF UNIFICADO \t- \tR$ 178,31
Saldo do dia \t-R$ 974,77
21/09/2026
Pessoa
Jurídica
Pagamento SIMPLES NACIONAL \t- \tR$ 351,01
21/09/2026
Pessoa
Jurídica
PIX
AGENCIA EXEMPLO TURISMO S.A EM RECUPERACAO
JUDICIAL
- \tR$ 623,76
Saldo do dia \tR$ 0,00
26/09/2026
Pessoa
Jurídica
PIX \tEMPRESA EXEMPLO LTDA \tR$ 30,00 -
26/09/2026
Pessoa
Jurídica
PIX \tLOTERIAS EXEMPLO S A \t- \tR$ 30,00
Extrato gerado no dia 18/10/2026 às 17:44 \t1 de 1
`;

describe("extrato PJ com colunas Entrada e Saída", () => {
  it("reconhece o formato", () => {
    expect(isContaEntradaSaidaPdf(EXTRATO)).toBe(true);
  });

  it("lê entrada como entrada e o nome em várias linhas como um lançamento só", () => {
    const { txns, leitor } = parseStatementComLeitor(EXTRATO, "pdf", 2026);
    expect(leitor).toBe("conta-entrada-saida");
    expect(txns).toHaveLength(9);
    const soma = (f: (n: number) => boolean) => Math.round(txns.filter((t) => f(t.amount)).reduce((s, t) => s + t.amount, 0) * 100) / 100;
    expect(soma((n) => n > 0)).toBe(6855);
    expect(soma((n) => n < 0)).toBe(-3980.57);
    expect(txns.find((t) => t.amount === 6825)?.description).toContain("CLINICA EXEMPLO");
    expect(txns.find((t) => t.amount === 30)?.description).toContain("EMPRESA EXEMPLO");
    expect(txns.find((t) => t.amount === -623.76)?.description).toContain("AGENCIA EXEMPLO TURISMO S.A EM RECUPERACAO JUDICIAL");
  });

  it("não devolve nada quando a soma não fecha com os totais do topo", () => {
    const errado = EXTRATO.replace("Total de saídas R$ 3.980,57", "Total de saídas R$ 3.000,00");
    expect(parseContaEntradaSaidaPdf(errado)).toEqual([]);
  });

  it("PDF com dois bancos juntos: cada página é lida pelo seu leitor", () => {
    const CORA = [
      "Cora SCFI - CNPJ 00.000.000/0001-00",
      "Extrato gerado no dia 26/09/2026 às 21:37 pág 1 de 1",
      "01/09/2026 a 30/09/2026",
      "Total de entradas \t+ R$ 1.000,00",
      "Total de saídas \t- R$ 100,00",
      "25/09/2026 \tSaldo do dia R$ 900,00",
      "- R$ 100,00\tTransf Pix enviada \tFULANO DE TAL… 000.000.000-00",
      "+ R$ 1.000,00\tTransferência recebida \tEMPRESA MODELO LTDA \t00.000.000/0001-00",
    ].join("\n");
    const junto = `${EXTRATO}\n-- 1 of 2 --\n${CORA}\n-- 2 of 2 --\n`;
    const { txns, leitor } = parseStatementComLeitor(junto, "pdf", 2026);
    expect(leitor).toBe("varios-bancos");
    expect(txns).toHaveLength(11);
    const soma = Math.round(txns.reduce((s, t) => s + t.amount, 0) * 100) / 100;
    expect(soma).toBe(6855 - 3980.57 + 1000 - 100);
  });
});
