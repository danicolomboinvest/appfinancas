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

/** Linha ao contrário (valor, nome, data) com compra em dólar e em euro: o valor em real vem
 * sozinho embaixo, depois da cotação. Era o que impedia a fatura do BTG de fechar sem leitor
 * próprio. "Banco Exemplo", fictício. */
describe("valor antes da data, com compra em outra moeda", () => {
  const texto = [
    "Olá, Fulana! Esta é a fatura do seu cartão Exemplo de",
    "Fulana Exemplo | fatura de Junho de 2026 | cartão final 0000",
    "Total de compras e despesas R$ 563,77",
    "Total a pagar R$ 543,77",
    "Pagamentos feitos pelo cliente",
    "- R$ 900,00\tPagamento de fatura\t18 Mai",
    "-R$ 900,00",
    "Lançamentos do cartão | Fulana Exemplo | Final 0000",
    "Total de créditos recebidos",
    "- R$ 20,00\tCancelamento - Loja\t08 Jun",
    "Total de compras e despesas",
    "R$ 100,00\tMercado Exemplo\t13 Mai",
    "US$ 36,00\tServiço Exemplo\t15 Mai",
    "Cotação da moeda -",
    "Conversão para Real -",
    "R$ 5,27",
    "R$ 190,07",
    "EUR 28,98\tUber\t14 Jun",
    "Cotação da moeda -",
    "Conversão para Real -",
    "R$ 6,37",
    "R$ 184,70",
    "R$ 89,00\tAssinatura Exemplo (12/12)\t10 Jul",
    "R$ 563,77",
  ].join("\n");

  it("lê o valor em real da compra em outra moeda, e a soma fecha", () => {
    const { txns, leitor } = parseStatementComLeitor(texto, "pdf", 2026);
    expect(leitor).toBe("inteligente");
    expect(txns.filter((t) => !isFaturaSummaryLine(t))).toEqual([
      { date: "2026-06-08", description: "Cancelamento - Loja", amount: -20 },
      { date: "2026-05-13", description: "Mercado Exemplo", amount: 100 },
      { date: "2026-05-15", description: "Serviço Exemplo", amount: 190.07 },
      { date: "2026-06-14", description: "Uber", amount: 184.7 },
      { date: "2025-07-10", description: "Assinatura Exemplo (12/12)", amount: 89 },
    ]);
  });
});
