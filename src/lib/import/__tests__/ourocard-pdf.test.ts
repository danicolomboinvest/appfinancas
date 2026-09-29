import { describe, expect, it } from "vitest";
import { isFaturaSummaryLine } from "../fatura-lines";
import { isOurocardInvoice, parseOurocardInvoice } from "../ourocard-pdf";
import { parseStatement } from "../statement-parser";

/**
 * Fatura FICTÍCIA com a mesma estrutura do PDF do Ourocard (Banco do Brasil): resumo no topo,
 * data de fechamento, pagamento e estorno com o menos DEPOIS do "R$", compras sem sinal agrupadas
 * por categoria, parcela de compra do ano anterior e o total no fim.
 */
const OUROCARD = [
  "Olá, Pessoa, esta é sua fatura de",
  "outubro",
  "OUROCARD VISA GOLD Final 0000",
  "Resumo da fatura",
  "Saldo fatura anterior R$ 800,00",
  "Pagamentos/Créditos R$ -804,99",
  "Compras nacionais R$ 186,57",
  "Total R$ 181,58",
  "Limite único utilizado R$ 9.629,00",
  "Datas fatura",
  "Fatura fechada em 21/09/2026",
  "Melhor data de compra 22/10/2026",
  "Lançamentos nesta fatura",
  "Pessoa Exemplo (Cartão 0000)",
  "Data Descrição País Valor",
  "SALDO FATURA ANTERIOR BR R$ 800,00",
  "Pagamentos/Créditos",
  "28/08 PGTO. CASH AG. 0000 000000000 200 BR R$ -800,00",
  "21/09 IFD*RESTAURANTE EXEMPLO BR R$ -4,99",
  "Restaurantes",
  "15/09 IFD*RESTAURANTE EXEMPLO BR R$ 22,57",
  "Página 2/4",
  "Compras parceladas",
  "11/12 LOJA EXEMPLO PARC 10/10 SAO JOSE DOS BR R$ 164,00",
  "Total da Fatura R$ 181,58",
  "Página 3/4",
].join("\n");

describe("fatura do Ourocard (PDF)", () => {
  it("reconhece o arquivo", () => {
    expect(isOurocardInvoice(OUROCARD)).toBe(true);
    expect(isOurocardInvoice("Extrato de Conta Corrente\n01/01/2026 PIX 10,00")).toBe(false);
  });

  it("compra positiva, pagamento e estorno negativos, e parcela antiga no ano certo", () => {
    expect(parseOurocardInvoice(OUROCARD, 2026)).toEqual([
      { date: "2026-08-28", description: "PGTO. CASH AG. 0000 000000000 200", amount: -800 },
      { date: "2026-09-21", description: "IFD*RESTAURANTE EXEMPLO", amount: -4.99 },
      { date: "2026-09-15", description: "IFD*RESTAURANTE EXEMPLO", amount: 22.57 },
      { date: "2025-12-11", description: "LOJA EXEMPLO PARC 10/10 SAO JOSE DOS", amount: 164 },
    ]);
  });

  it("depois de tirar o pagamento, as compras batem com o resumo da fatura", () => {
    const linhas = parseStatement(OUROCARD, "pdf", 2026).filter((t) => !isFaturaSummaryLine(t));
    expect(linhas.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)).toBeCloseTo(186.57);
    expect(linhas.some((t) => t.description.startsWith("PGTO"))).toBe(false);
  });
});
