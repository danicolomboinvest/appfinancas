import { describe, expect, it } from "vitest";
import { isWiseStatement, parseWiseStatement } from "../wise-extrato-pdf";
import { parseStatementComLeitor } from "../statement-parser";

// Amostra fictícia no formato do extrato Wise em EUR (valor e saldo no fim da linha, data na de baixo).
const TEXTO = `ref:00000000-0000-0000-0000-000000000000 1 / 2
Wise Payments Ltd.
Extrato em EUR
1 de outubro de 2026 [GMT+02:00] - 13 de outubro de 2026 [GMT+02:00]
EUR em 13 de outubro de 2026 [GMT+02:00] 100,00 EUR
Descrição Entrada Saída Valor
Transação por cartão de 20,00 EUR emitida por Loja Exemplo Centro
CIDADE
-20,00 100,00
13 de outubro de 2026 | Cartão terminado em 1111 | Fulana Exemplo | Transação: CARD-1
Transação por cartão de 3,50 EUR emitida por Cafe Teste CIDADE -3,50 120,00
12 de outubro de 2026 | Cartão terminado em 1111 | Fulana Exemplo | Transação: CARD-2
500,00 BRL convertidos para 90,00 EUR 90,00 123,50
11 de outubro de 2026 | Transação: BALANCE-3
Transação por cartão de 6,50 EUR emitida por Mercado Exemplo -6,50 33,50
-- 1 of 2 --
ref:00000000-0000-0000-0000-000000000000 2 / 2
10 de outubro de 2026 | Cartão terminado em 1111 | Fulana Exemplo | Transação: CARD-4
A Wise Payments Limited, nome fantasia Wise, é uma Instituição de Dinheiro Eletrônico.
-- 2 of 2 --`;

describe("extrato Wise em PDF", () => {
  it("reconhece e lê descrição em várias linhas, valor com sinal e data na linha de baixo", () => {
    expect(isWiseStatement(TEXTO)).toBe(true);
    const txns = parseWiseStatement(TEXTO);
    expect(txns).toEqual([
      { date: "2026-10-13", description: "Loja Exemplo Centro CIDADE", amount: -20 },
      { date: "2026-10-12", description: "Cafe Teste CIDADE", amount: -3.5 },
      { date: "2026-10-11", description: "Conversão de moeda (500,00 BRL para 90,00 EUR)", amount: 90 },
      { date: "2026-10-10", description: "Mercado Exemplo", amount: -6.5 },
    ]);
  });

  it("a soma fecha com os saldos: saldo mais novo menos saldo antes do mais antigo", () => {
    const soma = parseWiseStatement(TEXTO).reduce((s, t) => s + t.amount, 0);
    // saldo antes do mais antigo = 33,50 - (-6,50) = 40,00; saldo final = 100,00
    expect(Math.round(soma * 100) / 100).toBe(60);
  });

  it("é o leitor escolhido pelo statement-parser", () => {
    const r = parseStatementComLeitor(TEXTO, "pdf", 2026);
    expect(r.leitor).toBe("wise");
    expect(r.txns).toHaveLength(4);
  });
});
