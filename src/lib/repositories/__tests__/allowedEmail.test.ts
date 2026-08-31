import { describe, it, expect } from "vitest";
import { isExpired } from "../allowedEmail.repo";

// Instantes sempre ao meio-dia: evita que uma diferença de fuso entre a máquina que roda o
// teste e o Brasil (America/Sao_Paulo, usado por dentro de isExpired) empurre a data pro dia
// vizinho e estrague a comparação — o que se testa aqui é a regra de calendário, não a
// conversão de fuso em si (isso é responsabilidade de nowInBrazil).
const noon = (year: number, month: number, day: number) => new Date(year, month, day, 12, 0, 0);

describe("isExpired", () => {
  it("sem prazo (null) nunca vence", () => {
    expect(isExpired(null, noon(2027, 0, 1))).toBe(false);
  });

  it("acesso 'até' um dia ainda vale o dia inteiro (não vence no mesmo dia)", () => {
    expect(isExpired(noon(2026, 7, 30), noon(2026, 7, 30))).toBe(false);
  });

  it("vence no dia seguinte ao prazo", () => {
    expect(isExpired(noon(2026, 7, 30), noon(2026, 7, 31))).toBe(true);
  });

  it("não vence antes do prazo", () => {
    expect(isExpired(noon(2027, 0, 1), noon(2026, 11, 31))).toBe(false);
  });

  it("vence bem depois do prazo (virada de ano)", () => {
    expect(isExpired(noon(2026, 11, 31), noon(2027, 0, 1))).toBe(true);
  });
});
