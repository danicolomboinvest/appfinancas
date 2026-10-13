import { describe, expect, it } from "vitest";
import { isExtratoColunasTxt, parseExtratoColunasTxt } from "../extrato-colunas-txt";
import { parseStatementComLeitor } from "../statement-parser";

// Amostra fictícia: .txt com colunas alinhadas por espaços.
const TEXTO = [
  "Data                Lançamento                         Detalhes                                          N° documento                  Valor                       Tipo Lançamento",
  "29/05/2026          Saldo Anterior                                                                                                     1.000,00                           ",
  "01/06/2026          Pix - Recebido                     31/05 00:41 00001234567890 MARIA EXEMPLO          310041376249642               25,00                       Entrada ",
  "01/06/2026          Pix - Enviado                      30/05 12:02 PADARIA TESTE LTDA                    60101                         -30,00                      Saída  ",
  "01/06/2026          Cobrança de I.O.F.                 IOF Saldo Devedor Conta                           391100701                     -0,09                       Saída  ",
  "01/06/2026          Saldo do dia                                                                                                       994,91                             ",
  "03/06/2026          Transferido da poupança            03/06 14:33 JOAO EXEMPLO                          613960010277                  500,00                      Entrada ",
  "03/06/2026          Saldo do dia                                                                                                       1.494,91                           ",
  "30/06/2026          S A L D O                                                                                                          1.494,91                           ",
].join("\n");

describe("extrato .txt em colunas", () => {
  it("lê data da coluna 1, nome do detalhe e sinal pelo tipo; ignora saldos", () => {
    expect(isExtratoColunasTxt(TEXTO)).toBe(true);
    expect(parseExtratoColunasTxt(TEXTO)).toEqual([
      { date: "2026-06-01", description: "Pix - Recebido MARIA EXEMPLO", amount: 25 },
      { date: "2026-06-01", description: "Pix - Enviado PADARIA TESTE LTDA", amount: -30 },
      { date: "2026-06-01", description: "Cobrança de I.O.F. IOF Saldo Devedor Conta", amount: -0.09 },
      { date: "2026-06-03", description: "Transferido da poupança JOAO EXEMPLO", amount: 500 },
    ]);
  });

  it("a soma dos lançamentos leva o saldo anterior até o saldo final", () => {
    const soma = parseExtratoColunasTxt(TEXTO).reduce((s, t) => s + t.amount, 0);
    expect(Math.round((1000 + soma) * 100) / 100).toBe(1494.91);
  });

  it("é usado pelo statement-parser no texto solto", () => {
    expect(parseStatementComLeitor(TEXTO, "auto", 2026).leitor).toBe("extrato-colunas-txt");
  });
});
