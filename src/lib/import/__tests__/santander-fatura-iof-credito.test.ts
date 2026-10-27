import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { parseSantanderInvoice } from "../santander-fatura-pdf";

// Fatura FICTÍCIA do Santander: crédito (devolução) no mês e IOF de compra no exterior sem data.
const FATURA = `Santander
Vencimento 10/10/2026
compras realizadas até 21/09
Total a Pagar R$ 900,00
Detalhamento da Fatura
FULANO DE TAL - 5201 XXXX XXXX 0000
Pagamento e Demais Créditos
Compra Data Descrição \tParcela \tR$ \tUS$
21/09 PAGAMENTO DE FATURA \t-500,00
Despesas
Compra Data Descrição \tParcela \tR$ \tUS$
10/09 LOJA EXEMPLO \t300,00
12/09 DEVOLUCAO LOJA \t-100,00
15/09 SERVICO EXTERIOR \t103,75\t19,00
IOF DESPESA NO EXTERIOR \t3,75
VALOR TOTAL \t303,75 \t19,00
Resumo da Fatura
Saldo Anterior \t500,00
(+) Total Despesas/Débitos no Brasil \t300,00
(+) Total Despesas/Débitos no Exterior \t103,75 \t19,00
(-) Total de pagamentos \t500,00
(-) Total de créditos \t100,00
(=) Saldo Desta Fatura \t307,50
`;

describe("fatura Santander com IOF sem data e crédito", () => {
  it("lê o IOF e a conferência fecha com o saldo desta fatura", () => {
    const txns = parseSantanderInvoice(FATURA, 2026);
    expect(txns.some((t) => t.description.startsWith("IOF") && t.amount === 3.75)).toBe(true);
    const semPagamento = txns.filter((t) => !/PAGAMENTO DE FATURA/.test(t.description));
    expect(conferirLeitura(FATURA, "fatura", semPagamento).status).toBe("fechou");
  });
});
