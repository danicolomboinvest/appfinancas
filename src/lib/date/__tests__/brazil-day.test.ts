import { describe, expect, it } from "vitest";
import { addUtcDays, brazilTodayUtc } from "../brazil-day";

/**
 * O caso que motivou: 22h30 de 28/09 em Brasília já é 29/09 01h30 em UTC (fuso do servidor),
 * e o provento que paga em 29/09 aparecia como "Caiu na conta" na véspera.
 */
describe("brazilTodayUtc", () => {
  it("às 22h30 de Brasília ainda é o mesmo dia", () => {
    expect(brazilTodayUtc(new Date("2026-09-29T01:30:00Z")).toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });

  it("de manhã em Brasília é o dia de Brasília", () => {
    expect(brazilTodayUtc(new Date("2026-09-28T12:00:00Z")).toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });

  it("virada do ano às 23h de 31/12 em Brasília", () => {
    expect(brazilTodayUtc(new Date("2027-01-01T02:00:00Z")).toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });

  it("provento de amanhã fica depois de hoje; o de hoje fica dentro", () => {
    const hoje = brazilTodayUtc(new Date("2026-09-29T01:30:00Z"));
    const pagamentoAmanha = new Date("2026-09-29T00:00:00Z");
    const pagamentoHoje = new Date("2026-09-28T00:00:00Z");
    expect(pagamentoAmanha <= hoje).toBe(false);
    expect(pagamentoHoje >= hoje && pagamentoHoje <= hoje).toBe(true);
  });
});

describe("addUtcDays", () => {
  it("anda dias inteiros", () => {
    expect(addUtcDays(new Date("2026-09-28T00:00:00Z"), -10).toISOString()).toBe("2026-09-18T00:00:00.000Z");
    expect(addUtcDays(new Date("2026-09-28T00:00:00Z"), 30).toISOString()).toBe("2026-10-28T00:00:00.000Z");
  });
});
