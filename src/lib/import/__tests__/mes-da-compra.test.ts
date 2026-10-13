import { describe, expect, it } from "vitest";
import {
  ajustarAnoDaCompra,
  contextoDaFatura,
  diaDaParcela,
  lerDatasDaFatura,
  listaDeMeses,
  mesDaCompra,
  mesesDaMesmaFaturaAntiga,
  mesesDasCompras,
  pagamentoDoCartao,
  pagamentoTemFatura,
  somarMeses,
  type ContextoDaFatura,
} from "../mes-da-compra";
import { parseStatementComLeitor } from "../statement-parser";

/** Fatura que fecha em 05/09 e vence em 12/09/2026 (ciclo de compras 06/08 a 05/09). */
const SETEMBRO: ContextoDaFatura = contextoDaFatura({ vencimento: "2026-09-12", fechamento: "2026-09-05" }, []);
const chave = (d: { mes: { year: number; month: number } }) => `${d.mes.year}-${String(d.mes.month).padStart(2, "0")}`;

describe("mês de cada compra da fatura", () => {
  it("compra à vista conta no mês em que foi feita, com o dia", () => {
    expect(mesDaCompra({ date: "2026-08-20", description: "MERCADO" }, SETEMBRO)).toEqual({ mes: { year: 2026, month: 8 }, dia: "2026-08-20", origem: "compra" });
    expect(mesDaCompra({ date: "2026-09-03", description: "FARMACIA" }, SETEMBRO)).toMatchObject({ mes: { year: 2026, month: 9 }, dia: "2026-09-03" });
  });

  it("virada de ano: compra de dezembro na fatura que vence em janeiro fica no ano anterior", () => {
    const janeiro = contextoDaFatura({ vencimento: "2027-01-10", fechamento: null }, ["2027-12-15", "2027-01-02"]);
    // O leitor completou o ano com o do vencimento: 15/12/2027 não pode estar nesta fatura.
    expect(ajustarAnoDaCompra("2027-12-15", "2027-01-10")).toBe("2026-12-15");
    expect(mesDaCompra({ date: "2027-12-15", description: "PRESENTE" }, janeiro)).toMatchObject({ mes: { year: 2026, month: 12 }, dia: "2026-12-15" });
    expect(mesDaCompra({ date: "2027-01-02", description: "PADARIA" }, janeiro)).toMatchObject({ mes: { year: 2027, month: 1 } });
    // Ano já certo não mexe.
    expect(ajustarAnoDaCompra("2026-12-15", "2027-01-10")).toBe("2026-12-15");
  });

  it("parcela com a data da compra ORIGINAL: a parcela k conta no mês da compra + (k - 1), no dia da compra", () => {
    // Santander: "31/12 LOJA PARCELADA 09/10" na fatura de setembro. Agosto tem 31: dia 31.
    expect(mesDaCompra({ date: "2025-12-31", description: "LOJA PARCELADA PARC 09/10" }, SETEMBRO)).toEqual({ mes: { year: 2026, month: 8 }, dia: "2026-08-31", origem: "parcela" });
    // O BTG: "Amazon Marketplace Cc (7/10)" com a compra de 15/02 cai em 15/08, não em "Sem data".
    expect(mesDaCompra({ date: "2026-02-15", description: "Amazon Marketplace Cc (7/10)" }, SETEMBRO)).toEqual({ mes: { year: 2026, month: 8 }, dia: "2026-08-15", origem: "parcela" });
    // Bradesco/Itaú escrevem "11/12" sem a palavra parcela: vale também, se o mês cai no ciclo.
    expect(mesDaCompra({ date: "2025-10-21", description: "LOJA 11/12 CIDADE" }, SETEMBRO)).toMatchObject({ mes: { year: 2026, month: 8 }, origem: "parcela" });
  });

  it("dia 31 num mês de 30 vira 30; 29 em fevereiro sem bissexto vira 28", () => {
    expect(diaDaParcela("2026-01-31", { year: 2026, month: 4 })).toBe("2026-04-30");
    expect(diaDaParcela("2025-11-29", { year: 2026, month: 2 })).toBe("2026-02-28");
    expect(diaDaParcela("2026-03-05", { year: 2026, month: 10 })).toBe("2026-10-05");
  });

  it("parcela com a data da cobrança DENTRO do ciclo (Nubank): conta no mês dessa data", () => {
    const nubank = contextoDaFatura({ vencimento: "2026-09-14", fechamento: "2026-09-07" }, []);
    expect(mesDaCompra({ date: "2026-08-07", description: "Loja Exemplo - Parcela 4/4" }, nubank)).toEqual({ mes: { year: 2026, month: 8 }, dia: "2026-08-07", origem: "parcela" });
  });

  it("a parcela nunca conta depois do fechamento desta fatura", () => {
    // Leitor que trouxesse a data da cobrança como se fosse a compra: 4/12 a partir de 01/09 iria pra dezembro.
    const d = mesDaCompra({ date: "2026-07-01", description: "ANUIDADE PARC 04/12" }, SETEMBRO);
    expect(chave(d)).toBe("2026-09");
  });

  it("data antiga que não fecha como parcela vai pro começo do ciclo, nunca pra um mês lá atrás", () => {
    expect(mesDaCompra({ date: "2026-03-10", description: "AJUSTE SEM PARCELA" }, SETEMBRO)).toEqual({ mes: { year: 2026, month: 8 }, dia: null, origem: "ciclo" });
  });

  it("sem data: mês do vencimento lido; sem vencimento, o mês de hoje", () => {
    expect(mesDaCompra({ date: "", description: "X" }, SETEMBRO)).toEqual({ mes: { year: 2026, month: 9 }, dia: null, origem: "vencimento" });
    const nada = contextoDaFatura({ vencimento: null, fechamento: null }, []);
    expect(mesDaCompra({ date: "", description: "X" }, nada, new Date(2026, 9, 12))).toEqual({ mes: { year: 2026, month: 10 }, dia: null, origem: "hoje" });
  });

  it("parcelas de faturas seguidas se encaixam: a projeção de uma é o mês que a próxima calcula", () => {
    // Compra em 20/08 em 3x. Fatura de setembro traz a 1/3; a de outubro traz a 2/3 (com a data 20/08).
    const outubro = contextoDaFatura({ vencimento: "2026-10-12", fechamento: "2026-10-05" }, []);
    const p1 = mesDaCompra({ date: "2026-08-20", description: "LOJA PARC 01/03" }, SETEMBRO).mes;
    const p2 = mesDaCompra({ date: "2026-08-20", description: "LOJA PARC 02/03" }, outubro).mes;
    expect(p2).toEqual(somarMeses(p1, 1)); // a projeção da 2/3 que a fatura de setembro lança
    // Compra no último dia do ciclo anterior (03/09): 1/3 em setembro, 2/3 em outubro.
    const q1 = mesDaCompra({ date: "2026-09-03", description: "LOJA PARC 01/03" }, SETEMBRO).mes;
    const q2 = mesDaCompra({ date: "2026-09-03", description: "LOJA PARC 02/03" }, outubro).mes;
    expect(q2).toEqual(somarMeses(q1, 1));
  });

  it("os meses das compras e a frase", () => {
    const linhas = [
      { date: "2026-08-20", description: "MERCADO" },
      { date: "2026-09-03", description: "FARMACIA" },
      { date: "2025-12-31", description: "LOJA PARC 09/10" },
    ];
    expect(mesesDasCompras(linhas, SETEMBRO)).toEqual(["2026-08", "2026-09"]);
    expect(listaDeMeses(["2026-08", "2026-09"])).toBe("agosto e setembro");
    expect(listaDeMeses(["2026-07", "2026-08", "2026-09"])).toBe("julho, agosto e setembro");
    expect(listaDeMeses(["2026-12", "2027-01"])).toBe("dezembro de 2026 e janeiro de 2027");
  });
});

describe("vencimento e fechamento lidos da fatura", () => {
  it("Nubank: vence no 'FATURA 14 SET', fecha na emissão", () => {
    expect(lerDatasDaFatura("FATURA 14 SET 2026 EMISSÃO E ENVIO 07 SET 2026\nTRANSAÇÕES DE 07 AGO A 07 SET")).toEqual({ vencimento: "2026-09-14", fechamento: "2026-09-07" });
  });
  it("PicPay: as duas datas antes dos rótulos", () => {
    expect(lerDatasDaFatura("PESSOA,\n15/09/2026 | 09/09/2026\tVencimento: Fechamento:\nPicPay")).toEqual({ vencimento: "2026-09-15", fechamento: "2026-09-09" });
  });
  it("C6, Sicoob e Santander", () => {
    expect(lerDatasDaFatura("Compras e pagamentos feitos até o fechamento desta fatura em 18/09/26.").fechamento).toBe("2026-09-18");
    expect(lerDatasDaFatura("DATA DE FECHAMENTO DA FATURA 29/06/2026").fechamento).toBe("2026-06-29");
    expect(lerDatasDaFatura("compras e pagamentos realizados\naté 21/12.\nVencimento\n05/01/2027")).toEqual({ vencimento: "2027-01-05", fechamento: "2026-12-21" });
  });
  it("não inventa: 'fechamento da próxima fatura' e fechamento depois do vencimento não valem", () => {
    expect(lerDatasDaFatura("Vencimento 10/10/2026\nFechamento da próxima fatura 03/11/2026").fechamento).toBeNull();
    expect(lerDatasDaFatura("Vencimento 10/10/2026\nFechamento: 03/11/2026").fechamento).toBeNull();
  });

  it("fatura de exemplo do Nubank inteira: 6 linhas, nenhuma pergunta, agosto e setembro", () => {
    const texto = [
      "Nu Pagamentos S.A.",
      "FATURA 14 SET 2026 EMISSÃO E ENVIO 07 SET 2026",
      "RESUMO DA FATURA ATUAL",
      "TRANSAÇÕES DE 07 AGO A 07 SET",
      "07 AGO •••• 0000 Loja Exemplo - Parcela 4/4 R$ 50,00",
      "27 AGO 99Food - NuPay R$ 30,00",
      "04 SET Estorno de iFood - NuPay −R$ 10,00",
      "Em cumprimento à regulação do Banco Central, as suas operações de crédito...",
    ].join("\n");
    const datas = lerDatasDaFatura(texto);
    const { txns } = parseStatementComLeitor(texto, "pdf", 2026);
    const ctx = contextoDaFatura(datas, txns.map((t) => t.date));
    expect(mesesDasCompras(txns, ctx)).toEqual(["2026-08", "2026-09"]);
    expect(txns.map((t) => mesDaCompra(t, ctx).origem)).toEqual(["parcela", "compra", "compra"]);
  });
});

describe("a mesma fatura gravada no modelo antigo (tudo num mês, sem dia)", () => {
  const itens = [
    { valor: 150, descricao: "MERCADO" },
    { valor: 80, descricao: "FARMACIA" },
    { valor: 39.9, descricao: "NETFLIX" },
    { valor: 100, descricao: "LOJA PARC 03/10" },
  ];
  it("acha o mês em que o lote antigo pôs a fatura", () => {
    const antigos = [
      { loteId: "L1", year: 2026, month: 9, valor: 150, descricao: "MERCADO" },
      { loteId: "L1", year: 2026, month: 9, valor: 80, descricao: "farmacia " },
      { loteId: "L1", year: 2026, month: 9, valor: 39.9, descricao: "NETFLIX" },
      { loteId: "L1", year: 2026, month: 9, valor: 100, descricao: "LOJA PARC 03/10" },
    ];
    expect(mesesDaMesmaFaturaAntiga(itens, antigos)).toEqual([{ year: 2026, month: 9 }]);
  });
  it("a assinatura de todo mês sozinha não faz a fatura passada parecer esta", () => {
    const antigos = [
      { loteId: "L0", year: 2026, month: 8, valor: 39.9, descricao: "NETFLIX" },
      { loteId: "L0", year: 2026, month: 8, valor: 300, descricao: "POSTO" },
      { loteId: "L0", year: 2026, month: 8, valor: 45, descricao: "UBER" },
    ];
    expect(mesesDaMesmaFaturaAntiga(itens, antigos)).toEqual([]);
  });
  it("parcela projetada por outra fatura não conta", () => {
    const antigos = [{ loteId: "L0", year: 2026, month: 9, valor: 100, descricao: "LOJA PARC 03/10" }];
    expect(mesesDaMesmaFaturaAntiga([{ valor: 100, descricao: "LOJA PARC 03/10" }, { valor: 5, descricao: "X" }], antigos)).toEqual([]);
  });
});

describe("pagamento da fatura no extrato", () => {
  const compraNova = (entryDate: string, descricao = "MERCADO") => ({ year: Number(entryDate.slice(0, 4)), month: Number(entryDate.slice(5, 7)), entryDate, descricao });
  it("com a fatura dele no app (modelo novo, compras do ciclo): só mudei de conta, fica de fora", () => {
    expect(pagamentoTemFatura("2026-09-12", [compraNova("2026-08-20"), compraNova("2026-09-03")])).toBe(true);
    expect(pagamentoDoCartao("2026-09-12", [compraNova("2026-09-03")])).toMatchObject({ ignorar: true, nota: expect.stringMatching(/só mudou de conta/) });
  });
  it("só a fatura ANTERIOR no app: o pagamento entra como gasto do cartão, já classificado", () => {
    // Compras até 05/08 são da fatura paga em agosto, não da de 12/09.
    expect(pagamentoTemFatura("2026-09-12", [compraNova("2026-07-20"), compraNova("2026-08-05")])).toBe(false);
    expect(pagamentoDoCartao("2026-09-12", [])).toEqual({
      parentCategory: "OUTROS",
      customCategoryId: null,
      subcategory: "Cartão de crédito",
      autoClassified: true,
      nota: expect.stringMatching(/trouxer a fatura depois/),
    });
  });
  it("modelo antigo (fatura inteira no mês do vencimento, sem dia): o mês do pagamento, ou o vizinho na virada", () => {
    const antiga = (year: number, month: number, descricao = "MERCADO") => ({ year, month, entryDate: null, descricao });
    expect(pagamentoTemFatura("2026-09-12", [antiga(2026, 9)])).toBe(true);
    expect(pagamentoTemFatura("2026-09-12", [antiga(2026, 8)])).toBe(false);
    expect(pagamentoTemFatura("2026-09-29", [antiga(2026, 10)])).toBe(true); // vence 02/10, pagou antes
    expect(pagamentoTemFatura("2026-10-02", [antiga(2026, 9)])).toBe(true); // venceu 30/09, pagou depois
  });
  it("parcela projetada por fatura antiga não conta como 'a fatura está no app'", () => {
    expect(pagamentoTemFatura("2026-09-12", [{ year: 2026, month: 9, entryDate: null, descricao: "SOFA PARC 05/10" }])).toBe(false);
  });
});
