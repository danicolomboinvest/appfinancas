import { describe, expect, it } from "vitest";
import { parecePagamentoDeFatura, pareceAplicacao } from "../dinheiro-proprio";

/** Casos que a revisão pegou depois da regra única de pagamento de fatura e de aplicação. */
describe("pagamento de fatura pelo canal internet", () => {
  it.each(["PAGAMENTO FATURA CARTAO VIA INTERNET", "PAGTO CARTAO CREDITO INTERNET", "PAG FATURA VIA INTERNET", "PAGTO FATURA ITAUCARD INTERNET"])("%s é pagamento de cartão", (d) => {
    expect(parecePagamentoDeFatura(d)).toBe(true);
  });
  it.each(["Pagamento de fatura CLARO", "PAGAMENTO FATURA INTERNET VIVO", "Pagamento fatura internet"])("%s é conta de consumo", (d) => {
    expect(parecePagamentoDeFatura(d)).toBe(false);
  });
});

describe("aplicação por transferência", () => {
  it.each(["Transferência para poupança", "TRANSF P/ POUPANCA", "TRANSFERENCIA POUPANCA", "TED Tesouro Direto", "Pix para caixinha"])("%s é aplicação", (d) => {
    expect(pareceAplicacao(d)).toBe(true);
  });
  it.each(["Pix enviado LCA Modas", "PIX CDB CALCADOS"])("%s é gasto numa loja", (d) => {
    expect(pareceAplicacao(d)).toBe(false);
  });
});
