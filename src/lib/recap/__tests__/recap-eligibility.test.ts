import { describe, expect, it } from "vitest";
import { getRecapEligibility, nomeDoMes } from "../monthly";

// Datas locais (o app passa nowInBrazil(), que já está no relógio de Brasília).
const dia = (ano: number, mes: number, d: number) => new Date(ano, mes - 1, d, 10, 0, 0);

describe("getRecapEligibility (janela dos stories do mês)", () => {
  it("do dia 1 ao 7 recapeia o mês ANTERIOR", () => {
    expect(getRecapEligibility(dia(2026, 10, 1), null)).toEqual({ eligible: true, year: 2026, month: 9, monthKey: "2026-09-fechado" });
    expect(getRecapEligibility(dia(2026, 10, 7), null).eligible).toBe(true);
  });

  it("virada do ano: em janeiro recapeia dezembro do ano anterior", () => {
    expect(getRecapEligibility(dia(2027, 1, 3), null)).toEqual({ eligible: true, year: 2026, month: 12, monthKey: "2026-12-fechado" });
  });

  it("do dia 8 em diante não mostra nada", () => {
    expect(getRecapEligibility(dia(2026, 9, 8), null).eligible).toBe(false);
    expect(getRecapEligibility(dia(2026, 9, 15), null).eligible).toBe(false);
  });

  it("do dia 25 ao fim do mês NÃO mostra o mês pela metade", () => {
    // Antes abria com o mês corrente e a mesma chave do resumo do dia 1: fechar no dia 26
    // escondia o resumo de setembro fechado pra sempre.
    expect(getRecapEligibility(dia(2026, 9, 25), null).eligible).toBe(false);
    expect(getRecapEligibility(dia(2026, 9, 30), null).eligible).toBe(false);
  });

  it("some depois de fechado, e volta no mês seguinte", () => {
    expect(getRecapEligibility(dia(2026, 10, 2), "2026-09-fechado").eligible).toBe(false);
    expect(getRecapEligibility(dia(2026, 11, 2), "2026-09-fechado").eligible).toBe(true);
  });

  it("quem fechou o mês pela metade (chave antiga, gravada entre 25 e 30/09) ainda vê setembro fechado", () => {
    expect(getRecapEligibility(dia(2026, 10, 1), "2026-09").eligible).toBe(true);
  });
});

describe("nomeDoMes", () => {
  it("devolve só o nome do mês, minúsculo, pra frase 'Em setembro você gastou'", () => {
    expect(nomeDoMes(2026, 9)).toBe("setembro");
    expect(nomeDoMes(2026, 3)).toBe("março");
  });
});
