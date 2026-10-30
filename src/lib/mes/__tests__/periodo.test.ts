import { describe, expect, it } from "vitest";
import { diaDeInicioDoMes, intervaloDoMes, mesDoPeriodo } from "../periodo";

describe("mês que começa no dia da pessoa", () => {
  it("sem dia escolhido, o mês é o de sempre", () => {
    expect(mesDoPeriodo("2026-10-03", null)).toEqual({ year: 2026, month: 10 });
    expect(mesDoPeriodo("2026-10-03", 1)).toEqual({ year: 2026, month: 10 });
  });

  it("dia 15: de 15/10 a 14/11 é outubro", () => {
    expect(mesDoPeriodo("2026-10-15", 15)).toEqual({ year: 2026, month: 10 });
    expect(mesDoPeriodo("2026-10-31", 15)).toEqual({ year: 2026, month: 10 });
    expect(mesDoPeriodo("2026-11-14", 15)).toEqual({ year: 2026, month: 10 });
    expect(mesDoPeriodo("2026-11-15", 15)).toEqual({ year: 2026, month: 11 });
    expect(mesDoPeriodo("2026-10-14", 15)).toEqual({ year: 2026, month: 9 });
  });

  it("vira o ano em janeiro", () => {
    expect(mesDoPeriodo("2027-01-05", 15)).toEqual({ year: 2026, month: 12 });
  });

  it("aceita a data do formulário (Date local ao meio-dia)", () => {
    expect(mesDoPeriodo(new Date(2026, 9, 3, 12), 15)).toEqual({ year: 2026, month: 9 });
  });

  it("data inválida ou vazia não vira mês", () => {
    expect(mesDoPeriodo(null, 15)).toBeNull();
    expect(mesDoPeriodo("amanhã", 15)).toBeNull();
  });

  it("só vale de 2 a 28", () => {
    expect(diaDeInicioDoMes("15")).toBe(15);
    expect(diaDeInicioDoMes(28)).toBe(28);
    for (const ruim of [0, 1, 29, 31, 1.5, "", "abc", null, undefined]) expect(diaDeInicioDoMes(ruim)).toBeNull();
  });

  it("o intervalo para a tela", () => {
    expect(intervaloDoMes(2026, 10, 15)).toBe("15/10 a 14/11");
    expect(intervaloDoMes(2026, 12, 15)).toBe("15/12 a 14/01");
    expect(intervaloDoMes(2026, 2, 28)).toBe("28/02 a 27/03");
    expect(intervaloDoMes(2026, 10, null)).toBeNull();
  });
});

import { dentroDoPeriodo, diaNoPeriodo, diasRestantesNoMes, mesDeAgoraDaPessoa, periodoDeAgora, periodoDoMes, relogioDoMes } from "../periodo";

describe("o período na tela (30/10/2026)", () => {
  it("sem dia escolhido, tudo é o mês de sempre: o mesmo que o calendário dava", () => {
    for (const dia of [null, undefined, 1, 0, 29]) {
      const p = periodoDoMes(2026, 10, dia);
      expect([p.inicioIso, p.fimIso, p.dias]).toEqual(["2026-10-01", "2026-10-31", 31]);
      expect(periodoDoMes(2026, 2, dia).dias).toBe(28);
      expect(periodoDoMes(2028, 2, dia).dias).toBe(29);
      const agora = new Date(2026, 10, 5, 10); // 05/11
      expect(mesDeAgoraDaPessoa(agora, dia)).toEqual({ year: 2026, month: 11 });
      expect(diaNoPeriodo(agora, periodoDeAgora(agora, dia))).toBe(5);
      expect(diasRestantesNoMes(agora, dia)).toBe(30 - 5 + 1);
      expect(diasRestantesNoMes(new Date(2026, 9, 31), dia)).toBe(1);
      expect(diaNoPeriodo("2026-10-20", periodoDoMes(2026, 10, dia))).toBe(20);
    }
  });

  it("dia 15: outubro vai de 15/10 a 14/11, e em 05/11 o mês de agora ainda é outubro", () => {
    const p = periodoDoMes(2026, 10, 15);
    expect([p.inicioIso, p.fimIso, p.dias]).toEqual(["2026-10-15", "2026-11-14", 31]);
    const agora = new Date(2026, 10, 5, 10);
    expect(mesDeAgoraDaPessoa(agora, 15)).toEqual({ year: 2026, month: 10 });
    expect(diaNoPeriodo(agora, p)).toBe(22); // 15/10 é o dia 1; 05/11 é o 22º
    expect(diasRestantesNoMes(agora, 15)).toBe(10); // 5 a 14/11, contando hoje
    expect(diasRestantesNoMes(new Date(2026, 10, 14), 15)).toBe(1);
    expect(diasRestantesNoMes(new Date(2026, 10, 15), 15)).toBe(30); // novembro: 15/11 a 14/12
    expect(dentroDoPeriodo("2026-11-14", p)).toBe(true);
    expect(dentroDoPeriodo("2026-11-15", p)).toBe(false);
    expect(dentroDoPeriodo("2026-10-14", p)).toBe(false);
    expect(diaNoPeriodo("2026-10-14", p)).toBe(0);
  });

  it("virada do ano e fevereiro", () => {
    expect(periodoDoMes(2026, 12, 15).fimIso).toBe("2027-01-14");
    expect(periodoDoMes(2026, 2, 28)).toMatchObject({ inicioIso: "2026-02-28", fimIso: "2026-03-27", dias: 28 });
    expect(periodoDoMes(2026, 1, 28)).toMatchObject({ inicioIso: "2026-01-28", fimIso: "2026-02-27", dias: 31 });
    expect(mesDeAgoraDaPessoa(new Date(2027, 0, 5), 15)).toEqual({ year: 2026, month: 12 });
  });
});

describe("o relógio do Resumo (relogioDoMes)", () => {
  /** O que o carregarFoco calculava antes de 30/10/2026, direto do calendário. */
  const deAntes = (now: Date, indice: number) => {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dia = now.getDate();
    const diasNoMes = new Date(year, month, 0).getDate();
    return {
      year,
      month,
      dia,
      diasNoMes,
      hojeUtc: new Date(Date.UTC(year, month - 1, dia)),
      hojeIso: `${year}-${String(month).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
      inicioDoMes: new Date(Date.UTC(year, month - 1, 1, 3)),
      inicioDaSemana: new Date(Date.UTC(year, month - 1, Math.max(1, dia - indice), 3)),
      fimDoMesIso: `${year}-${String(month).padStart(2, "0")}-${String(diasNoMes).padStart(2, "0")}`,
    };
  };

  it("sem dia escolhido (as ~1.000 contas de hoje), é idêntico ao de antes, em todos os dias de um ano inteiro", () => {
    for (let n = 0; n < 366; n += 1) {
      const now = new Date(2026, 0, 1 + n, 10);
      const indice = (n * 3) % 7;
      for (const dia of [null, undefined, 1]) {
        const r = relogioDoMes(now, dia, indice);
        const a = deAntes(now, indice);
        expect({ year: r.year, month: r.month, dia: r.dia, diasNoMes: r.diasNoMes, hojeUtc: r.hojeUtc, hojeIso: r.hojeIso, inicioDoMes: r.inicioDoMes, inicioDaSemana: r.inicioDaSemana, fimDoMesIso: r.periodo.fimIso }).toEqual(a);
      }
    }
  });

  it("dia 15, em quinta 05/11: outubro, dia 22 de 31, semana desde segunda 02/11, mês desde 15/10 e até 14/11", () => {
    const r = relogioDoMes(new Date(2026, 10, 5, 10), 15, 3);
    expect([r.year, r.month, r.dia, r.diasNoMes]).toEqual([2026, 10, 22, 31]);
    expect(r.hojeIso).toBe("2026-11-05");
    expect(r.inicioDoMes.toISOString()).toBe("2026-10-15T03:00:00.000Z");
    expect(r.inicioDaSemana.toISOString()).toBe("2026-11-02T03:00:00.000Z");
    expect(r.periodo.fimIso).toBe("2026-11-14");
    // Sexta 16/10, dia 2 do mês: a semana começou segunda 12/10, antes do mês; vale o dia 15.
    expect(relogioDoMes(new Date(2026, 9, 16, 10), 15, 4).inicioDaSemana.toISOString()).toBe("2026-10-15T03:00:00.000Z");
  });
});
