import { describe, expect, it } from "vitest";
import { isItauInvoice, parseItauInvoice } from "../itau-fatura-pdf";
import { parseStatementComLeitor } from "../statement-parser";

// Amostra FICTÍCIA: fatura Itaú de dois cartões, PDF em duas colunas. Depois do título do quadro
// "Compras parceladas - próximas faturas" (coluna da direita), as compras do mês seguem na da
// esquerda; a última linha da página junta as colunas por tabulação.
const AMOSTRA = [
  "Itaú Unibanco  Emissão: 14/09/2026",
  "Lançamentos atuais 295,00  Total desta fatura 295,00",
  "Lançamentos: compras e saques Lançamentos: compras e saques",
  "FULANA TESTE (final 1111) 11/09 CAFE UM 10,00",
  "DATA ESTABELECIMENTO VALOR EM R$ ALIMENTAÇÃO .SAO PAULO",
  "10/09 LOJA A 100,00 11/09 CAFE DOIS 20,00",
  "ALIMENTAÇÃO .SAO PAULO ALIMENTAÇÃO .SAO PAULO",
  "12/09 LOJA B 04/10 50,00 CICLANO TESTE (final 2222)",
  "ALIMENTAÇÃO .SAO PAULO DATA ESTABELECIMENTO VALOR EM R$",
  "13/09 LOJA C 40,00 14/09 LOJA D 30,00",
  "ALIMENTAÇÃO .SAO PAULO Lançamentos no cartão (final 2222) 30,00",
  "13/09 LOJA E 25,00 Compras parceladas - próximas faturas",
  "ALIMENTAÇÃO .SAO PAULO DATA ESTABELECIMENTO VALOR EM R$",
  "14/09 LOJA F 15,00 29/10 LOJA B 05/10 50,00",
  "Lançamentos no cartão (final 1111) 260,00 01/11 LOJA X 02/03 70,00",
  "02/11 LOJA Y 02/02 80,00",
  "01/05 LOJA Z 05/12 31,23\t10/09 CANCELAMENTO 5,00 08/06 LOJA Q 05/05 30,52",
  "Continua...",
  "-- 5 of 10 --",
  "Compras parceladas - próximas faturas",
  "08/06 LOJA W 05/05 11,76 Limite total de crédito 180.000,00",
  "L Total dos lançamentos atuais 295,00",
].join("\n");

describe("fatura Itaú de vários cartões em duas colunas", () => {
  it("lê as compras do mês nas duas colunas, sem o quadro das próximas faturas", () => {
    expect(isItauInvoice(AMOSTRA)).toBe(true);
    const txns = parseItauInvoice(AMOSTRA, 2026);
    const soma = Math.round(txns.reduce((s, t) => s + t.amount, 0) * 100) / 100;
    expect(soma).toBe(295);
    expect(txns.map((t) => t.description)).toEqual([
      "CAFE UM", "LOJA A", "CAFE DOIS", "LOJA B 04/10", "LOJA C", "LOJA D", "LOJA E", "LOJA F", "CANCELAMENTO",
    ]);
  });

  it("o statement-parser usa o leitor do Itaú", () => {
    const r = parseStatementComLeitor(AMOSTRA, "pdf", 2026);
    expect(r.leitor).toBe("itau-fatura");
    expect(r.txns).toHaveLength(9);
  });
});
