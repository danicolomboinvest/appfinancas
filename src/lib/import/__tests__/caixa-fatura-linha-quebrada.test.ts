import { describe, expect, it } from "vitest";
import { parseCaixaInvoice } from "../caixa-fatura-pdf";

// Amostra fictícia: nome de parcela longo que quebra em duas linhas.
const FATURA = `CARTÕES CAIXA
VENCIMENTO
27/10/2026
Demonstrativo
Data Descrição Cidade/País Valor U$$ Crédito/Débito
17/09 TOTAL DA FATURA ANTERIOR 100,00D
21/09 OBRIGADO PELO PAGAMENTO 100,00C
COMPRAS (Cartão 0000)
18/09 MERCADO EXEMPLO CIDADE 50,00D
COMPRAS PARCELADAS (Cartão 0000)
19/09 PARC=102LOJA EXEMPLO FARMA 01 DE
02 Cidade 100,00D
21/09 LOJA TESTE 01 DE 03 CIDADE 30,00D
Valor total desta fatura R$ 180,00 D
`;

describe("fatura Caixa: lançamento com o nome quebrado em duas linhas", () => {
  it("junta as duas linhas e não perde a compra", () => {
    const txns = parseCaixaInvoice(FATURA, 2026);
    expect(txns.map((t) => t.amount)).toEqual([50, 100, 30]);
    expect(txns[1].description).toContain("LOJA EXEMPLO FARMA 01 DE 02");
  });
});
