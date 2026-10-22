import { describe, expect, it } from "vitest";
import { parseItauInvoice } from "../itau-fatura-pdf";

// Amostra FICTÍCIA: fatura Itaú com espaço no meio das palavras e duas colunas. O quadro das
// próximas faturas traz parcelas de valor DIFERENTE do da parcela atual (loja A 01/03 300,00 e
// 02/03 250,00), então só o total impresso ("Próxima fat ura 550,00") diz que não são do mês.
const AMOSTRA = [
  "Itaú Unibanco Emissão: 03/09/2026",
  "Total dos lançam entos atu ais 1.000,00",
  "Pa ga me nt os e fet u ad o s Lanç am ent o s: c o mp ra s e saq ue s",
  "02/ 08 LO JA A 01/03 300,00 05/ 08 MER CAD O B 400,00",
  "outro s CAM PINA S",
  "10/08 PADA RIA C 150,00 12/ 08 CAF E D 150,00",
  "Total dos lançam ent os atu ais 1.000,00",
  "C om p ras p ar cel ad as - p ró x im as fa tur as",
  "02/ 08 LO JA A 02/03 250,00",
  "25/08 LOJA E 02/03 300,00",
  "Próxima fat ura 550,00",
].join("\n");

describe("fatura Itaú espaçada com quadro das próximas faturas de valor diferente", () => {
  it("tira o quadro pelo total impresso e fecha no centavo", () => {
    const txns = parseItauInvoice(AMOSTRA, 2026);
    const soma = Math.round(txns.reduce((s, t) => s + t.amount, 0) * 100);
    expect(soma).toBe(100000);
    expect(txns).toHaveLength(4);
  });
});
