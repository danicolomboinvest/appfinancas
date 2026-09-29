import { describe, expect, it } from "vitest";
import { filtroDaSemana } from "../budget.repo";

describe("filtroDaSemana", () => {
  const hoje = new Date(2026, 8, 28, 19, 0); // 28/09/2026, componentes do Brasil
  const since = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
  const filtro = filtroDaSemana(since, hoje);

  it("com dia: de hoje−6 até hoje, nunca um dia futuro (cópia recorrente de outubro)", () => {
    expect(filtro.OR[0]).toEqual({
      entryDate: { gte: new Date(Date.UTC(2026, 8, 22)), lte: new Date(Date.UTC(2026, 8, 28)) },
    });
  });

  it("sem dia: lançado na semana e só de mês que já chegou (parcela futura fica de fora)", () => {
    expect(filtro.OR[1]).toEqual({
      entryDate: null,
      createdAt: { gte: since },
      OR: [{ year: { lt: 2026 } }, { year: 2026, month: { lte: 9 } }],
    });
  });

  it("vira o mês sem erro de dia (1º de outubro olha até 25/09)", () => {
    const f = filtroDaSemana(new Date(2026, 8, 24), new Date(2026, 9, 1, 8));
    expect(f.OR[0]).toEqual({ entryDate: { gte: new Date(Date.UTC(2026, 8, 25)), lte: new Date(Date.UTC(2026, 9, 1)) } });
  });
});
