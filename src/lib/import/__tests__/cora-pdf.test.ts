import { describe, expect, it } from "vitest";
import { isCoraStatement, parseCoraStatement } from "../cora-pdf";
import { profileDocument } from "../profile";
import { parseStatement } from "../statement-parser";

/**
 * Extrato FICTÍCIO com a mesma estrutura do PDF da conta Cora: resumo com totais no topo, dia
 * numa linha com "Saldo do dia", lançamentos SEM data com "+ R$"/"- R$" no começo, CPF/CNPJ do
 * outro lado no fim da linha e o cabeçalho repetido na segunda página.
 */
const CORA = [
  "00.000.000 EMPRESA DE EXEMPLO",
  "CNPJ 00.000.000/0001-00",
  "Agência: 0001 - Conta: 0000000-0",
  "Cora SCFI - CNPJ 00.000.000/0001-00",
  "Ouvidoria: 0800 000 0000 dias úteis",
  "Extrato gerado no dia 26/09/2026 às 21:37 pág 1 de 2",
  "01/09/2026 a 30/09/2026",
  "Saldo inicial disponível \tR$ 0,00",
  "Total de entradas \t+ R$ 1.100,00",
  "Total de saídas \t- R$ 1.100,00",
  "Saldo final disponível \tR$ 0,00",
  "25/09/2026 \tSaldo do dia R$ 0,00",
  "- R$ 1.000,00\tTransf Pix enviada \tFULANO DE TAL… 000.000.000-00",
  "+ R$ 1.000,00\tTransferência recebida \tEMPRESA MODELO LTDA \t00.000.000/0001-00",
  "08/09/2026 \tSaldo do dia R$ 0,00",
  "- R$ 100,00\tTransf Pix enviada \tFULANO DE TAL… 000.000.000-00",
  "Transações",
  "-- 1 of 2 --",
  "Extrato gerado no dia 26/09/2026 às 21:37 pág 2 de 2",
  "04/09/2026 \tSaldo do dia R$ 100,00",
  "+ R$ 100,00\tPagamento recebido \tCLIENTE EXEMPLO \t000.000.000-00",
].join("\n");

describe("extrato da conta Cora (PDF)", () => {
  it("reconhece o arquivo e o banco", () => {
    expect(isCoraStatement(CORA)).toBe(true);
    expect(isCoraStatement("Extrato\n01/01/2026 PIX 10,00")).toBe(false);
    expect(profileDocument(CORA).institution).toBe("Cora");
  });

  it("usa a data do dia, o sinal do começo da linha, e ignora os totais do topo", () => {
    expect(parseCoraStatement(CORA)).toEqual([
      { date: "2026-09-25", description: "Transf Pix enviada FULANO DE TAL…", amount: -1000 },
      { date: "2026-09-25", description: "Transferência recebida EMPRESA MODELO LTDA", amount: 1000 },
      { date: "2026-09-08", description: "Transf Pix enviada FULANO DE TAL…", amount: -100 },
      { date: "2026-09-04", description: "Pagamento recebido CLIENTE EXEMPLO", amount: 100 },
    ]);
  });

  it("é o leitor usado pro PDF", () => {
    expect(parseStatement(CORA, "pdf")).toHaveLength(4);
  });
});
