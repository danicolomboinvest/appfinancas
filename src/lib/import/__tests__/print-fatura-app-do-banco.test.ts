import { describe, expect, it } from "vitest";
import { comprasDosPrints, juntarPrints, lerData, lerPrint, semValorEmReal, type Segmento } from "../print-fatura";

/**
 * O print da fatura aberta de um app em que cada compra tem 3 linhas (13/10/2026):
 *   Compra no crédito          <- rótulo
 *   Loja Exemplo               <- nome
 *   Saúde            - R$ 9,90 <- categoria à esquerda, valor à direita
 * Os nomes e valores abaixo são inventados; as posições seguem um print real (OCR em 1.100 px).
 */
const ENVIO = "2026-10-13"; // terça

const seg = (texto: string, x0: number, y0: number, h: number, x1 = x0 + texto.length * 14): Segmento => ({ texto, x0, y0, x1, y1: y0 + h });

type Compra = { rotulo?: string; extra?: string; nome: string; categoria: string; valor: string };

/** Uma compra com o topo em `y`; devolve os pedaços e a altura que ela ocupa. */
function compra(y: number, c: Compra): Segmento[] {
  const segs = [
    seg("O", 69, y - 14, 111, 179), // o logo da loja, uma letra enorme à esquerda
    seg(c.rotulo ?? "Compra no crédito", 226, y, 30),
  ];
  let dy = 0;
  if (c.extra) {
    segs.push(seg(c.extra, 227, y + 55, 26));
    dy = 30;
  }
  segs.push(seg(c.nome, 228, y + 65 + dy, 40));
  segs.push(seg(c.categoria, 227, y + 141 + dy, 25));
  segs.push(seg(c.valor, 1030 - c.valor.length * 18, y + 139 + dy, 43, 1030));
  return segs;
}

const cabecalho = (y: number, texto: string) => seg(texto, 81, y, 40);
const tela = (...partes: Segmento[][]) => partes.flat();

describe("print de app com rótulo, nome e categoria", () => {
  const print = tela(
    [seg("Fatura", 73, 426, 48)],
    [cabecalho(640, "Sábado 10/Out")],
    compra(800, { nome: "Loja Exemplo", categoria: "Cuidados Pessoais", valor: "- R$ 14,00" }),
    [cabecalho(1100, "Sexta 09/Out")],
    compra(1260, { nome: "Padaria Teste", categoria: "Alimentação", valor: "- R$ 38,66" }),
    compra(1560, { extra: "KAIQUE", rotulo: "Compra no crédito no cartão adicional de ANA E", nome: "Carona App", categoria: "Transporte", valor: "-R$9,95" }),
  );

  it("o nome é o da loja, nunca a categoria", () => {
    const { linhas } = lerPrint(print, ENVIO);
    expect(linhas.map((l) => [l.nome, l.valor])).toEqual([
      ["Loja Exemplo", 14],
      ["Padaria Teste", 38.66],
      ["Carona App", 9.95],
    ]);
  });

  it("a data vem do cabeçalho de cima (Sábado 10/Out, Sexta 09/Out)", () => {
    const { linhas } = lerPrint(print, ENVIO);
    expect(linhas.map((l) => l.data)).toEqual(["2026-10-10", "2026-10-09", "2026-10-09"]);
  });

  it("as categorias do banco não viram nome mesmo quando o nome some", () => {
    const sem = tela(compra(800, { nome: "Saúde", categoria: "Saúde", valor: "- R$ 20,00" }));
    expect(lerPrint(sem, ENVIO).linhas).toEqual([]);
  });
});

describe("datas do app (dia/mês abreviado)", () => {
  it("14/Set, 21/Jul, 21/Mai, 09/Fev", () => {
    expect(lerData("14/Set", ENVIO)?.data).toBe("2026-09-14");
    expect(lerData("21/Jul", ENVIO)?.data).toBe("2026-07-21");
    expect(lerData("21/Mai", ENVIO)?.data).toBe("2026-05-21");
    expect(lerData("09/Fev", ENVIO)?.data).toBe("2026-02-09");
  });
  it("com o dia da semana ou o Hoje na frente", () => {
    expect(lerData("Sábado 10/Out", ENVIO)?.data).toBe("2026-10-10");
    expect(lerData("Sexta 09/Out", ENVIO)?.data).toBe("2026-10-09");
    expect(lerData("Hoje 13/Out", ENVIO)?.data).toBe("2026-10-13");
  });
  it("mês que ainda não chegou é do ano passado (parcela antiga)", () => {
    expect(lerData("14/Nov", ENVIO)?.data).toBe("2025-11-14");
    expect(lerData("13/Out", ENVIO)?.data).toBe("2026-10-13");
  });
  it("12/10 em número continua valendo", () => {
    expect(lerData("12/10", ENVIO)?.data).toBe("2026-10-12");
  });
  it("cabeçalhos do app viram a data de cada compra e as compras não caem todas em hoje", () => {
    const print = tela(
      [cabecalho(640, "14/Set")],
      compra(800, { rotulo: "Compra no crédito parcelada", nome: "Dentista Exemplo (2/8)", categoria: "Saúde", valor: "- R$ 1.031,25" }),
      [cabecalho(1100, "21/Jul")],
      compra(1260, { rotulo: "Compra no crédito parcelada", nome: "Hospedagem Teste (4/6)", categoria: "Viagem", valor: "- R$ 1.643,83" }),
    );
    expect(lerPrint(print, ENVIO).linhas.map((l) => l.data)).toEqual(["2026-09-14", "2026-07-21"]);
  });
});

describe("parcela escrita entre parênteses no nome", () => {
  const print = tela(
    [cabecalho(640, "14/Set")],
    compra(800, { rotulo: "Compra no crédito parcelada", nome: "Dentista Exemplo (2/8)", categoria: "Saúde", valor: "- R$ 1.031,25" }),
    [cabecalho(1100, "21/Mai")],
    compra(1260, { rotulo: "Compra no crédito parcelada", nome: "Companhia Aérea Teste (6/10)", categoria: "Viagem", valor: "- R$488,36" }),
  );
  it("2/8 e 6/10 saem do nome e viram parcela", () => {
    const { linhas } = lerPrint(print, ENVIO);
    expect(linhas.map((l) => [l.nome, l.parcela])).toEqual([
      ["Dentista Exemplo", { atual: 2, total: 8 }],
      ["Companhia Aérea Teste", { atual: 6, total: 10 }],
    ]);
  });
  it("a descrição vai no jeito que o resto do app entende", () => {
    const compras = comprasDosPrints(lerPrint(print, ENVIO).linhas, ENVIO);
    expect(compras.map((c) => c.description)).toEqual(["Dentista Exemplo - Parcela 2/8", "Companhia Aérea Teste - Parcela 6/10"]);
  });
});

describe("compra em dólar", () => {
  const print = tela(
    [cabecalho(640, "Sábado 10/Out")],
    compra(800, { rotulo: "Compra no crédito internacional", nome: "Servico Online", categoria: "Compras", valor: "- US$ 19,00" }),
    compra(1100, { nome: "Loja Exemplo", categoria: "Cuidados Pessoais", valor: "- R$ 14,00" }),
  );
  it("nunca grava 19 como se fosse real: a linha fica sem valor em real, com o dólar anotado", () => {
    const { linhas } = lerPrint(print, ENVIO);
    expect(linhas[0]).toMatchObject({ nome: "Servico Online", valor: 0, estrangeira: { moeda: "USD", valor: 19 } });
    expect(comprasDosPrints(linhas, ENVIO)).toEqual([{ date: "2026-10-10", description: "Loja Exemplo", amount: 14 }]);
  });
  it("a tela recebe o aviso com o valor em dólar", () => {
    const { linhas } = lerPrint(print, ENVIO);
    expect(semValorEmReal(linhas, ENVIO)).toEqual([{ nome: "Servico Online", data: "2026-10-10", texto: "US$ 19,00" }]);
  });
  it("sem o símbolo, o rótulo 'internacional' também segura o valor", () => {
    const sem = tela(compra(800, { rotulo: "Compra no crédito internacional", nome: "Servico Online", categoria: "Compras", valor: "- 19,00" }));
    const { linhas } = lerPrint(sem, ENVIO);
    expect(linhas[0]).toMatchObject({ valor: 0, estrangeira: { valor: 19 } });
  });
  it("quando o print mostra o real ao lado, vale o real", () => {
    const duas = tela(compra(800, { rotulo: "Compra no crédito internacional", nome: "Servico Online", categoria: "Compras", valor: "- R$ 98,52" }), [
      seg("US$ 19,00", 800, 960, 30, 1030),
    ]);
    const { linhas } = lerPrint(duas, ENVIO);
    expect(linhas[0]).toMatchObject({ nome: "Servico Online", valor: 98.52, estrangeira: { moeda: "USD", valor: 19 } });
    expect(comprasDosPrints(linhas, ENVIO)[0].amount).toBe(98.52);
  });
  it("real normal não é tomado por moeda de fora", () => {
    expect(lerPrint(print, ENVIO).linhas[1].estrangeira).toBeUndefined();
  });
});

describe("prints repetidos fora de ordem", () => {
  const a = lerPrint(
    tela(
      [cabecalho(640, "Sábado 10/Out")],
      compra(800, { nome: "Loja Um", categoria: "Compras", valor: "- R$ 10,00" }),
      compra(1100, { nome: "Loja Dois", categoria: "Compras", valor: "- R$ 20,00" }),
      compra(1400, { nome: "Loja Tres", categoria: "Compras", valor: "- R$ 30,00" }),
    ),
    ENVIO,
  );
  const b = lerPrint(
    tela(
      [cabecalho(640, "Sábado 10/Out")],
      compra(800, { nome: "Loja Tres", categoria: "Compras", valor: "- R$ 30,00" }),
      [cabecalho(1100, "Sexta 09/Out")],
      compra(1260, { nome: "Loja Quatro", categoria: "Compras", valor: "- R$ 40,00" }),
    ),
    ENVIO,
  );
  it("na ordem da tela, a parte repetida entra uma vez", () => {
    expect(juntarPrints([a, b]).map((l) => l.nome)).toEqual(["Loja Um", "Loja Dois", "Loja Tres", "Loja Quatro"]);
  });
  it("na ordem trocada (o mais novo escolhido por último), também", () => {
    const nomes = juntarPrints([b, a]).map((l) => l.nome);
    expect(nomes.sort()).toEqual(["Loja Dois", "Loja Quatro", "Loja Tres", "Loja Um"]);
  });
  it("o mesmo print mandado duas vezes não duplica", () => {
    expect(juntarPrints([a, a, b]).length).toBe(4);
  });
  it("duas compras iguais de verdade no mesmo print continuam duas", () => {
    const iguais = lerPrint(
      tela(
        [cabecalho(640, "Sexta 09/Out")],
        compra(800, { nome: "Carona App", categoria: "Transporte", valor: "-R$9,95" }),
        compra(1100, { nome: "Carona App", categoria: "Transporte", valor: "-R$9,95" }),
      ),
      ENVIO,
    );
    expect(juntarPrints([iguais]).length).toBe(2);
  });
});

describe("total da fatura que aparece na tela", () => {
  const resumo = tela(
    [seg("Resumo da Fatura", 72, 709, 36)],
    [seg("Compras e despesas", 70, 829, 41)],
    [seg("Total R$ 6.179,58", 68, 882, 38)],
    [seg("Fatura anterior e pagamentos", 71, 1078, 42)],
    [seg("Total R$ 9.695,61", 68, 1131, 38)],
    [cabecalho(1480, "Hoje 13/Out")],
    compra(1650, { nome: "Rede Social Teste", categoria: "Outra Categoria", valor: "- R$ 2.927,05" }),
  );
  it("lê o total de compras e despesas, não o da fatura anterior", () => {
    const print = lerPrint(resumo, ENVIO);
    expect(print.totalDaFatura).toBe(6179.58);
    expect(print.linhas.map((l) => [l.nome, l.data, l.valor])).toEqual([["Rede Social Teste", "2026-10-13", 2927.05]]);
  });
  it("print sem resumo não tem total", () => {
    expect(lerPrint(tela(compra(800, { nome: "Loja Um", categoria: "Compras", valor: "- R$ 10,00" })), ENVIO).totalDaFatura).toBeNull();
  });
});
