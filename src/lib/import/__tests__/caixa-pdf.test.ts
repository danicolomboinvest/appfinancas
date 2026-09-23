import { describe, expect, it } from "vitest";
import { isCaixaAppStatement, parseCaixaAppStatement } from "../caixa-pdf";
import { parseStatement } from "../statement-parser";

/**
 * Extrato FICTÍCIO com a mesma estrutura do que o aplicativo da Caixa salva: as datas por extenso
 * no topo, os botões da tela no meio, e cada lançamento de trás pra frente (descrição em várias
 * linhas, depois o valor, e só então o dia).
 */
const CAIXA = `Extrato por Período
Ordenar
21 de Setembro de 2026, Segunda-feira
15 de Setembro de 2026, Terça-feira
09 de Setembro de 2026, Quarta-feira
Compartilhar
Voltar
Deb Pix Chave
Joana de Exemplo
Ferreira
-R$ 400,91
21SET
Cred Pix Chave
Antonio Modelo
R$ 250,00
21SET
Saldo do dia 	R$ 0,00
Cred Pix Chave
Carlos Fictício de
Souza
R$ 150,00
15SET
Saldo do dia 	R$ 150,91
Debito Prestacao
Hab
-R$ 2.116,59
09SET
Saldo do dia 	R$ 0,91
Saldo Anterior 	R$ 225,00

-- 1 of 1 --
`;

describe("extrato do aplicativo da Caixa", () => {
  it("reconhece o formato", () => {
    expect(isCaixaAppStatement(CAIXA)).toBe(true);
    expect(isCaixaAppStatement("Extrato Nubank\n04 MAI 2026 Total de saídas - 10,00")).toBe(false);
  });

  it("lê os quatro lançamentos, com o sinal e a data certos", () => {
    const transacoes = parseCaixaAppStatement(CAIXA, 2026);
    expect(transacoes).toEqual([
      { date: "2026-09-21", description: "Deb Pix Chave Joana de Exemplo Ferreira", amount: -400.91 },
      { date: "2026-09-21", description: "Cred Pix Chave Antonio Modelo", amount: 250 },
      { date: "2026-09-15", description: "Cred Pix Chave Carlos Fictício de Souza", amount: 150 },
      { date: "2026-09-09", description: "Debito Prestacao Hab", amount: -2116.59 },
    ]);
  });

  it("não transforma saldo do dia nem saldo anterior em lançamento", () => {
    const descricoes = parseCaixaAppStatement(CAIXA, 2026).map((t) => t.description);
    expect(descricoes.some((d) => /saldo/i.test(d))).toBe(false);
  });

  it("entra pelo caminho normal de leitura de PDF", () => {
    expect(parseStatement(CAIXA, "pdf", 2026)).toHaveLength(4);
  });
});
