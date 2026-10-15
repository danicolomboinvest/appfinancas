import { describe, expect, it } from "vitest";
import { estornoClaroNaFatura, pareceEstorno } from "../estorno";

describe("pareceEstorno", () => {
  it("reconhece os jeitos que os bancos escrevem estorno", () => {
    for (const d of ["ESTORNO COMPRA MAGAZINE", "Estorno de Pix", "Reembolso iFood", "DEVOLUÇÃO DE COMPRA", "Devolucao Mercado Livre", "Compra cancelada - Netflix", "CHARGEBACK AMAZON", "Crédito de compra"]) {
      expect(pareceEstorno(d)).toBe(true);
    }
  });
  it("não confunde entrada comum com estorno", () => {
    for (const d of ["Salário", "Pix recebido - Maria", "Crédito em conta", "Rendimento", "TED recebida", "Resgate RDB", null]) {
      expect(pareceEstorno(d)).toBe(false);
    }
  });
});

describe("estornoClaroNaFatura: linha de fatura com sinal de compra que é devolução (15/10/2026)", () => {
  it("reconhece o estorno que o texto deixa claro", () => {
    for (const d of [
      "ESTORNO MERCADO LIVRE",
      "Estorno de \"Amazon\"",
      "Estornado - Netflix",
      "MAGAZINE LUIZA - ESTORNO",
      "IFOOD ESTORNO",
      "Estorno IOF compra exterior",
      "CHARGEBACK LOJA X",
      "Compra cancelada - Zara",
      "CANCELAMENTO DE COMPRA RENNER",
      "Devolução de compra Centauro",
      "Reembolso de compra Shopee",
      "ESTORNO DE COMPRA",
      "DEVOLUCAO MERCADO LIVRE",
    ]) {
      expect(estornoClaroNaFatura(d), d).toBe(true);
    }
  });
  it("NÃO vira estorno: loja com o nome parecido, taxa, crédito sendo desfeito, palavra solta", () => {
    for (const d of [
      "BAR CANCELADO",
      "LOJA CANCELADO PIZZARIA",
      "TAXA DE CANCELAMENTO",
      "Cancelamento",
      "CANCELAMENTO SEGURO",
      "ESTORNO DE PAGAMENTO",
      "Estorno de crédito",
      "ESTORNO CASHBACK",
      "Estorno do desconto",
      "TARIFA DEVOLUCAO",
      "Devolução de tarifa",
      "DEVOLUCAO CHEQUE",
      "LOJA DEVOLUCAO",
      "REEMBOLSO",
      "SEGURO REEMBOLSO DESPESAS",
      "ESTORNOLANDIA BAR",
      "Mercado Livre",
      "",
      null,
    ]) {
      expect(estornoClaroNaFatura(d), String(d)).toBe(false);
    }
  });
});
