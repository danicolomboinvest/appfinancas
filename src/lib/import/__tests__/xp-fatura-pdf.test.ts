import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { detectDocKind } from "../detect";
import { isFaturaSummaryLine } from "../fatura-lines";
import { parseStatementComLeitor } from "../statement-parser";

/** Fatura FICTÍCIA com a estrutura do PDF do cartão XP: boleto na 1ª página com "Pagamento
 * total", ano com 2 dígitos, colunas R$ e US$, encargos só com R$, dois cartões. */
const XP = [
  "Olá, PESSOA! Chegou sua fatura",
  "Vencimento",
  "01/10/2026",
  "Pagamento total",
  "R$ 1.000,00",
  "Beneficiário",
  "Banco XP S.A. - CNPJ: 00.000.000/0001-00",
  "Data do Documento",
  "25/09/2026",
  "Resumo da sua fatura Cartão XP Visa Infinite R$",
  "Total da fatura anterior \t2.000,00",
  "Pagamentos/créditos até a emissão da fatura \t-2.000,00",
  "Despesas até a emissão desta fatura \t1.000,00",
  "Valor total devido \t1.000,00",
  "PESSOA EXEMPLO - 4998********0000",
  "Data \tDescrição \tR$ \tUS$",
  "26/02/26 \tLOJA EXEMPLO - Parcela 7/12 \t124,75 \t0,00",
  "02/09/26 APP DE TRANSPORTE \t27,94 \t0,00",
  "06/09/26 SITE EXEMPLO.COM \t229,00 \t44,91",
  "06/09/26 IOF Transacoes Exterior R$ \t8,02",
  "Subtotal \t389,71",
  "PESSOA EXEMPLO - 4998********1111",
  "Data \tDescrição \tR$ \tUS$",
  "02/09/26 Pagamentos Validos Normais \t-2.000,00",
  "06/09/26 RESTAURANTE EXEMPLO \t500,00 \t0,00",
  "24/09/26 \tMulta Contratual \t100,00",
  "24/09/26 \tJuros de Mora \t10,29",
  "Subtotal \t610,29",
].join("\n");

describe("fatura do cartão XP em PDF", () => {
  it("é reconhecida como fatura", () => {
    expect(detectDocKind(XP).kind).toBe("fatura");
  });

  it("lê todas as linhas (não só o 'Pagamento total' do boleto) e fecha com as despesas", () => {
    const { txns, leitor } = parseStatementComLeitor(XP, "pdf", 2026);
    expect(leitor).toBe("xp-fatura");
    const compras = txns.filter((t) => !isFaturaSummaryLine(t));
    expect(compras.map((t) => t.amount)).toEqual([124.75, 27.94, 229, 8.02, 500, 100, 10.29]);
    expect(compras[0].date).toBe("2026-02-26");
    expect(compras[3].description).toBe("IOF Transacoes Exterior");
    expect(txns.some((t) => t.amount === -2000 && isFaturaSummaryLine(t))).toBe(true);
    expect(conferirLeitura(XP, "fatura", compras).status).toBe("fechou");
  });
});
