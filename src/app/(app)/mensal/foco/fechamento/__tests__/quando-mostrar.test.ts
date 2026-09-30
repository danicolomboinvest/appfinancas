import { describe, expect, it } from "vitest";
import { ondeMostrarFechamento } from "../quando-mostrar";

const base = { fechamentoFeito: false, mesAnteriorTemDados: true, dia: 3 };

describe("ondeMostrarFechamento (card do fechamento na aba Foco)", () => {
  it("quem nunca escolheu o ritmo também vê o fechamento, como quem escolheu mensal", () => {
    expect(ondeMostrarFechamento({ ...base, ritmo: null })).toBe("destaque");
    expect(ondeMostrarFechamento({ ...base, ritmo: null, dia: 28 })).toBe("destaque");
    expect(ondeMostrarFechamento({ ...base, ritmo: "mensal" })).toBe("destaque");
  });

  it("ritmo semanal: a linha discreta, só na primeira quinzena", () => {
    expect(ondeMostrarFechamento({ ...base, ritmo: "semanal", dia: 15 })).toBe("discreto");
    expect(ondeMostrarFechamento({ ...base, ritmo: "semanal", dia: 16 })).toBeNull();
  });

  it("já fechado, ou mês anterior vazio: não aparece pra ninguém", () => {
    for (const ritmo of [null, "mensal", "semanal"] as const) {
      expect(ondeMostrarFechamento({ ...base, ritmo, fechamentoFeito: true })).toBeNull();
      expect(ondeMostrarFechamento({ ...base, ritmo, mesAnteriorTemDados: false })).toBeNull();
    }
  });
});
