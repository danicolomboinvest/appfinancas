import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { isItauInvoice, parseItauInvoice } from "../itau-fatura-pdf";

// Fatura FICTÍCIA do Itaú com o texto esfarelado (espaço no meio das palavras), inclusive no
// pagamento da fatura anterior, que não pode contar como compra do mês.
const FATURA = `Itaú
Emissão: 03/09/2026
Vencimento: 10/09/2026
L Lançamentos atuais 150,00
= Total desta fatura 150,00
Pa ga me nt os e fet u ad o s
10/08 PAG AM ENT O DEB AU TOM ATIC -400,00
Total dos pagamen tos -400,00
Lança me nt os : co m pr as e sa qu es .
04/08 LOJ A EXE MPLO 100,00
resta urante CIDA DE
17/08 MER CAD O MOD ELO 50,00
outro s CIDA DE
L Total dos lançamen tos atu ais 150,00
`;

describe("fatura Itaú esfarelada com pagamento esfarelado", () => {
  it("lê só as compras do mês e fecha com o total", () => {
    expect(isItauInvoice(FATURA)).toBe(true);
    const txns = parseItauInvoice(FATURA, 2026);
    expect(txns.filter((t) => t.amount > 0)).toHaveLength(2);
    expect(txns.some((t) => t.description === "Pagamento efetuado" && t.amount === -400)).toBe(true);
    const semPagamento = txns.filter((t) => t.description !== "Pagamento efetuado");
    expect(conferirLeitura(FATURA, "fatura", semPagamento).status).toBe("fechou");
  });
});
