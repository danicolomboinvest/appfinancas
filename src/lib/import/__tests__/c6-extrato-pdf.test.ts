import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { checarPlausibilidade } from "../plausibility";
import { parseStatement } from "../statement-parser";

/** Extrato FICTÍCIO com a estrutura do PDF do C6: um resumo "Entradas • Saídas" por mês, com o
 * período entre datas, colunas data de lançamento / data contábil / tipo / descrição / valor. */
const C6 = [
  "Extrato exportado no dia 1 de outubro de 2026 às 10:00",
  "PESSOA EXEMPLO • 000.000.000-00",
  "Extrato Período • 2 de agosto de 2026 até 1 de outubro de 2026",
  "Saldo do dia • 1 de outubro de 2026 • R$ 126,05",
  "Agosto 2026 ( 02/08/2026 - 31/08/2026 ) \tEntradas: R$ 1.050,00 • Saídas: R$ 300,00",
  "Data",
  "lançamento",
  "Data",
  "contábil \tTipo \tDescrição \tValor",
  "03/08 \t03/08 \tEntrada PIX \tPix recebido de PESSOA A \tR$ 1.000,00",
  "07/08 \t07/08 \tEntradas \tEST DEBITO DE CARTAO \tR$ 50,00",
  "Saldo do dia 07/08/26 \tR$ 1.176,05",
  "10/08 \t10/08 \tSaída PIX \tPix enviado para LOJA EXEMPLO \t-R$ 300,00",
  "Saldo do dia 10/08/26 \tR$ 876,05",
  "Setembro 2026 ( 01/09/2026 - 30/09/2026 ) \tEntradas: R$ 30,00 • Saídas: R$ 780,00",
  "03/09 \t03/09 \tEntrada PIX \tPix recebido de PESSOA B \tR$ 30,00",
  "27/09 \t28/09 \tPagamento \tPGTO FAT CARTAO C6 \t-R$ 780,00",
  "Saldo do dia 28/09/26 \tR$ 126,05",
].join("\n");

describe("extrato do C6 em PDF", () => {
  it("o resumo de cada mês não vira lançamento", () => {
    const txns = parseStatement(C6, "pdf", 2026);
    expect(txns.map((t) => t.amount)).toEqual([1000, 50, -300, 30, -780]);
  });

  it("confere somando os resumos de todos os meses do arquivo", () => {
    const txns = parseStatement(C6, "pdf", 2026);
    expect(conferirLeitura(C6, "extrato", txns).status).toBe("fechou");
    expect(conferirLeitura(C6, "extrato", txns.slice(1)).status).toBe("nao-fechou");
  });
});

describe("aviso de sinal perdido", () => {
  const soEntradas = Array.from({ length: 10 }, (_, i) => ({ date: "2026-09-03", description: `Pix recebido de PESSOA ${i}`, amount: 30 }));

  it("aparece quando quase tudo é entrada e não deu pra conferir", () => {
    expect(checarPlausibilidade(soEntradas, "extrato").some((x) => x.texto.includes("ENTRADA"))).toBe(true);
  });

  it("some quando as entradas e saídas já bateram com o documento", () => {
    expect(checarPlausibilidade(soEntradas, "extrato", true)).toHaveLength(0);
  });
});
