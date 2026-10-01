import { describe, expect, it } from "vitest";
import { parecePagamentoDeFatura, pareceAplicacao, pareceContaPropria } from "../dinheiro-proprio";

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

describe("fatura do Nubank paga por outro banco (01/10/2026)", () => {
  it.each(["Pagamento de boleto NU PAGAMENTOS S.A.", "PAG BOLETO NU PAGAMENTOS SA", "BOLETO PAGO - NU PAGAMENTOS SA - IP", "PAGAMENTO TITULO NU PAGAMENTOS", "Pagto boleto Banco Itaucard", "Boleto Bradescard"])(
    "boleto para a empresa do cartão é pagamento de fatura: %s",
    (d) => expect(parecePagamentoDeFatura(d)).toBe(true),
  );
  it.each(["Boleto Itaú Seguros", "Pagamento de boleto Enel", "Boleto condomínio"])("boleto que não é da empresa do cartão continua gasto: %s", (d) =>
    expect(parecePagamentoDeFatura(d)).toBe(false),
  );
  it("Pix para Nu Pagamentos vira pergunta (fatura por Pix ou conta Nubank dela), não some sozinho", () => {
    expect(parecePagamentoDeFatura("Pix enviado Nu Pagamentos S.A.")).toBe(false);
    expect(pareceContaPropria("Pix enviado Nu Pagamentos S.A.", "Maria Exemplo")).toBe(true);
  });
});
