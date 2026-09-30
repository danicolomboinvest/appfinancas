import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { isMidwayInvoice, parseMidwayInvoice } from "../midway-fatura-pdf";
import { parseStatement } from "../statement-parser";

/**
 * Fatura FICTÍCIA com a mesma estrutura do PDF do Cartão Riachuelo (Midway): resumo no topo,
 * compras parceladas com o valor original ANTES da parcela do mês, "+"/"-" soltos antes do valor,
 * subtotal, pagamento da fatura anterior e anuidade parcelada.
 */
const MIDWAY = [
  "Vencimento",
  "10/09/2026",
  "Histórico de Despesas",
  "Fatura mensal",
  "Titular: PESSOA EXEMPLO",
  "Saldo Anterior 300,00",
  "Pagamentos/Créditos - 300,00",
  "Encargos + 0,00",
  "Despesas/Débitos no Brasil + 185,99",
  "Despesas/Débitos no Exterior + 0,00",
  "Saldo desta Fatura 185,99",
  "Compras Parceladas 100,00 1.000,00",
  "Data Loja Descrição Valor",
  "original",
  "PESSOA EXEMPLO 0000",
  "07/11/25 304 EC *LOJA EXEMPLO 1.100,00 10/11 + 100,00",
  "08/08/26 304 IFD*RESTAURANTE EXEMPLO 50,00 + 50,00",
  "30/08/26 304 IFD*CLUBE 20,00 + 20,00",
  "SUBTOTAL 170,00",
  "08/08/26 001 PAGAMENTO - 300,00",
  "10/09/26 001 ANUIDADE RIACHUELO - TITULAR 04/12 + 15,99",
  "Parcelamento de Fatura Até 18,49 % a.m. 665,92 % a.a. 19,16 % a.m. 719,54 % a.a.",
  "ENDEREÇO MIDWAY: RUA EXEMPLO, 1",
].join("\n");

describe("fatura do Cartão Riachuelo / Midway (PDF)", () => {
  it("reconhece o arquivo", () => {
    expect(isMidwayInvoice(MIDWAY)).toBe(true);
    expect(isMidwayInvoice("Extrato de Conta Corrente\n01/01/2026 PIX 10,00")).toBe(false);
  });

  it("usa a parcela do mês, não o valor original, e o sinal solto antes do valor", () => {
    expect(parseMidwayInvoice(MIDWAY)).toEqual([
      { date: "2025-11-07", description: "EC *LOJA EXEMPLO PARC 10/11", amount: 100 },
      { date: "2026-08-08", description: "IFD*RESTAURANTE EXEMPLO", amount: 50 },
      { date: "2026-08-30", description: "IFD*CLUBE", amount: 20 },
      { date: "2026-08-08", description: "PAGAMENTO DE FATURA", amount: -300 },
      { date: "2026-09-10", description: "ANUIDADE RIACHUELO - TITULAR PARC 04/12", amount: 15.99 },
    ]);
  });

  it("sem o pagamento, fecha com o total de despesas da fatura", () => {
    const linhas = parseStatement(MIDWAY, "pdf").filter((t) => !isFaturaSummaryLine(t));
    expect(linhas.some((t) => t.description.startsWith("PAGAMENTO"))).toBe(false);
    expect(conferirLeitura(MIDWAY, "fatura", linhas)).toMatchObject({ status: "fechou", esperado: 185.99 });
  });
});
