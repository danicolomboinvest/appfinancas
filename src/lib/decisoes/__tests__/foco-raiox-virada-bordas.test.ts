import { describe, expect, it } from "vitest";
import { somarConquistas } from "../conquistas";
import { gastoDepoisDoCombinado, planoQueCabe } from "../foco";
import { acharRecorrentes, economiaAnual, valorFuturo, type RaioXLancamento } from "../raio-x";
import { sugerirAno } from "../virada-ano";

/** Bordas do Foco, do Raio-X, da virada do ano e das conquistas: zero, negativo, ano virando. */
const money = (v: number) => `R$ ${v.toFixed(2)}`;

describe("planoQueCabe: arredondamento e zero", () => {
  it("arredonda PRA CIMA de 10 em 10 (703,01 → 710; 700 fica 700)", () => {
    expect(planoQueCabe({ gasto: 703.01, planejado: 0, fixa: true }, 10, 30)).toBe(710);
    expect(planoQueCabe({ gasto: 700, planejado: 0, fixa: true }, 10, 30)).toBe(700);
  });

  it("zero dias restantes (ou mês com 0 dias) não divide por zero: fica o que já foi gasto", () => {
    expect(planoQueCabe({ gasto: 703, planejado: 600, fixa: false }, 0, 30)).toBe(710);
    expect(Number.isFinite(planoQueCabe({ gasto: 703, planejado: 600, fixa: false }, 5, 0))).toBe(true);
  });

  it("o que já estava marcado antes do mês não se repete no resto do mês", () => {
    // plano 600, 200 já marcados → só 400 correm; 15 de 30 dias → +200.
    expect(planoQueCabe({ gasto: 650, planejado: 600, fixa: false, fixoAutomatico: 200 }, 15, 30)).toBe(850);
    // Marcado acima do plano não vira "resto" negativo.
    expect(planoQueCabe({ gasto: 650, planejado: 600, fixa: false, fixoAutomatico: 9999 }, 15, 30)).toBe(650);
  });
});

describe("gastoDepoisDoCombinado: negativo", () => {
  it("estorno depois do combinado não deixa o 'depois' negativo", () => {
    const combinadoEm = new Date("2026-09-10T15:00:00Z");
    const r = gastoDepoisDoCombinado([{ valor: -300, dia: "2026-09-12", criadoEm: new Date("2026-09-12T15:00:00Z"), importado: false }], combinadoEm, "2026-09-10");
    expect(r).toBe(0);
  });
});

describe("Raio-X: contas e virada do ano", () => {
  it("valorFuturo: zero meses ou zero por mês é zero; taxa zero é soma simples", () => {
    expect(valorFuturo(100, 0)).toBe(0);
    expect(valorFuturo(0, 12)).toBe(0);
    expect(valorFuturo(100, 12, 0)).toBe(1200);
    expect(valorFuturo(100, 12, -0.01)).toBe(1200);
  });

  it("economiaAnual: manter não economiza; metade é metade", () => {
    expect(economiaAnual({ anual: 480 }, "raiox_manter")).toBe(0);
    expect(economiaAnual({ anual: 480 }, "raiox_metade")).toBe(240);
    expect(economiaAnual({ anual: 480 }, "raiox_cancelar")).toBe(480);
  });

  it("sem lançamentos (ou só valores zero/negativos): lista vazia, sem NaN", () => {
    expect(acharRecorrentes([])).toEqual([]);
    const l = (amount: number, month: number): RaioXLancamento => ({ description: "NETFLIX.COM", amount, year: 2026, month, parentCategory: null });
    expect(acharRecorrentes([l(0, 1), l(-39.9, 2), l(0, 3)])).toEqual([]);
  });

  it("assinatura em novembro, dezembro e janeiro é 'todo mês' (a virada do ano não quebra a sequência)", () => {
    const l = (year: number, month: number): RaioXLancamento => ({ description: "NETFLIX.COM", amount: 39.9, year, month, parentCategory: null });
    const [item] = acharRecorrentes([l(2026, 11), l(2026, 12), l(2027, 1)]);
    expect(item).toMatchObject({ chave: "netflix", tipo: "assinatura", meses: 3, mensal: 39.9 });
    expect(item.anual).toBeCloseTo(478.8);
  });
});

describe("sugerirAno: zeros", () => {
  it("sem renda nenhuma: guardar zero, avisa que falta a renda e não divide por zero", () => {
    const r = sugerirAno({ ano: 2026, renda: { planejada: null, mediana: null }, guardarPlanejado: null, categorias: [] }, money);
    expect(r).toMatchObject({ renda: 0, guardar: 0, totalGastos: 0, semDestino: 0 });
    expect(r.avisos).toHaveLength(1);
  });

  it("renda planejada zero cai pra mediana; guardar mínimo de 10% arredonda pra cima de 10 em 10", () => {
    const r = sugerirAno({ ano: 2026, renda: { planejada: 0, mediana: 3333 }, guardarPlanejado: 0, categorias: [] }, money);
    expect(r.renda).toBe(3333);
    expect(r.guardar).toBe(340);
  });

  it("categoria sem plano e com gasto abaixo de R$ 1 não entra; gasto real 10% acima do plano é 'plano' (limite exato)", () => {
    const r = sugerirAno(
      {
        ano: 2026,
        renda: { planejada: 5000, mediana: null },
        guardarPlanejado: 500,
        categorias: [
          { key: "LAZER", label: "Lazer", planejado: 0, realMedio: 0.5, mae: true },
          { key: "ALIMENTACAO", label: "Alimentação", planejado: 1000, realMedio: 1100, mae: true },
        ],
      },
      money,
    );
    expect(r.categorias.map((c) => c.key)).toEqual(["ALIMENTACAO"]);
    expect(r.categorias[0]).toMatchObject({ sugerido: 1000, motivo: "plano" });
  });
});

describe("somarConquistas: valores ausentes", () => {
  it("lista vazia é tudo zero e 'desde' null; valor null conta como zero", () => {
    expect(somarConquistas([])).toEqual({ decisoes: 0, desistidas: 0, comprasPensadas: 0, raioxAnual: 0, rituais: 0, fechamentos: 0, desde: null });
    const r = somarConquistas([{ tipo: "compra_desisti", valor: null, createdAt: new Date(2026, 0, 1) }]);
    expect(r.desistidas).toBe(0);
    expect(r.comprasPensadas).toBe(1);
  });
});
