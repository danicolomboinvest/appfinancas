import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resumoDoMes } from "../month-budget-summary";

/**
 * `ultimoGasto` vem de getUltimoGastoAte: é a coluna `entryDate` (@db.Date), que o Prisma
 * devolve à MEIA-NOITE UTC. resumoDoMes lê com getDate() e meiaNoite() no fuso LOCAL
 * (month-budget-summary.ts:98 e :132).
 *
 * Em produção (Vercel, UTC) dá certo por coincidência. Em qualquer processo fora de UTC — o
 * `next dev` da Dani no Mac, que lê o MESMO banco de produção — a data volta um dia: "último
 * gasto dia 9" quando foi dia 10, e um dia a mais "sem lançar", o que pode esconder o "R$ X por
 * dia" (desatualizado) um dia antes da hora. O resto do app lê @db.Date com getUTC* por isso.
 *
 * Corrigido: resumoDoMes lê `ultimoGasto` com getUTC*. Estes testes seguram o conserto.
 */

const fusoOriginal = process.env.TZ;
afterAll(() => {
  process.env.TZ = fusoOriginal;
});

// Como o Prisma entrega um @db.Date de 10/09/2026.
const dia10 = new Date("2026-09-10T00:00:00.000Z");

describe("resumoDoMes em servidor UTC (produção)", () => {
  beforeAll(() => {
    process.env.TZ = "UTC";
  });

  it("controle: último gasto dia 10, hoje dia 13 → 3 dias sem lançar", () => {
    const hoje = new Date(2026, 8, 13, 15); // como nowInBrazil() entrega
    const r = resumoDoMes({ planejado: 3000, gasto: 1000, hoje, ano: 2026, mes: 9, ultimoGasto: dia10 });
    expect(r.ultimoDiaLancado).toBe(10);
    expect(r.diasSemLancar).toBe(3);
  });
});

describe("resumoDoMes fora de UTC (next dev no Brasil)", () => {
  beforeAll(() => {
    process.env.TZ = "America/Sao_Paulo";
  });

  it("o dia do último gasto não volta um dia (10 continua 10)", () => {
    const hoje = new Date(2026, 8, 13, 15);
    const r = resumoDoMes({ planejado: 3000, gasto: 1000, hoje, ano: 2026, mes: 9, ultimoGasto: dia10 });
    expect(r.ultimoDiaLancado).toBe(10);
  });

  it("não conta um dia a mais sem lançar nem marca o mês como desatualizado um dia antes", () => {
    // Último gasto dia 10, hoje dia 12: 2 dias, ainda dentro da folga (DIAS_ATE_ENVELHECER = 2).
    // Fora de UTC vira 3, o mês passa a "desatualizado" e o "R$ X por dia" some.
    const hoje = new Date(2026, 8, 12, 15);
    const r = resumoDoMes({ planejado: 3000, gasto: 1000, hoje, ano: 2026, mes: 9, ultimoGasto: dia10 });
    expect(r.diasSemLancar).toBe(2);
    expect(r.desatualizado).toBe(false);
    expect(r.porDia).not.toBeNull();
  });
});
