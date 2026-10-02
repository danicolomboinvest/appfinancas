import { describe, expect, it } from "vitest";
import { categoriaDoMes, ordenarCategorias, planoMaisRealista, sugestaoDeCobrir } from "../orcamento-categorias";

const c = (key: string, planejado: number, gasto: number, aVencer = 0, decorrido = 0.58) => categoriaDoMes({ key, label: key, planejado, gasto, aVencer }, decorrido);

describe("categorias do mês com previsão", () => {
  it("Alimentação com sobra hoje, mas que no ritmo vai passar, fica 'vai-passar'", () => {
    expect(c("ALIMENTACAO", 1500, 1180).estado).toBe("vai-passar");
  });
  it("Moradia é conta fixa: não projeta pelo ritmo, e o que vai vencer entra reservado", () => {
    const m = c("MORADIA", 3000, 2420, 560);
    expect(m.estado).toBe("dentro");
    expect(m.sobra).toBe(20);
  });
  it("passou de verdade é vermelho, e sem plano fica cinza", () => {
    expect(c("LAZER", 500, 560).estado).toBe("passou");
    expect(c("OUTROS", 0, 90).estado).toBe("sem-plano");
  });
  it("ordem: passou, vai passar, e depois quem gasta mais", () => {
    const lista = ordenarCategorias([c("TRANSPORTE", 1000, 410), c("LAZER", 500, 560), c("ALIMENTACAO", 1500, 1180)]);
    expect(lista.map((x) => x.key)).toEqual(["LAZER", "ALIMENTACAO", "TRANSPORTE"]);
  });
});

describe("Cobrir", () => {
  it("cobre a que passou com a que tem mais folga prevista", () => {
    const s = sugestaoDeCobrir([c("LAZER", 500, 560), c("TRANSPORTE", 1000, 410, 0, 0.58), c("SAUDE", 600, 180)]);
    expect(s?.para.key).toBe("LAZER");
    expect(s?.valor).toBe(60);
    expect(s?.de.key).toBe("SAUDE"); // Saúde é fixa: folga 420; Transporte projeta 707 → folga 293
  });
  it("sem ninguém com folga suficiente, não sugere", () => {
    expect(sugestaoDeCobrir([c("LAZER", 500, 900), c("TRANSPORTE", 300, 280)])).toBeNull();
  });
});

describe("plano mais realista", () => {
  it("passou em 4 de 6 meses: sugere a média, arredondada para cima de 50 em 50", () => {
    const h = [1380, 1620, 1550, 1290, 1700, 1600].map((gasto) => ({ gasto, planejado: 1500 }));
    expect(planoMaisRealista(h, 1500)).toEqual({ passou: 4, meses: 6, sugerido: 1550 });
  });
  it("passou pouco: não sugere", () => {
    expect(planoMaisRealista([1400, 1300, 1600, 1200].map((gasto) => ({ gasto, planejado: 1500 })), 1500)).toBeNull();
  });
});
