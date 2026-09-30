import { describe, expect, it } from "vitest";
import { mesDaRevelacao, montarRevelacao, type LinhaDoMes } from "../revelacao";

const gasto = (chave: string | null, valor: number): LinhaDoMes => ({ category: "EXPENSE", chave, rotulo: chave, valor });

describe("montarRevelacao", () => {
  it("entrou, saiu e as 3 maiores com a parte de cada uma", () => {
    const r = montarRevelacao(
      [
        { category: "INCOME", chave: null, rotulo: null, valor: 5000 },
        gasto("Moradia", 1500),
        gasto("Alimentação", 800),
        gasto("Transporte", 400),
        gasto("Lazer", 300),
      ],
      [],
    );
    expect(r.entrou).toBe(5000);
    expect(r.saiu).toBe(3000);
    expect(r.maiores.map((m) => m.rotulo)).toEqual(["Moradia", "Alimentação", "Transporte"]);
    expect(r.maiores[0].fracao).toBeCloseTo(0.5);
    expect(r.livre).toBeNull();
  });

  it("gasto sem categoria conta no que saiu, mas não vira 'maior categoria'", () => {
    const r = montarRevelacao([gasto(null, 900), gasto("Lazer", 100)], []);
    expect(r.saiu).toBe(1000);
    expect(r.maiores).toEqual([{ rotulo: "Lazer", valor: 100, fracao: 0.1 }]);
  });

  it("livre com orçamento: o que sobra, sem passar do que o mês comporta", () => {
    const r = montarRevelacao(
      [gasto("Alimentação", 500), gasto("Lazer", 400), gasto(null, 300)],
      [
        { chave: "Alimentação", planejado: 1000 },
        { chave: "Lazer", planejado: 300 },
      ],
    );
    // Sobras: 500 (Alimentação) + 0 (Lazer estourou). O mês: 1300 − 1200 = 100. Vale o menor.
    expect(r.planejado).toBe(1300);
    expect(r.livre).toBe(100);
  });

  it("orçamento estourado: livre zero, nunca negativo", () => {
    const r = montarRevelacao([gasto("Lazer", 900)], [{ chave: "Lazer", planejado: 500 }]);
    expect(r.livre).toBe(0);
  });

  it("devolução maior que a compra não vira gasto negativo nas maiores", () => {
    const r = montarRevelacao([gasto("Lazer", -50), gasto("Moradia", 100)], []);
    expect(r.maiores.map((m) => m.rotulo)).toEqual(["Moradia"]);
  });
});

describe("mesDaRevelacao", () => {
  it("fatura: o mês escolhido", () => {
    expect(mesDaRevelacao(["2026-08-10"], { year: 2026, month: 10 })).toEqual({ year: 2026, month: 10 });
  });

  it("extrato: o mês com mais lançamentos", () => {
    expect(mesDaRevelacao(["2026-08-30", "2026-09-01", "2026-09-02"], null)).toEqual({ year: 2026, month: 9 });
  });

  it("empate: o mais recente", () => {
    expect(mesDaRevelacao(["2026-08-30", "2026-09-01"], null)).toEqual({ year: 2026, month: 9 });
    expect(mesDaRevelacao(["2026-09-01", "2026-08-30"], null)).toEqual({ year: 2026, month: 9 });
  });

  it("sem data nenhuma: null", () => {
    expect(mesDaRevelacao(["?"], null)).toBeNull();
  });
});
