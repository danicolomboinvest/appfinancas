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
  pagamentosDaFatura,
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
    // Mês vizinho de qualquer dia (15/10/2026): ela escolhia o mês da fatura no modo antigo.
    expect(pagamentoTemFatura("2026-09-12", [antiga(2026, 8)])).toBe(true);
    expect(pagamentoTemFatura("2026-09-12", [antiga(2026, 7)])).toBe(false);
    expect(pagamentoTemFatura("2026-09-29", [antiga(2026, 10)])).toBe(true); // vence 02/10, pagou antes
    expect(pagamentoTemFatura("2026-10-02", [antiga(2026, 9)])).toBe(true); // venceu 30/09, pagou depois
  });
  it("parcela projetada por fatura antiga não conta como 'a fatura está no app'", () => {
    expect(pagamentoTemFatura("2026-09-12", [{ year: 2026, month: 9, entryDate: null, descricao: "SOFA PARC 05/10" }])).toBe(false);
  });
  it("compra da última semana antes do pagamento é da fatura SEGUINTE (pago 08/08 com só a fatura de agosto no app)", () => {
    expect(pagamentoTemFatura("2026-08-08", [compraNova("2026-08-01"), compraNova("2026-08-05"), compraNova("2026-08-28")])).toBe(false);
    expect(pagamentoTemFatura("2026-10-08", [compraNova("2026-09-01"), compraNova("2026-09-26")])).toBe(true);
  });
  it("pagamentosDaFatura: um por mês, o de valor mais perto das compras do ciclo", () => {
    const com = (entryDate: string, valor: number) => ({ ...compraNova(entryDate), valor });
    const compras = [com("2026-09-01", 640), com("2026-09-12", 500), com("2026-09-26", 740.47)];
    const pagamentos = [
      { id: "nubank", data: "2026-10-08", valor: 1880.47 },
      { id: "itau", data: "2026-10-10", valor: 3200 },
      { id: "agosto", data: "2026-08-08", valor: 1815.8 },
    ];
    expect([...pagamentosDaFatura(pagamentos, compras)]).toEqual(["nubank"]);
    expect(pagamentosDaFatura([], compras).size).toBe(0);
  });
});

describe("pagamento de fatura com a fatura no modo antigo no mês vizinho, e pagamentos parciais (15/10/2026)", () => {
  const antiga = (year: number, month: number, valor: number, descricao = "MERCADO") => ({ year, month, entryDate: null, descricao, valor });
  const compraNova = (entryDate: string, valor: number, descricao = "MERCADO") => ({ year: Number(entryDate.slice(0, 4)), month: Number(entryDate.slice(5, 7)), entryDate, descricao, valor });

  it("fatura gravada no mês anterior ou seguinte ao pagamento: o pagamento fica de fora", () => {
    expect(pagamentoTemFatura("2026-09-12", [antiga(2026, 8, 1500)], { valor: 1500 })).toBe(true);
    expect(pagamentoTemFatura("2026-09-12", [antiga(2026, 10, 1500)], { valor: 1500 })).toBe(true);
    expect(pagamentoDoCartao("2026-09-12", [antiga(2026, 8, 1500)], { valor: 1500 })).toMatchObject({ ignorar: true });
  });

  it("o vizinho não vale quando outro pagamento cai no mês daquela fatura (ela já tem o pagamento dela)", () => {
    const outrasDatas = ["2026-08-12", "2026-09-12"];
    expect(pagamentoTemFatura("2026-09-12", [antiga(2026, 8, 1500)], { valor: 1500, outrasDatas })).toBe(false);
    expect(pagamentoTemFatura("2026-08-12", [antiga(2026, 8, 1500)], { valor: 1500, outrasDatas })).toBe(true);
  });

  it("o vizinho não vale quando o pagamento é bem maior que a fatura daquele mês (é outro cartão)", () => {
    expect(pagamentoTemFatura("2026-09-12", [antiga(2026, 8, 300)], { valor: 5000 })).toBe(false);
    expect(pagamentoDoCartao("2026-09-12", [antiga(2026, 8, 300)], { valor: 5000 })).toMatchObject({ subcategory: "Cartão de crédito" });
  });

  it("sem fatura nenhuma no app em volta, o pagamento continua sendo gasto", () => {
    expect(pagamentoTemFatura("2026-09-12", [], { valor: 1500 })).toBe(false);
    expect(pagamentosDaFatura([{ id: "p", data: "2026-09-12", valor: 1500 }], []).size).toBe(0);
    expect(pagamentosDaFatura([{ id: "p", data: "2026-09-12", valor: 1500 }], [antiga(2026, 6, 1500)]).size).toBe(0);
  });

  it("fatura chegando depois do extrato: acha o pagamento quando a fatura antiga está no mês anterior", () => {
    expect([...pagamentosDaFatura([{ id: "set", data: "2026-09-12", valor: 1500 }], [antiga(2026, 8, 1000), antiga(2026, 8, 500)])]).toEqual(["set"]);
  });

  it("pagamento em duas vezes para a mesma fatura: os dois saem", () => {
    const compras = [compraNova("2026-08-20", 1200), compraNova("2026-09-01", 800)];
    const pagamentos = [
      { id: "pix1", data: "2026-09-12", valor: 1000 },
      { id: "pix2", data: "2026-09-15", valor: 1000 },
    ];
    expect([...pagamentosDaFatura(pagamentos, compras)].sort()).toEqual(["pix1", "pix2"]);
  });

  it("dois cartões com as duas faturas no app (modo antigo): os dois pagamentos saem", () => {
    const compras = [antiga(2026, 9, 1800, "LOJA A"), antiga(2026, 9, 200, "LOJA B"), antiga(2026, 9, 700, "LOJA C")];
    const pagamentos = [
      { id: "nubank", data: "2026-09-08", valor: 2000 },
      { id: "itau", data: "2026-09-10", valor: 700 },
    ];
    expect([...pagamentosDaFatura(pagamentos, compras)].sort()).toEqual(["itau", "nubank"]);
  });

  it("dois cartões e só uma fatura no app: o pagamento do outro cartão continua sendo gasto", () => {
    const compras = [antiga(2026, 9, 1800, "LOJA A"), antiga(2026, 9, 200, "LOJA B")];
    const pagamentos = [
      { id: "nubank", data: "2026-09-08", valor: 2000 },
      { id: "itau", data: "2026-09-10", valor: 3200 },
    ];
    expect([...pagamentosDaFatura(pagamentos, compras)]).toEqual(["nubank"]);
  });
});

describe("fatura BTG: período de compras e a parcela 2 de uma compra do começo do mês anterior", () => {
  const BTG = "Fulana | fatura de Março de 2026 | cartão final 0000\nPeríodo de compras: 13/02 até 13/03\nVencimento: 17/03";

  it("o fechamento sai do 'Período de compras' (PDF e planilha)", () => {
    expect(lerDatasDaFatura(BTG)).toEqual({ vencimento: "2026-03-17", fechamento: "2026-03-13" });
    expect(lerDatasDaFatura("Fatura Cartão de Crédito;;;;;Junho/2026;\nPeríodo de Compras;;13/05 até 13/06;;Lançamentos Nacionais;;R$ 1,00\nVencimento;;17/06;;").fechamento).toBe("2026-06-13");
  });

  it("a parcela 2/3 de uma compra de 12/02 conta em março, não em fevereiro", () => {
    const ctx = contextoDaFatura(lerDatasDaFatura(BTG), ["2026-02-12", "2026-03-10"]);
    const d = mesDaCompra({ date: "2026-02-12", description: "Clínica Exemplo (2/3)", installment: { current: 2, total: 3, confident: true } }, ctx);
    expect(d.mes).toEqual({ year: 2026, month: 3 });
    const vista = mesDaCompra({ date: "2026-02-14", description: "Padaria Exemplo" }, ctx);
    expect(vista.mes).toEqual({ year: 2026, month: 2 });
  });
});

describe("prints da fatura aberta (sem vencimento nem fechamento): parcela 2 ou mais", () => {
  const ctx = contextoDaFatura({ vencimento: null, fechamento: null }, ["2026-10-13", "2026-10-10", "2026-09-14", "2026-07-21"]);

  it("a 2/8 de uma compra de 14/09 conta em outubro (mês da parcela), não em setembro", () => {
    const d = mesDaCompra({ date: "2026-09-14", description: "Clínica Exemplo - Parcela 2/8", installment: { current: 2, total: 8, confident: true } }, ctx);
    expect(d.mes).toEqual({ year: 2026, month: 10 });
    expect(d.dia).toBe("2026-10-14");
  });

  it("parcela com a data da cobrança (k - 1 meses à frente passaria da fatura) fica no mês da data", () => {
    const d = mesDaCompra({ date: "2026-10-05", description: "Loja Exemplo - Parcela 3/10", installment: { current: 3, total: 10, confident: true } }, ctx);
    expect(d.mes).toEqual({ year: 2026, month: 10 });
  });
});

describe("ajustarAnoDaCompra com o fechamento", () => {
  it("parcela com data depois do fechamento volta um ano; compra até o fechamento fica", () => {
    expect(ajustarAnoDaCompra("2026-07-10", "2026-06-17", "2026-06-13")).toBe("2025-07-10");
    expect(ajustarAnoDaCompra("2026-06-12", "2026-06-17", "2026-06-13")).toBe("2026-06-12");
    // Sem o fechamento, a folga de antes continua.
    expect(ajustarAnoDaCompra("2026-07-10", "2026-06-17")).toBe("2026-07-10");
  });
});
