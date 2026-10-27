import { describe, expect, it } from "vitest";
import { isCaixaInvoice, parseCaixaInvoice } from "../caixa-fatura-pdf";

// Fatura FICTÍCIA no formato dos Cartões Caixa, com anuidade sem data e créditos.
const FATURA = `VENCIMENTO
10/10/2026
VALOR TOTAL DESTA FATURA
R$ 120,00
CARTÕES CAIXA - 00.360.305/0001-04
FT 30/09/2026
Demonstrativo
Data Descrição Cidade/País Valor U$$ Crédito/Débito
31/08 TOTAL DA FATURA ANTERIOR 500,00D
03/09 OBRIGADO PELO PAGAMENTO 500,00C
30/09 CASHBACK ANUIDADE GASTOS TIT 17,25C
Total 17,25 C
FULANA DE TAL (Cartão 1212)
ANUIDADE
Crédito/Débito R$
ANUIDADE DIFERENCIADA TIT 04/ 12 17,25D
COMPRAS (Cartão 1212)
Data Descrição Cidade/País Valor U$$ Crédito/Débito
01/09 LOJA EXEMPLO SANTA INES 100,00D
05/09 MERCADO MODELO BARRA DO CORD 20,00D
Total COMPRAS 120,00D
Valor total desta fatura R$ 120,00 D
`;

describe("fatura Caixa com anuidade sem data", () => {
  it("lê a anuidade e a soma fecha com o total da fatura", () => {
    expect(isCaixaInvoice(FATURA)).toBe(true);
    const txns = parseCaixaInvoice(FATURA, 2026);
    const anuidade = txns.find((t) => t.description.startsWith("ANUIDADE"));
    expect(anuidade).toEqual({ date: "2026-09-30", description: "ANUIDADE DIFERENCIADA TIT 04/12", amount: 17.25 });
    const soma = txns.reduce((a, t) => a + t.amount, 0);
    expect(soma.toFixed(2)).toBe("120.00");
  });
});
