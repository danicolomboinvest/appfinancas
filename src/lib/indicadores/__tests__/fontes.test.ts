import { describe, expect, it } from "vitest";
import { acharTitulo, cdiAoAno, chaveDoTitulo, ipcaDozeMeses, lerPrecosDoTesouro, lerSgs, porcento, quandoDoIndicador } from "../fontes";

const CSV = [
  "Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha",
  "Tesouro Selic;01/03/2029;09/10/2026;0,05;0,06;17890,12;17880,00;17880,00",
  "Tesouro IPCA+;15/05/2035;09/10/2026;7,62;7,74;2201,55;2190,40;2190,40",
  "Tesouro IPCA+;15/05/2035;08/10/2026;7,60;7,72;2203,00;2192,00;2192,00",
  "Tesouro IPCA+ com Juros Semestrais;15/05/2035;09/10/2026;7,40;7,52;4300,00;4290,00;4290,00",
  "Tesouro Prefixado;01/01/2031;09/10/2026;13,10;13,22;600,00;598,00;598,00",
].join("\n");

describe("Banco Central (SGS)", () => {
  it("lê a resposta e calcula o CDI ao ano por 252 dias úteis", () => {
    const pontos = lerSgs([{ data: "08/10/2026", valor: "0.050788" }, { data: "07/10/2026", valor: "0.050788" }]);
    expect(pontos.map((p) => p.data.toISOString().slice(0, 10))).toEqual(["2026-10-07", "2026-10-08"]);
    expect(porcento(cdiAoAno(pontos[1].valor))).toBe("13,65%");
  });
  it("IPCA de 12 meses é composto e precisa dos 12 meses", () => {
    const meses = Array.from({ length: 12 }, (_, i) => ({ data: `01/${String(i + 1).padStart(2, "0")}/2026`, valor: "0.40" }));
    expect(porcento(ipcaDozeMeses(lerSgs(meses))!.valor)).toBe("4,91%");
    expect(ipcaDozeMeses(lerSgs(meses.slice(0, 11)))).toBeNull();
  });
  it("linha quebrada é ignorada, nunca vira zero", () => {
    expect(lerSgs([{ data: "x", valor: "1" }, { data: "01/01/2026", valor: "" }, null])).toEqual([]);
    expect(lerSgs({ erro: true })).toEqual([]);
  });
});

describe("Tesouro Transparente", () => {
  it("fica só com o dia mais recente e lê preço e taxa", () => {
    const t = lerPrecosDoTesouro(CSV);
    expect(t).toHaveLength(4);
    const ipca = t.find((x) => x.tipo === "Tesouro IPCA+")!;
    expect(ipca).toMatchObject({ taxaCompra: 7.62, puVenda: 2190.4 });
    expect(chaveDoTitulo(ipca)).toBe("tesouro:Tesouro IPCA+:2035-05-15");
  });
  it("acha o título pelo nome do ativo (tipo e ano); sem os dois, não acha", () => {
    const t = lerPrecosDoTesouro(CSV);
    expect(acharTitulo("Tesouro IPCA+ 2035", t)).toBe("tesouro:Tesouro IPCA+:2035-05-15");
    expect(acharTitulo("Tesouro IPCA+ com juros semestrais 2035", t)).toBe("tesouro:Tesouro IPCA+ com Juros Semestrais:2035-05-15");
    expect(acharTitulo("Tesouro Selic 2029", t)).toBe("tesouro:Tesouro Selic:2029-03-01");
    expect(acharTitulo("Tesouro Prefixado 2031", t)).toBe("tesouro:Tesouro Prefixado:2031-01-01");
    expect(acharTitulo("Tesouro IPCA+", t)).toBeNull();
    expect(acharTitulo("CDB Inter 2035", t)).toBeNull();
    expect(acharTitulo("Tesouro Selic 2040", t)).toBeNull();
  });
});

describe("fonte e hora", () => {
  const agora = new Date("2026-10-10T13:15:00Z"); // 10:15 em Brasília
  it("buscado hoje: a data de referência, ou a hora", () => {
    const ind = { referenteA: new Date("2026-10-09T00:00:00Z"), buscadoEm: new Date("2026-10-10T12:00:00Z") };
    expect(quandoDoIndicador(ind, agora)).toEqual({ texto: "09/10", velho: false });
    expect(quandoDoIndicador(ind, agora, true)).toEqual({ texto: "hoje · 09:00", velho: false });
  });
  it("a busca de hoje falhou: mostra o último valor com 'de ontem'", () => {
    const ind = { referenteA: new Date("2026-10-08T00:00:00Z"), buscadoEm: new Date("2026-10-09T22:00:00Z") };
    expect(quandoDoIndicador(ind, agora)).toEqual({ texto: "de ontem, 09/10", velho: true });
    const maisVelho = { ...ind, buscadoEm: new Date("2026-10-06T22:00:00Z") };
    expect(quandoDoIndicador(maisVelho, agora).texto).toBe("de 06/10");
  });
});
