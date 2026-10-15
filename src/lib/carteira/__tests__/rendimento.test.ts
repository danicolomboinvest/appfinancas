import { describe, expect, it } from "vitest";
import { registroDoComecoDoMes, rendimentoDoMes } from "../rendimento";

const r = (dia: string, ganho: number, total = 10000) => ({ dia, ganho, total });

describe("rendimento do mês da Carteira", () => {
  it("é a diferença do ganho desde o registro que abre o mês", () => {
    const x = rendimentoDoMes([r("2026-09-30", 500)], "2026-10-15", { ganho: 720, total: 10300 });
    expect(x).toEqual({ valor: 220, pct: 0.022, desde: "2026-09-30" });
  });

  it("aporte não é rendimento: sobe o atual e o investido juntos, então o ganho não muda", () => {
    // Tinha 10.000 com ganho 500; aportou 1.000 e nada rendeu: total 11.000, ganho continua 500.
    expect(rendimentoDoMes([r("2026-10-01", 500, 10000)], "2026-10-15", { ganho: 500, total: 11000 })).toMatchObject({ valor: 0 });
  });

  it("perda aparece negativa", () => {
    expect(rendimentoDoMes([r("2026-10-01", 500)], "2026-10-15", { ganho: 420, total: 9920 })).toMatchObject({ valor: -80 });
  });

  it("sem registro do começo do mês, não inventa: devolve null", () => {
    expect(rendimentoDoMes([], "2026-10-15", { ganho: 720, total: 10300 })).toBeNull();
    // Registro de dois meses atrás não abre o mês.
    expect(rendimentoDoMes([r("2026-08-10", 100)], "2026-10-15", { ganho: 720, total: 10300 })).toBeNull();
  });

  it("sem ganho conhecido (nenhum ativo com valor investido), não há rendimento", () => {
    expect(rendimentoDoMes([r("2026-10-01", 500)], "2026-10-15", { ganho: null, total: 10300 })).toBeNull();
  });

  it("quem começou a registrar no meio do mês vê o rendimento desde o primeiro registro", () => {
    expect(registroDoComecoDoMes([r("2026-10-08", 100), r("2026-10-12", 130)], "2026-10-15")).toMatchObject({ dia: "2026-10-08" });
  });

  it("o registro de hoje não conta como começo (não há o que comparar)", () => {
    expect(registroDoComecoDoMes([r("2026-10-15", 100)], "2026-10-15")).toBeNull();
  });

  it("até 10 dias antes do dia 1 ainda vale, e o mais recente ganha", () => {
    expect(registroDoComecoDoMes([r("2026-09-22", 1), r("2026-09-28", 2)], "2026-10-15")).toMatchObject({ dia: "2026-09-28" });
    expect(registroDoComecoDoMes([r("2026-09-18", 1)], "2026-10-15")).toBeNull();
  });
});
