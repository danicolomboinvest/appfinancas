import { describe, expect, it } from "vitest";
import { pareceContaDeConsumo } from "../conta-de-consumo";

// Trechos fictícios no formato das contas reais (texto como sai do PDF).
const TELEFONE = [
  "FULANA DE TAL",
  "Telefonica Brasil S.A. \tNº da Conta: \t0000000000",
  "MÊS REFERÊNCIA: \t08/2026",
  "VENCIMENTO \tVALOR A PAGAR (R$)",
  "17/08/2026 \t150,00",
  "MEIO DE PAGAMENTO: \tCARTÃO DE CRÉDITO",
  "(DE 02/07/26 A 01/08/26)",
  "CELULAR EXEMPLO \t150,00",
  "Total a pagar \t150,00",
  "Plano contratado | Adicionais contratados \tQuantidade \tValor (R$)",
].join("\n");

const LUZ = [
  "FULANO DE TAL",
  "R$84,42\t30/11/2023",
  "MÊS/ANO \tCONSUMO",
  "\tFATURADO (kWh) \tDIAS",
  "DATA DE EMISSÃO: \tNOTA FISCAL: \tREFERÊNCIA: \tDATA DE VENCIMENTO: \tVALOR DO DOCUMENTO:",
  "Conta de Energia Elétrica \tNota Fiscal",
  "TOTAL \t84,42",
].join("\n");

const FATURA_CARTAO = [
  "Fulana | fatura de Agosto de 2026 | cartão final 0000",
  "Vencimento: 17/08",
  "Lançamentos do cartão virtual | Fulana | Final 0000 Total do cartão: R$ 150,00",
  "R$ 150,00\tOperadora Exemplo\t17 Jul",
  "Total a pagar R$ 150,00",
].join("\n");

describe("conta de consumo no lugar do extrato", () => {
  it("reconhece conta de telefone e de luz", () => {
    expect(pareceContaDeConsumo(TELEFONE)).toBe(true);
    expect(pareceContaDeConsumo(LUZ)).toBe(true);
  });

  it("não confunde fatura de cartão nem extrato que citam a operadora", () => {
    expect(pareceContaDeConsumo(FATURA_CARTAO)).toBe(false);
    expect(pareceContaDeConsumo("Extrato de conta corrente\nSaldo anterior 10,00\n05/08 Pagamento Telefonica Brasil S.A. -150,00\nVencimento\nTotal a pagar")).toBe(false);
  });
});
