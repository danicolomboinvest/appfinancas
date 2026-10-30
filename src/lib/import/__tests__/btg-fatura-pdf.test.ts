import { describe, expect, it } from "vitest";
import { isBtgInvoice, parseBtgInvoice } from "../btg-fatura-pdf";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { parseStatementComLeitor } from "../statement-parser";

/** Fatura BTG/EQI fictícia, no layout do PDF real (texto como sai da extração, com TAB). */
const BTG = [
  "Olá, Fulana! Esta é a fatura do seu cartão EQI de",
  "Junho no valor a pagar de R$ 1.103,44",
  "Fulana Exemplo | fatura de Junho de 2026 | cartão final 0000",
  "Mensalidade R$ 160,00",
  "Desconto -R$ 160,00",
  "Resumo da Fatura Atual",
  "Total de compras e despesas R$ 1.153,44",
  "Total de créditos recebidos -R$ 50,00",
  "Total da fatura anterior R$ 900,00",
  "Total de pagamentos feitos pelo cliente -R$ 900,00",
  "Total a pagar R$ 1.103,44",
  "BTG Pactual S.A",
  "-- 1 of 3 --",
  "Pagamentos feitos pelo cliente",
  "- R$ 900,00\tPagamento de fatura\t18 Mai",
  "-R$ 900,00",
  "Lançamentos do cartão físico | Fulana Exemplo | Final 0000 Total do cartão: R$ 550,00",
  "Total de créditos recebidos",
  "- R$ 30,00\tCashback Exemplo\t16 Mai - R$ 20,00\tCancelamento - Loja\t08 Jun",
  "-R$ 50,00",
  "Total de compras e despesas",
  "R$ 500,00\tHospital Exemplo (4/5)\t27 Fev",
  "R$ 100,00\tMercado Exemplo\t13 Mai",
  "R$ 600,00",
  "Lançamentos do cartão virtual | Fulana Exemplo | Final 1111 Total do cartão: R$ 553,44",
  "Total de compras e despesas",
  "R$ 89,00\tAssinatura Exemplo (12/12)\t10 Jul",
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
  "R$ 89,67\tLoja Exemplo\t01 Jun",
  "R$ 553,44",
  "BTG Pactual S.A",
].join("\n");

describe("fatura do cartão BTG Pactual / EQI (PDF)", () => {
  it("reconhece o arquivo", () => {
    expect(isBtgInvoice(BTG)).toBe(true);
    expect(isBtgInvoice("BTG Pactual\nExtrato de conta corrente\n01/06 PIX 10,00")).toBe(false);
  });

  it("lê valor-nome-data, créditos na mesma linha, moeda estrangeira pelo valor em real, e deixa de fora pagamento e subtotais", () => {
    expect(parseBtgInvoice(BTG, 2026)).toEqual([
      { date: "2026-05-16", description: "Cashback Exemplo", amount: -30 },
      { date: "2026-06-08", description: "Cancelamento - Loja", amount: -20 },
      { date: "2026-02-27", description: "Hospital Exemplo (4/5)", amount: 500 },
      { date: "2026-05-13", description: "Mercado Exemplo", amount: 100 },
      { date: "2025-07-10", description: "Assinatura Exemplo (12/12)", amount: 89 },
      { date: "2026-05-15", description: "Serviço Exemplo", amount: 190.07 },
      { date: "2026-06-14", description: "Uber", amount: 184.7 },
      { date: "2026-06-01", description: "Loja Exemplo", amount: 89.67 },
    ]);
  });

  it("é o leitor usado pro PDF, e fecha com o total da fatura", () => {
    const { txns, leitor } = parseStatementComLeitor(BTG, "pdf", 2026);
    expect(leitor).toBe("btg-fatura");
    const linhas = txns.filter((t) => !isFaturaSummaryLine(t));
    expect(conferirLeitura(BTG, "fatura", linhas)).toMatchObject({ status: "fechou" });
  });
});

describe("fatura BTG: moeda estrangeira com a conversão fora do lugar", () => {
  // Layout de quando a página vira: a conversão da compra em dólar vai para o topo da página
  // seguinte, depois de outras compras em dólar. E o subtotal do cartão aparece antes da cotação.
  const VIRADA = [
    "Fulana Exemplo | fatura de Agosto de 2026 | cartão final 0000",
    "Vencimento: 17/08",
    "Lançamentos do cartão virtual | Fulana Exemplo | Final 1111 Total do cartão: R$ 1.000,00",
    "Total de créditos recebidos",
    "EUR 10,00\tLocadora Exemplo\t01 Ago",
    "Cotação da moeda -",
    "Conversão para Real -",
    "R$ 6,20",
    "-R$ 62,00",
    "-R$ 62,00",
    "Total de compras e despesas",
    "R$ 100,00\tLoja Exemplo (12/12)\t18 Ago",
    "US$ 20,00\tServiço Exemplo A\t01 Ago",
    "R$ 300,00",
    "US$ 100,00\tServiço Exemplo B\t30 Jul",
    "R$ 50,00\tMercado Exemplo\t01 Ago",
    "US$ 5,00\tServiço Exemplo C\t06 Ago",
    "Cotação da moeda -",
    "Conversão para Real -",
    "R$ 5,50",
    "R$ 27,50",
    "Cotação da moeda -",
    "Conversão para Real -",
    "R$ 5,40",
    "R$ 108,00",
    "-- 3 of 4 --",
    "Cotação da moeda -",
    "Conversão para Real -",
    "R$ 5,48",
    "R$ 548,00",
    "BTG Pactual S.A",
  ].join("\n");

  it("cada compra fica com a conversão cuja conta fecha, e o subtotal não vira cotação", () => {
    const txns = parseBtgInvoice(VIRADA, 2026);
    const porNome = Object.fromEntries(txns.map((t) => [t.description, t.amount]));
    expect(porNome["Serviço Exemplo A"]).toBe(108);
    expect(porNome["Serviço Exemplo B"]).toBe(548);
    expect(porNome["Serviço Exemplo C"]).toBe(27.5);
  });

  it("estorno em outra moeda sai negativo mesmo com o '-' só no valor em real", () => {
    const txns = parseBtgInvoice(VIRADA, 2026);
    expect(txns.find((t) => t.description === "Locadora Exemplo")?.amount).toBe(-62);
  });

  it("parcela com data depois do vencimento é do ano anterior", () => {
    const txns = parseBtgInvoice(VIRADA, 2026);
    expect(txns.find((t) => t.description === "Loja Exemplo (12/12)")?.date).toBe("2025-08-18");
    expect(txns.find((t) => t.description === "Mercado Exemplo")?.date).toBe("2026-08-01");
  });
});

describe("fatura BTG/EQI: conversão em outra moeda fora do lugar", () => {
  // Layout da quebra de página: a compra em dólar fica numa página e o bloco "Cotação / Conversão"
  // dela desce para depois do cabeçalho da página seguinte, DEPOIS da conversão de outra compra.
  const QUEBRA = [
    "Olá, Fulana! Esta é a fatura do seu cartão EQI de",
    "Julho no valor a pagar de R$ 1.000,00",
    "Fulana Exemplo | fatura de Julho de 2026 | cartão final 0000",
    "Total a pagar R$ 1.000,00",
    "BTG Pactual S.A",
    "Lançamentos do cartão virtual | Fulana Exemplo | Final 0000 Total do cartão: R$ 1.000,00",
    "Total de compras e despesas",
    "US$ 100,00\tServico Exemplo\t30 Jun",
    "R$ 200,00\tLoja Exemplo\t01 Jul",
    "US$ 10,00\tApp Exemplo\t06 Jul",
    "Cotação da moeda -",
    "Conversão para Real -",
    "R$ 5,00",
    "R$ 50,00",
    "R$ 1.000,00",
    "-- 3 of 4 --",
    "Cotação da moeda -",
    "Conversão para Real -",
    "R$ 5,50",
    "R$ 550,00",
  ].join("\n");

  it("acha o par cotação × valor pela conta, não pela ordem", () => {
    const txns = parseBtgInvoice(QUEBRA, 2026);
    expect(txns.map((t) => [t.description, t.amount])).toEqual([
      ["Servico Exemplo", 550],
      ["Loja Exemplo", 200],
      ["App Exemplo", 50],
    ]);
  });

  it("crédito em moeda estrangeira leva o sinal do valor em real", () => {
    const texto = [
      "Fulana Exemplo | fatura de Agosto de 2026 | cartão final 0000",
      "BTG Pactual S.A",
      "Lançamentos do cartão físico | Fulana Exemplo | Final 0000 Total do cartão: R$ 90,00",
      "Total de créditos recebidos",
      "EUR 10,00\tEstorno Exemplo\t01 Ago",
      "Cotação da moeda -",
      "Conversão para Real -",
      "R$ 6,00",
      "-R$ 60,00",
      "Total de compras e despesas",
      "R$ 150,00\tLoja Exemplo\t02 Ago",
      "R$ 90,00",
    ].join("\n");
    expect(parseBtgInvoice(texto, 2026).map((t) => t.amount)).toEqual([-60, 150]);
  });
});

describe("fatura BTG/EQI: compras iguais em dólar não trocam o valor em real", () => {
  // Três compras de US$ 10,00: duas em 08 Out (cotação 5,29) e uma em 19 Set (cotação 5,46). A
  // cotação do 19 Set desceu para depois da quebra de página. Qualquer par fecha a conta de US$ 10.
  const TEXTO = [
    "Fulana Exemplo | fatura de Outubro de 2026 | cartão final 0000",
    "BTG Pactual S.A",
    "Lançamentos do cartão físico | Fulana Exemplo | Final 0000 Total do cartão: R$ 160,00",
    "Total de compras e despesas",
    "US$ 10,00\tApp Exemplo\t18 Set",
    "Cotação da moeda -",
    "Conversão para Real -",
    "R$ 5,46",
    "R$ 54,60",
    "US$ 10,00\tApp Exemplo\t19 Set",
    "US$ 10,00\tApp Exemplo\t08 Out",
    "Cotação da moeda -",
    "Conversão para Real -",
    "R$ 5,29",
    "R$ 52,90",
    "US$ 10,00\tApp Exemplo\t08 Out",
    "Cotação da moeda -",
    "Conversão para Real -",
    "R$ 5,29",
    "R$ 52,90",
    "-- 2 of 3 --",
    "Cotação da moeda -",
    "Conversão para Real -",
    "R$ 5,47",
    "R$ 54,70",
  ].join("\n");

  it("cada compra fica com a cotação do dia mais perto da sua data", () => {
    const txns = parseBtgInvoice(TEXTO, 2026);
    expect(txns.map((t) => [t.date, t.amount])).toEqual([
      ["2026-09-18", 54.6],
      ["2026-09-19", 54.7],
      ["2026-10-08", 52.9],
      ["2026-10-08", 52.9],
    ]);
  });
});

describe("fatura BTG: mensalidade só no resumo e sobra da fatura anterior", () => {
  // Compras 1.000,00 + mensalidade 90,00 (já com desconto) + encargos 5,00, menos 300,00 que
  // sobraram de pagamento a mais na fatura anterior = total a pagar 795,00.
  const MENSALIDADE = [
    "Olá, Fulana! Esta é a fatura do seu cartão EQI de",
    "Junho no valor a pagar de R$ 795,00",
    "Fulana Exemplo | fatura de Junho de 2026 | cartão final 0000",
    "Vencimento: 11/06",
    "Mensalidade R$ 120,00",
    "Desconto -R$ 30,00",
    "Resumo da Fatura Atual",
    "Compras à vista R$ 1.000,00",
    "Outros valores R$ 90,00",
    "Mensalidade do cartão de crédito R$ 90,00",
    "Total de compras e despesas R$ 1.090,00",
    "Total de compras e despesas dessa fatura R$ 1.090,00",
    "Saldo fatura anterior e pagamentos -R$ 300,00",
    "Total da fatura anterior R$ 500,00",
    "Total de pagamentos feitos pelo cliente -R$ 800,00",
    "Total a pagar R$ 795,00",
    "Juros e encargos R$ 5,00",
    "-- 2 of 3 --",
    "Encargos e juros",
    "R$ 2,00\tIOF rotativo\t07 Jun R$ 3,00\tEncargos por atraso\t07 Jun",
    "R$ 5,00",
    "Lançamentos do cartão físico | Fulana Exemplo | Final 0000 Total do cartão: R$ 1.000,00",
    "Total de compras e despesas",
    "R$ 600,00\tLoja Exemplo\t08 Mai",
    "R$ 400,00\tMercado Exemplo\t09 Mai",
    "R$ 1.000,00",
    "BTG Pactual S.A",
  ].join("\n");

  it("lança a mensalidade do resumo e a leitura fecha com o total a pagar", () => {
    const { txns, leitor } = parseStatementComLeitor(MENSALIDADE, "pdf", 2026);
    expect(leitor).toBe("btg-fatura");
    expect(txns).toContainEqual({ date: "2026-06-11", description: "Mensalidade cartão de crédito", amount: 90 });
    const linhas = txns.filter((t) => !isFaturaSummaryLine(t));
    expect(conferirLeitura(MENSALIDADE, "fatura", linhas)).toMatchObject({ status: "fechou" });
  });

  it("não dobra a mensalidade que já vem na lista de lançamentos", () => {
    const comLinha = MENSALIDADE.replace("R$ 1.000,00\nBTG", "R$ 90,00\tMensalidade cartão de crédito\t06 Jun\nR$ 1.090,00\nBTG");
    const txns = parseBtgInvoice(comLinha, 2026);
    expect(txns.filter((t) => /mensalidade/i.test(t.description))).toHaveLength(1);
  });
});
