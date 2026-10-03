import { describe, expect, it } from "vitest";
import { ajustesDoPadrao, arredondaPlano, mediana, padraoPorCategoria } from "../padrao-orcamento";

describe("padrão dos últimos três meses", () => {
  it("usa a mediana: um mês fora da curva não vira plano", () => {
    // A viagem de agosto (R$ 3.000 de lazer) não puxa o padrão.
    const { padrao } = padraoPorCategoria([{ LAZER: 400 }, { LAZER: 3000 }, { LAZER: 450 }]);
    expect(padrao.LAZER).toBe(450);
  });

  it("mês sem nenhum gasto é mês sem dado, não gasto zero", () => {
    const { padrao, mesesComDado } = padraoPorCategoria([{}, { ALIMENTACAO: 800 }, { ALIMENTACAO: 900 }]);
    expect(mesesComDado).toBe(2);
    expect(padrao.ALIMENTACAO).toBe(850);
  });

  it("arredonda o plano para cima, de 50 em 50", () => {
    expect(arredondaPlano(812)).toBe(850);
    expect(arredondaPlano(850)).toBe(850);
    expect(arredondaPlano(0)).toBe(0);
    expect(mediana([3, 1, 2])).toBe(2);
  });
});

describe("ajustes sugeridos", () => {
  const meses = [
    { ALIMENTACAO: 1000, LAZER: 300, TRANSPORTE: 200, SAUDE: 90 },
    { ALIMENTACAO: 1100, LAZER: 280, TRANSPORTE: 220, SAUDE: 0 },
    { ALIMENTACAO: 1050, LAZER: 320, TRANSPORTE: 210, SAUDE: 0 },
  ];

  it("sobe o que vive estourando", () => {
    const a = ajustesDoPadrao({ meses, plano: { ALIMENTACAO: 800, LAZER: 300, TRANSPORTE: 200 } });
    const comida = a.find((x) => x.chave === "ALIMENTACAO");
    expect(comida).toMatchObject({ tipo: "subir", planoAtual: 800, sugerido: 1050 });
    expect(comida?.meses).toEqual([1000, 1100, 1050]);
  });

  it("baixa o que sobra todo mês, se a diferença vale a pena", () => {
    const a = ajustesDoPadrao({ meses, plano: { ALIMENTACAO: 1050, LAZER: 700, TRANSPORTE: 200 } });
    expect(a.find((x) => x.chave === "LAZER")).toMatchObject({ tipo: "baixar", planoAtual: 700, sugerido: 300 });
  });

  it("cria o plano da categoria que tem gasto e não tem plano", () => {
    const a = ajustesDoPadrao({ meses, plano: { ALIMENTACAO: 1050, LAZER: 300 } });
    expect(a.find((x) => x.chave === "TRANSPORTE")).toMatchObject({ tipo: "criar", sugerido: 250 });
  });

  it("não mexe no que está perto do plano", () => {
    const a = ajustesDoPadrao({ meses, plano: { ALIMENTACAO: 1000, LAZER: 300, TRANSPORTE: 200 } });
    expect(a.map((x) => x.chave)).not.toContain("LAZER");
    expect(a.map((x) => x.chave)).not.toContain("ALIMENTACAO");
  });

  it("categoria que quase não aparece (saúde só num mês) não vira plano", () => {
    const a = ajustesDoPadrao({ meses, plano: {} });
    expect(a.map((x) => x.chave)).not.toContain("SAUDE");
  });

  it("com um mês só não fala em padrão", () => {
    expect(ajustesDoPadrao({ meses: [{}, {}, { ALIMENTACAO: 900 }], plano: {} })).toEqual([]);
  });

  it("pula categoria escondida", () => {
    const a = ajustesDoPadrao({ meses, plano: {}, ignorar: new Set(["TRANSPORTE"]) });
    expect(a.map((x) => x.chave)).not.toContain("TRANSPORTE");
  });

  it("no máximo cinco sugestões, as maiores primeiro", () => {
    const muitos = [0, 1, 2].map(() => Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`c${i}`, (i + 1) * 100])));
    const a = ajustesDoPadrao({ meses: muitos, plano: {} });
    expect(a).toHaveLength(5);
    expect(a[0].chave).toBe("c7");
  });
});
