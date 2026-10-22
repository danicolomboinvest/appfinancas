import { describe, expect, it } from "vitest";
import { isItauTabelaInvoice, parseItauTabelaInvoice } from "../itau-fatura-tabela-pdf";
import { parseStatementComLeitor } from "../statement-parser";
import { isFaturaSummaryLine } from "../fatura-lines";
import { conferirLeitura } from "../conferencia";

// Forma da fatura real de 21/10/2026 (valores e nomes inventados).
const FATURA = [
  "Olá, cliente!",
  "Chegou a sua fatura com",
  "vencimento em outubro!",
  "Total a pagar:",
  "R$ 420,00",
  "Pagamento mínimo:",
  "R$ 63,00",
  "Vencimento:",
  "20/10/2026",
  "Titular: FULANA DE TAL",
  "Cartão final 1234 | Data de emissão: 13/10/2026 | Número da fatura:",
  "1234567890123",
  "R$ 420,00",
  "R$ 400,00",
  "Resumo da fatura",
  "Valor da fatura anterior",
  "Pagamento e créditos",
  "Banco Itaú S.A. \t341-7 \tRecibo do pagador",
  "-- 2 de 3 --",
  "Lançamentos",
  "Data \tDescrição \tValor",
  "Saldo Anterior \tR$ 400,00",
  "15/09/2026 \tPagamento Fatura \tR$ -400,00",
  "Subtotal R$ 0,00",
  "Cartão Virtual - Final 1234 (FULANA DE TAL - Titular)",
  "13/12/2025 \tLOJA EXEMPLO DE ROUPA.10/10 \tR$ 45,90",
  "14/04/2026 \tFARMACIA EXEMPLO.7/10 \tR$ 34,10",
  "30/05/2026 \tMERCADO EXEMPLO.5/6 \tR$ 120,00",
  "28/09/2026 \tPADARIA EXEMPLO.1/2 \tR$ 100,00",
  "Subtotal R$ 300,00",
  "Encargos e Tarifas",
  "Cobranca OverLimit \tR$ 50,00",
  "Encargos \tR$ 10,00",
  "IOF Rotativo \tR$ 5,00",
  "Juros de Mora \tR$ 4,10",
  "Multa Contratual \tR$ 21,00",
  "Tarifa de anuidade diferenciada 09/12 \tR$ 29,90",
  "Subtotal R$ 120,00",
  "Total R$ 420,00",
  "Próximas faturas",
  "Saldo em aberto da próxima fatura \tR$ 154,00",
].join("\n");

describe("fatura Itaú em tabela (22/10/2026)", () => {
  it("reconhece o formato", () => expect(isItauTabelaInvoice(FATURA)).toBe(true));

  it("o cabeçalho não vira compra e os encargos sem data entram na emissão", () => {
    const lidas = parseItauTabelaInvoice(FATURA).filter((t) => !isFaturaSummaryLine(t));
    expect(lidas.map((t) => t.description)).not.toContain(expect.stringMatching(/Cart[ãa]o final/));
    expect(lidas).toHaveLength(10);
    expect(lidas.find((t) => t.description === "Cobranca OverLimit")).toMatchObject({ date: "2026-10-13", amount: 50 });
    expect(lidas.reduce((s, t) => s + t.amount, 0)).toBeCloseTo(420, 2);
  });

  it("pelo caminho do app: este leitor, e a conferência fecha", () => {
    const { txns, leitor } = parseStatementComLeitor(FATURA, "pdf", 2026);
    expect(leitor).toBe("itau-fatura-tabela");
    const lidas = txns.filter((t) => !isFaturaSummaryLine(t));
    expect(conferirLeitura(FATURA, "fatura", lidas).status).toBe("fechou");
  });
});
