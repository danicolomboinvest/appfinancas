import { describe, expect, it } from "vitest";
import { isFaturaSummaryLine } from "../fatura-lines";
import { lerFaturaTestando } from "../leitor-inteligente";
import { parseStatementComLeitor, type ParsedTransaction } from "../statement-parser";

/**
 * Faturas FICTÍCIAS de um "Banco Exemplo" que nenhum leitor próprio conhece. Cada uma tropeça
 * num dos jeitos que os bancos reais têm de escrever a fatura; o leitor tem que achar a leitura
 * certa sozinho, conferindo com o total impresso — e não inventar nada quando não fecha.
 */
const cabeca = (total: string) => [
  "BANCO EXEMPLO S.A. - Fatura do cartão",
  "Vencimento 10/10/2026",
  "Fatura fechada em 29/09/2026",
  `Total da fatura R$ ${total}`,
];
const compras = (txns: ParsedTransaction[]) => txns.filter((t) => !isFaturaSummaryLine(t));

describe("leitor que testa jeitos de ler (fatura de banco desconhecido)", () => {
  it("data no meio da linha e o menos DEPOIS do valor", () => {
    const texto = [
      ...cabeca("150,00"),
      "Lançamentos",
      "PAGAMENTO DE FATURA\t08/09 BR R$ 500,00-",
      "LOJA UM CIDADE\t31/08 BR R$ 100,00",
      "LOJA DOIS PARC 01/03 CIDADE\t22/09 BR R$ 50,00",
    ].join("\n");
    const txns = lerFaturaTestando(texto, 2026)!;
    expect(compras(txns)).toEqual([
      { date: "2026-08-31", description: "LOJA UM CIDADE", amount: 100 },
      { date: "2026-09-22", description: "LOJA DOIS PARC 01/03 CIDADE", amount: 50 },
    ]);
  });

  it("valor algumas linhas abaixo, pulando a frase de explicação", () => {
    const texto = [
      ...cabeca("130,00"),
      "Transações de 29 AGO a 29 SET",
      "05 SET Servico Exterior",
      "USD 10.00",
      "Conversão: USD 1 = R$ 5,00",
      "R$ 50,00",
      "07 SET Pix Parcelado - Parcela 2/4",
      "Total a pagar: R$ 320,00 (valor da transação de R$ 300,00 + R$ 20,00 de juros).",
      "R$ 80,00",
    ].join("\n");
    expect(compras(lerFaturaTestando(texto, 2026)!).map((t) => t.amount)).toEqual([50, 80]);
  });

  it("vários números na linha: o valor certo é o da coluna da data, não a cotação ao lado", () => {
    const texto = [
      ...cabeca("62,22"),
      "Lançamentos",
      "15/09 SERVICO EXTERIOR 42,22\tUSD 7,76 | Cotação USD: R$ 5,44",
      "16/09 PADARIA 20,00",
    ].join("\n");
    expect(compras(lerFaturaTestando(texto, 2026)!).map((t) => t.amount)).toEqual([42.22, 20]);
  });

  it("parcelas da PRÓXIMA fatura ficam de fora, e a compra de novembro é do ano passado", () => {
    const texto = [
      ...cabeca("110,00"),
      "Lançamentos",
      "28/11 LOJA ANTIGA PARC 10/10 60,00",
      "02/09 MERCADO 50,00",
      "Parcelamentos Próxima Fatura",
      "02/09 LOJA FUTURA PARC 02/03 40,00",
    ].join("\n");
    const txns = compras(lerFaturaTestando(texto, 2026)!);
    expect(txns.map((t) => [t.date, t.amount])).toEqual([
      ["2025-11-28", 60],
      ["2026-09-02", 50],
    ]);
  });

  it("estorno sem sinal se reconhece pelo nome; compra e estorno se anulam", () => {
    const texto = [...cabeca("120,00"), "Lançamentos", "10 set LOJA 120,00", "11 set TARIFA 30,00", "12 set Estorno Tarifa 30,00"].join("\n");
    expect(compras(lerFaturaTestando(texto, 2026)!).map((t) => t.amount)).toEqual([120, 30, -30]);
  });

  it("não fechou com o total: devolve null e o app segue como antes (não inventa)", () => {
    const texto = [...cabeca("999,00"), "Lançamentos", "10/09 LOJA 100,00", "11/09 MERCADO 50,00"].join("\n");
    expect(lerFaturaTestando(texto, 2026)).toBeNull();
  });

  it("uma linha que é o próprio total não conta como 'fechou'", () => {
    const texto = [...cabeca("150,00"), "Lançamentos", "10/09 Cartão final 1234 150,00"].join("\n");
    expect(lerFaturaTestando(texto, 2026)).toBeNull();
  });

  it("extrato não passa pelo leitor de fatura", () => {
    expect(lerFaturaTestando("Extrato de conta corrente\nSaldo anterior 10,00\n10/09 PIX RECEBIDO 100,00", 2026)).toBeNull();
  });

  it("no app: fatura de banco desconhecido é lida pelo leitor 'inteligente'", () => {
    const texto = [...cabeca("150,00"), "Lançamentos", "LOJA UM CIDADE\t31/08 BR R$ 100,00", "LOJA DOIS CIDADE\t22/09 BR R$ 50,00"].join("\n");
    expect(parseStatementComLeitor(texto, "pdf", 2026).leitor).toBe("inteligente");
  });
});
