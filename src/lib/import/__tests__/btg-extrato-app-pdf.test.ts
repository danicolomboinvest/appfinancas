import { describe, expect, it } from "vitest";
import { isBtgExtratoApp, parseBtgExtratoApp } from "../btg-extrato-app-pdf";
import { parseStatementComLeitor } from "../statement-parser";

// Amostra FICTÍCIA no formato do extrato do app do BTG impresso em PDF.
const amostra = [
  "Extrato",
  "Ordenar",
  "01 de Outubro de 2026, Quinta-feira",
  "02 de Outubro de 2026, Sexta-feira",
  "Saldo Atual",
  "R$ 700,00",
  "Detalhes do Saldo",
  "Saldo Anterior \tR$ 1.000,00",
  "Pix Recebido",
  "Dados Conta",
  "Fulana de Tal",
  "R$ 500,00",
  "01OUT",
  "Pagamento",
  "Telefone",
  "Operadora Exemplo",
  "-R$ 130,99",
  "01OUT",
  "Saldo do dia \tR$ 1.369,01",
  "Credito Juros R$ 0,99",
  "02OUT",
  "Deb Pix Chave",
  "Padaria Exemplo",
  "-R$ 670,00",
  "02OUT",
  "Saldo do dia \tR$ 700,00",
].join("\n");

describe("extrato do app do BTG em PDF", () => {
  it("reconhece e lê descrição em várias linhas, valor e dia", () => {
    expect(isBtgExtratoApp(amostra)).toBe(true);
    const r = parseBtgExtratoApp(amostra);
    expect(r).toEqual([
      { date: "2026-10-01", description: "Pix Recebido Fulana de Tal", amount: 500 },
      { date: "2026-10-01", description: "Pagamento Telefone Operadora Exemplo", amount: -130.99 },
      { date: "2026-10-02", description: "Credito Juros", amount: 0.99 },
      { date: "2026-10-02", description: "Deb Pix Chave Padaria Exemplo", amount: -670 },
    ]);
  });

  it("passa pelo caminho normal de leitura", () => {
    const r = parseStatementComLeitor(amostra, "pdf");
    expect(r.leitor).toBe("btg-extrato-app");
    expect(r.txns).toHaveLength(4);
  });

  it("não devolve nada se a soma não fechar com os saldos impressos", () => {
    expect(parseBtgExtratoApp(amostra.replace("R$ 700,00\nDetalhes", "R$ 701,00\nDetalhes"))).toEqual([]);
  });
});
