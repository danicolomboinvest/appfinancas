import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { semanaDe } from "../adoption-funnel.repo";

/**
 * Coorte semanal do funil de adoção (admin): semanaDe(u.createdAt) lê o createdAt — um instante
 * real — com getFullYear/getMonth/getDate no fuso do SERVIDOR (adoption-funnel.repo.ts:81). Na
 * Vercel (UTC), quem se cadastrou domingo depois das 21h de Brasília já é segunda em UTC e cai
 * na coorte da semana SEGUINTE. Os testes antigos passam datas locais e rodam no fuso do Mac, por
 * isso não pegavam.
 *
 * Corrigido: semanaDe lê o dia no calendário de Brasília. Estes testes seguram o conserto.
 */

const fusoOriginal = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  process.env.TZ = fusoOriginal;
});

describe("semanaDe no servidor UTC", () => {
  it("controle: domingo 20/09/2026 ao meio-dia (Brasília) é da semana de 14/09", () => {
    expect(semanaDe(new Date("2026-09-20T15:00:00Z"))).toBe("2026-09-14");
  });

  it("cadastro domingo 20/09/2026 às 22h (Brasília) fica na coorte de 14/09", () => {
    expect(semanaDe(new Date("2026-09-21T01:00:00Z"))).toBe("2026-09-14");
  });
});
