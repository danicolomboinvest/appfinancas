import { describe, expect, it } from "vitest";
import { fraseDoGuardado, linhaDoMes, mesSelecionadoDeInicio, mesesAte, montarMeses } from "../seis-meses";

const money = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
/** Os últimos 6 meses da Ana (ana-canonica.md, seção 2). */
const ana = [
  { ano: 2026, mes: 5, entrou: 7700, gastou: 6900, guardou: 700 },
  { ano: 2026, mes: 6, entrou: 7700, gastou: 7400, guardou: 300 },
  { ano: 2026, mes: 7, entrou: 7900, gastou: 8100, guardou: 0 },
  { ano: 2026, mes: 8, entrou: 7700, gastou: 7000, guardou: 700 },
  { ano: 2026, mes: 9, entrou: 7700, gastou: 6600, guardou: 900 },
  { ano: 2026, mes: 10, entrou: 7700, gastou: 4059, guardou: 900 },
];

describe("Últimos 6 meses (rodada 58)", () => {
  const meses = montarMeses(ana, { ano: 2026, mes: 10 }, 6);

  it("cada mês com sobrou, empatou ou faltou pela conta única", () => {
    expect(meses.map((m) => [m.rotulo, m.situacao, m.sobrou])).toEqual([
      ["Mai", "sobrou", 100],
      ["Jun", "empatou", 0],
      ["Jul", "faltou", -200],
      ["Ago", "empatou", 0],
      ["Set", "sobrou", 200],
      ["Out", "sobrou", 2741],
    ]);
    expect(meses.at(-1)!.atual).toBe(true);
  });

  it("abre em setembro, o último mês fechado, com a linha do mês", () => {
    const i = mesSelecionadoDeInicio(meses);
    expect(meses[i].rotulo).toBe("Set");
    expect(linhaDoMes(meses[i], money)).toBe("Setembro: entrou R$ 7.700, gastou R$ 6.600, guardou R$ 900, sobrou R$ 200.");
    expect(linhaDoMes(meses[2], money)).toBe("Julho: entrou R$ 7.900, gastou R$ 8.100, guardou R$ 0, faltou R$ 200.");
    expect(linhaDoMes(meses[1], money)).toContain("empatou.");
  });

  it("a frase de baixo: de maio a setembro guardou R$ 2.600, R$ 520 por mês", () => {
    expect(fraseDoGuardado(meses, money)).toBe("De maio a setembro você guardou R$ 2.600, R$ 520 por mês.");
  });

  it("vira o ano certo e preenche mês sem movimento com zero", () => {
    expect(mesesAte(2026, 2, 4)).toEqual([{ ano: 2025, mes: 11 }, { ano: 2025, mes: 12 }, { ano: 2026, mes: 1 }, { ano: 2026, mes: 2 }]);
    const vazio = montarMeses([], { ano: 2026, mes: 2 }, 3);
    expect(vazio.every((m) => m.entrou === 0 && m.situacao === "vazio")).toBe(true);
    // Mês sem lançamento não "empata": não tem palavra no gráfico e a linha diz que está vazio.
    expect(linhaDoMes(vazio[0], money)).toBe("Dezembro: sem lançamento.");
    expect(fraseDoGuardado(vazio, money)).toBeNull();
  });
});
