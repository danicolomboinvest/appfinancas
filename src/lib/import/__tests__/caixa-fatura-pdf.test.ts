import { describe, expect, it } from "vitest";
import { isCaixaInvoice, parseCaixaInvoice } from "../caixa-fatura-pdf";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { parseStatement } from "../statement-parser";

/**
 * Fatura FICTÍCIA com a forma da que caiu em "não fechou" em 27/10/2026: a anuidade vem num quadro
 * próprio, SEM data ("ANUIDADE DIFERENCIADA TIT 04/ 12 17,25D"), e o estorno dela vem com data no
 * demonstrativo. Sem a anuidade, o estorno sobrava e a soma ficava R$ 17,25 abaixo do total.
 */
const CAIXA = [
  "CARTÕES CAIXA",
  "VENCIMENTO",
  "10/10/2026",
  "Demonstrativo",
  "Data Descrição Cidade/País Valor U$$ Crédito/Débito",
  "31/08 TOTAL DA FATURA ANTERIOR 500,00D",
  "03/09 OBRIGADO PELO PAGAMENTO 500,00C",
  "30/09 ESTORNO ANUIDADE DIFERENCIADA 17,25C",
  "Total 17,25 C",
  "PESSOA EXEMPLO (Cartão 0000)",
  "ANUIDADE",
  "Crédito/Débito R$",
  "ANUIDADE DIFERENCIADA TIT 04/ 12 17,25D",
  "COMPRAS (Cartão 0000)",
  "Data Descrição Cidade/País Valor U$$ Crédito/Débito",
  "14/09 LOJA EXEMPLO Rio de Janeir 100,00D",
  "Total COMPRAS (Cartão 0000) 117,25D",
  "Valor total desta fatura R$ 100,00 D",
].join("\n");

describe("fatura dos Cartões Caixa (PDF)", () => {
  it("reconhece o arquivo", () => {
    expect(isCaixaInvoice(CAIXA)).toBe(true);
  });

  // A anuidade entra na data do fechamento ("FT dd/mm/aaaa"); sem essa linha, na do vencimento.
  it("lê a anuidade sem data junto com o estorno dela", () => {
    expect(parseCaixaInvoice(CAIXA, 2026)).toEqual([
      { date: "2026-09-30", description: "ESTORNO ANUIDADE DIFERENCIADA", amount: -17.25 },
      { date: "2026-10-10", description: "ANUIDADE DIFERENCIADA TIT 04/12", amount: 17.25 },
      { date: "2026-09-14", description: "LOJA EXEMPLO Rio de Janeir", amount: 100 },
    ]);
  });

  it("com a linha de fechamento, a anuidade entra nesse dia", () => {
    const comFechamento = CAIXA.replace("Demonstrativo", "FT 25/09/2026\nDemonstrativo");
    expect(parseCaixaInvoice(comFechamento, 2026)).toContainEqual({ date: "2026-09-25", description: "ANUIDADE DIFERENCIADA TIT 04/12", amount: 17.25 });
  });

  it("fecha com o total da fatura", () => {
    const linhas = parseStatement(CAIXA, "pdf").filter((t) => !isFaturaSummaryLine(t));
    expect(conferirLeitura(CAIXA, "fatura", linhas)).toMatchObject({ status: "fechou" });
  });
});
