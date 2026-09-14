import { describe, it, expect } from "vitest";
import { sameDayInMonth } from "../recurrence";

/** O campo no banco é @db.Date, então a referência vem sempre ancorada em UTC. */
const ref = (iso: string) => new Date(`${iso}T12:00:00Z`);
const dayOf = (d: Date) => d.getDate();

describe("sameDayInMonth", () => {
  it("mantém o mesmo dia nos meses seguintes", () => {
    expect(dayOf(sameDayInMonth(ref("2026-09-05"), 2026, 10))).toBe(5);
    expect(dayOf(sameDayInMonth(ref("2026-09-05"), 2026, 12))).toBe(5);
  });

  it("dia 31 encosta no último dia de mês curto, não vaza pro mês seguinte", () => {
    const abril = sameDayInMonth(ref("2026-01-31"), 2026, 4); // abril tem 30
    expect(abril.getMonth()).toBe(3); // continua em abril
    expect(dayOf(abril)).toBe(30);
  });

  it("dia 30 em fevereiro vira 28 (ou 29 em ano bissexto)", () => {
    expect(dayOf(sameDayInMonth(ref("2026-01-30"), 2026, 2))).toBe(28);
    expect(dayOf(sameDayInMonth(ref("2028-01-30"), 2028, 2))).toBe(29);
  });

  it("nunca muda o mês de destino — a consolidação é por year/month", () => {
    for (let month = 1; month <= 12; month++) {
      const result = sameDayInMonth(ref("2026-01-31"), 2026, month);
      expect(result.getMonth()).toBe(month - 1);
      expect(result.getFullYear()).toBe(2026);
    }
  });
});
