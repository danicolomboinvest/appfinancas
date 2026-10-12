import { describe, expect, it } from "vitest";
import { cacarDinheiroPerdido, estornoCaiu, type LancamentoParaCacar } from "../detectar";

let seq = 0;
/** Um lançamento: `data` "AAAA-MM-DD" decide o mês. */
function l(descricao: string, valor: number, data: string, extra: Partial<LancamentoParaCacar> = {}): LancamentoParaCacar {
  seq += 1;
  return {
    id: `l${seq}`,
    descricao,
    valor,
    data,
    ano: Number(data.slice(0, 4)),
    mes: Number(data.slice(5, 7)),
    tipo: "EXPENSE",
    categoria: null,
    subcategoria: null,
    lote: "lote1",
    ...extra,
  };
}
/** A mesma cobrança em vários meses de 2026 (dia fixo). */
function todoMes(descricao: string, valores: number[], dia = 8, primeiroMes = 4, extra: Partial<LancamentoParaCacar> = {}) {
  return valores.map((v, i) => l(descricao, v, `2026-${String(primeiroMes + i).padStart(2, "0")}-${String(dia).padStart(2, "0")}`, extra));
}
const tipos = (r: ReturnType<typeof cacarDinheiroPerdido>) => r.achados.map((a) => `${a.tipo}:${a.nome}`);

describe("assinatura", () => {
  it("acha o Netflix que cobra todo mês, com o logo e o valor por ano", () => {
    const r = cacarDinheiroPerdido([...todoMes("NETFLIX.COM", [59.9, 59.9, 59.9]), l("Mercado Bom Preço", 230, "2026-06-03", { categoria: "ALIMENTACAO", subcategoria: "Supermercado" })]);
    const a = r.achados.find((x) => x.tipo === "assinatura");
    expect(a?.nome).toBe("Netflix");
    expect(a?.mensal).toBe(59.9);
    expect(a?.anual).toBeCloseTo(718.8);
    expect(a?.dia).toBe(8);
    expect(a?.chave).toBe("assinatura:m:netflix");
  });

  it("a chave não muda quando o banco escreve o nome de outro jeito", () => {
    const r = cacarDinheiroPerdido([l("NETFLIX.COM", 39.9, "2026-04-05"), l("Netflix Entretenimento", 39.9, "2026-05-05"), l("EBN*NETFLIX SAO PAULO", 39.9, "2026-06-05")]);
    expect(r.achados.map((a) => a.chave)).toEqual(["assinatura:m:netflix"]);
  });

  it("serviço sem logo precisa de 3 meses e do mesmo valor", () => {
    expect(tipos(cacarDinheiroPerdido(todoMes("ACADEMIA CORPO LIVRE", [99, 99])))).toEqual([]);
    expect(tipos(cacarDinheiroPerdido(todoMes("ACADEMIA CORPO LIVRE", [99, 99, 99])))).toHaveLength(1);
    // Restaurante com conta parecida todo mês não é assinatura.
    expect(tipos(cacarDinheiroPerdido(todoMes("RESTAURANTE DONA MARIA", [82, 79, 85])))).toEqual([]);
  });

  it("assinatura que sumiu nos últimos meses já foi cancelada: não vira carta", () => {
    const r = cacarDinheiroPerdido([...todoMes("SPOTIFY", [21.9, 21.9, 21.9], 12, 2), l("Padaria", 12, "2026-08-02"), l("Padaria", 14, "2026-09-02")]);
    expect(r.achados.filter((a) => a.tipo === "assinatura")).toEqual([]);
  });

  it("parcela não é assinatura (tem fim)", () => {
    const r = cacarDinheiroPerdido([l("MAGALU PARC 03/10", 150, "2026-04-10"), l("MAGALU PARC 04/10", 150, "2026-05-10"), l("MAGALU PARC 05/10", 150, "2026-06-10")]);
    expect(r.achados).toEqual([]);
  });

  it("salário (entrada) nunca entra", () => {
    const r = cacarDinheiroPerdido(todoMes("SALARIO EMPRESA X", [5000, 5000, 5000], 5, 4, { tipo: "INCOME" }));
    expect(r.achados).toEqual([]);
  });

  it("transferência entre contas próprias e Pix para pessoa não contam", () => {
    const r = cacarDinheiroPerdido([
      ...todoMes("Transferência enviada pelo Pix - Daniela Colombo - •••.123.456-•• - NU PAGAMENTOS", [500, 500, 500]),
      ...todoMes("TED MESMA TITULARIDADE ITAU", [1000, 1000, 1000], 10),
      ...todoMes("PIX ENVIADO MARIA SILVA", [300, 300, 300], 15),
      ...todoMes("Aplicação RDB", [200, 200, 200], 20),
    ]);
    expect(r.achados).toEqual([]);
  });

  it("aluguel e escola são essenciais, não assinatura esquecida", () => {
    const r = cacarDinheiroPerdido([
      ...todoMes("ALUGUEL APTO", [1800, 1800, 1800], 5, 4, { categoria: "MORADIA" }),
      ...todoMes("ESCOLA PEQUENO PRINCIPE", [900, 900, 900], 10, 4, { categoria: "EDUCACAO" }),
    ]);
    expect(r.achados).toEqual([]);
  });

  it("Google com duas assinaturas de valores diferentes vira duas cartas", () => {
    const r = cacarDinheiroPerdido([...todoMes("GOOGLE *YouTube", [24.9, 24.9, 24.9], 3), ...todoMes("GOOGLE *Google One", [9.99, 9.99, 9.99], 18)]);
    expect(r.achados.filter((a) => a.tipo === "assinatura")).toHaveLength(2);
  });
});

describe("cobrança repetida", () => {
  it("o mesmo iFood, mesmo valor, um dia depois: vale conferir", () => {
    const r = cacarDinheiroPerdido([l("IFOOD *IFOOD", 58.4, "2026-09-12"), l("IFOOD *IFOOD", 58.4, "2026-09-13")]);
    expect(r.achados).toHaveLength(1);
    const a = r.achados[0];
    expect(a.tipo).toBe("repetida");
    expect(a.nome).toBe("iFood, 2 vezes");
    expect(a.unico).toBe(58.4);
    expect(a.mensal).toBeNull();
    expect(a.datas).toEqual(["2026-09-12", "2026-09-13"]);
  });

  it("mercado, padaria e Uber repetidos são dia a dia", () => {
    const r = cacarDinheiroPerdido([
      l("SUPERMERCADO DIA FELIZ", 45.9, "2026-09-12", { categoria: "ALIMENTACAO", subcategoria: "Supermercado" }),
      l("SUPERMERCADO DIA FELIZ", 45.9, "2026-09-13", { categoria: "ALIMENTACAO", subcategoria: "Supermercado" }),
      l("PADARIA REAL", 18, "2026-09-12"),
      l("PADARIA REAL", 18, "2026-09-14"),
      l("UBER *TRIP", 23.5, "2026-09-12"),
      l("UBER *TRIP", 23.5, "2026-09-12"),
      l("POSTO IPIRANGA", 150, "2026-09-02"),
      l("POSTO IPIRANGA", 150, "2026-09-04"),
    ]);
    expect(r.achados).toEqual([]);
  });

  it("valores diferentes ou mais de 3 dias de distância não contam", () => {
    const r = cacarDinheiroPerdido([l("LOJA AURORA", 80, "2026-09-01"), l("LOJA AURORA", 81, "2026-09-02"), l("LIVRARIA CULTURA", 60, "2026-09-01"), l("LIVRARIA CULTURA", 60, "2026-09-08")]);
    expect(r.achados).toEqual([]);
  });

  it("parcelas iguais da mesma compra não são cobrança repetida", () => {
    const r = cacarDinheiroPerdido([l("LOJA AURORA PARCELA 1/3", 100, "2026-09-01"), l("LOJA AURORA PARCELA 2/3", 100, "2026-09-02")]);
    expect(r.achados).toEqual([]);
  });

  it("o mesmo extrato importado duas vezes (lotes diferentes, mesmo dia) não é cobrança do banco", () => {
    const r = cacarDinheiroPerdido([l("LOJA AURORA", 80, "2026-09-01", { lote: "a" }), l("LOJA AURORA", 80, "2026-09-01", { lote: "b" })]);
    expect(r.achados).toEqual([]);
  });

  it("valor pequeno (abaixo de R$ 10) não vira carta", () => {
    const r = cacarDinheiroPerdido([l("BANCA DO ZE", 6, "2026-09-01"), l("BANCA DO ZE", 6, "2026-09-02")]);
    expect(r.achados).toEqual([]);
  });

  it("Pix repetido para uma pessoa não conta", () => {
    const r = cacarDinheiroPerdido([l("PIX ENVIADO JOAO", 50, "2026-09-01"), l("PIX ENVIADO JOAO", 50, "2026-09-02")]);
    expect(r.achados).toEqual([]);
  });
});

describe("tarifa e seguro", () => {
  it("tarifa de pacote todo mês: por mês e por ano, com o banco", () => {
    const r = cacarDinheiroPerdido(todoMes("TARIFA PACOTE SERVICOS ITAU", [64.9, 64.9, 64.9], 1));
    expect(r.achados).toHaveLength(1);
    const a = r.achados[0];
    expect(a.tipo).toBe("tarifa");
    expect(a.tarifa).toBe("pacote");
    expect(a.nome).toBe("Tarifa de pacote, Itaú");
    expect(a.mensal).toBe(64.9);
    expect(a.anual).toBeCloseTo(778.8);
  });

  it("seguro do cartão e anuidade são achados separados", () => {
    const r = cacarDinheiroPerdido([...todoMes("SEGURO CARTAO PROTEGIDO BRADESCO", [9.9, 9.9]), ...todoMes("ANUIDADE DIFERENCIADA", [32, 32])]);
    expect(r.achados.map((a) => a.tarifa).sort()).toEqual(["anuidade", "seguro"]);
  });

  it("IOF de uma vez: o valor do mês, uma vez", () => {
    const r = cacarDinheiroPerdido([l("IOF COMPRA INTERNACIONAL", 4.38, "2026-09-10"), l("IOF COMPRA INTERNACIONAL", 2.1, "2026-09-11")]);
    expect(r.achados).toHaveLength(1);
    expect(r.achados[0].unico).toBeCloseTo(6.48);
    expect(r.achados[0].mensal).toBeNull();
  });

  it("tarifa de ônibus não é tarifa de banco", () => {
    expect(cacarDinheiroPerdido(todoMes("TARIFA ONIBUS SPTRANS", [4.4, 4.4, 4.4])).achados).toEqual([]);
  });

  it("estorno de tarifa (entrada) não vira achado", () => {
    expect(cacarDinheiroPerdido([l("ESTORNO TARIFA", 64.9, "2026-09-10", { tipo: "INCOME" })]).achados).toEqual([]);
  });
});

describe("aumentou", () => {
  it("Netflix de R$ 44,90 para R$ 59,90: antes x agora, e a diferença por ano", () => {
    const r = cacarDinheiroPerdido(todoMes("NETFLIX.COM", [44.9, 44.9, 44.9, 59.9]));
    expect(r.achados).toHaveLength(1);
    const a = r.achados[0];
    expect(a.tipo).toBe("aumento");
    expect(a.antes).toBe(44.9);
    expect(a.agora).toBe(59.9);
    expect(a.mensal).toBe(15);
    expect(a.anual).toBe(180);
  });

  it("centavos de câmbio não são aumento (régua de R$ 2 e 5%)", () => {
    const r = cacarDinheiroPerdido(todoMes("SPOTIFY", [21.9, 21.9, 21.9, 22.9]));
    expect(r.achados.map((a) => a.tipo)).toEqual(["assinatura"]);
  });

  it("depois de 3 meses no preço novo, volta a ser a assinatura de sempre", () => {
    const r = cacarDinheiroPerdido(todoMes("NETFLIX.COM", [44.9, 44.9, 59.9, 59.9, 59.9]));
    expect(r.achados.map((a) => `${a.tipo}:${a.mensal}`)).toEqual(["assinatura:59.9"]);
  });
});

describe("viagem e imposto (visto nos dados de verdade)", () => {
  it("passagem parcelada sem a palavra parcela não vira assinatura", () => {
    expect(cacarDinheiroPerdido(todoMes("IBERIA LINEAS AEREAS MADRID", [488.36, 488.36, 488.36])).achados).toEqual([]);
  });

  it("a guia do Simples paga duas vezes não é cobrança repetida para estorno", () => {
    const r = cacarDinheiroPerdido([
      l("PAGAMENTO SIMPLES NACIONAL", 772.22, "2026-09-18", { categoria: "IMPOSTOS" }),
      l("PAGAMENTO SIMPLES NACIONAL", 772.22, "2026-09-20", { categoria: "IMPOSTOS" }),
    ]);
    expect(r.achados).toEqual([]);
  });
});

describe("conjunto", () => {
  it("nada achado: diz quantos lançamentos olhou no último mês", () => {
    const r = cacarDinheiroPerdido([l("Padaria", 12, "2026-09-02"), l("Mercado", 200, "2026-09-03"), l("Salário", 5000, "2026-09-05", { tipo: "INCOME" })]);
    expect(r.achados).toEqual([]);
    expect(r.conferidos).toEqual({ quantos: 3, ano: 2026, mes: 9 });
  });

  it("sem lançamento nenhum: nem conta", () => {
    expect(cacarDinheiroPerdido([])).toEqual({ achados: [], conferidos: null });
  });

  it("ordena do maior por ano para o menor", () => {
    const r = cacarDinheiroPerdido([...todoMes("NETFLIX.COM", [59.9, 59.9, 59.9]), ...todoMes("SPOTIFY", [21.9, 21.9, 21.9], 12), l("IFOOD *IFOOD", 58.4, "2026-06-12"), l("IFOOD *IFOOD", 58.4, "2026-06-13")]);
    expect(r.achados.map((a) => a.anual)).toEqual([...r.achados.map((a) => a.anual)].sort((a, b) => b - a));
    expect(r.achados).toHaveLength(3);
  });
});

describe("estorno", () => {
  const cobranca = l("IFOOD *IFOOD", 58.4, "2026-09-13");
  const achado = cacarDinheiroPerdido([l("IFOOD *IFOOD", 58.4, "2026-09-12"), cobranca]).achados[0];

  it("crédito do mesmo comerciante e do mesmo valor depois da cobrança: caiu", () => {
    expect(estornoCaiu(achado, [l("ESTORNO IFOOD", 58.4, "2026-09-20", { tipo: "INCOME" })])).not.toBeNull();
  });

  it("crédito de outro valor, ou antes da cobrança, não é o estorno", () => {
    expect(estornoCaiu(achado, [l("ESTORNO IFOOD", 30, "2026-09-20", { tipo: "INCOME" })])).toBeNull();
    expect(estornoCaiu(achado, [l("ESTORNO IFOOD", 58.4, "2026-09-01", { tipo: "INCOME" })])).toBeNull();
    expect(estornoCaiu(achado, [l("SALARIO", 58.4, "2026-09-20", { tipo: "INCOME" })])).toBeNull();
  });
});
