import { describe, expect, it } from "vitest";
import { montarPassos, semanaDe } from "../adoption-funnel.repo";

describe("montarPassos", () => {
  it("mostra onde as pessoas se perdem entre um passo e o seguinte", () => {
    const p = montarPassos(
      [
        { label: "Tem conta", pessoas: 175 },
        { label: "Abriu o app", pessoas: 105 },
        { label: "Lançou alguma coisa", pessoas: 56 },
      ],
      175,
    );
    expect(p[0].perdidas).toBe(0);
    expect(p[1].perdidas).toBe(70);
    expect(p[2].perdidas).toBe(49);
    expect(Math.round(p[1].doTotal * 100)).toBe(60);
  });

  /**
   * O erro que esta função existe pra impedir: contar dois passos que não se encaixam dava
   * "−3 pessoas perdidas" na tela, e um funil com queda negativa não é um funil, é um gráfico
   * que mente com cara de relatório.
   */
  it("nunca mostra queda negativa", () => {
    const p = montarPassos(
      [
        { label: "Definiu orçamento", pessoas: 27 },
        { label: "Criou meta", pessoas: 30 },
      ],
      175,
    );
    expect(p[1].perdidas).toBe(0);
  });

  it("aguenta base vazia sem dividir por zero", () => {
    const p = montarPassos([{ label: "Tem conta", pessoas: 0 }], 0);
    expect(p[0].doTotal).toBe(0);
  });
});

describe("semanaDe", () => {
  it("agrupa a semana pela segunda-feira", () => {
    // 17/08/2026 é uma segunda; 20 e 23 do mesmo mês caem na mesma semana dela.
    expect(semanaDe(new Date(2026, 7, 17))).toBe("2026-08-17");
    expect(semanaDe(new Date(2026, 7, 20))).toBe("2026-08-17");
    expect(semanaDe(new Date(2026, 7, 23))).toBe("2026-08-17");
  });

  /** Domingo pertence à semana que começou na segunda anterior, não à seguinte. */
  it("não joga o domingo pra semana seguinte", () => {
    expect(semanaDe(new Date(2026, 8, 20))).toBe("2026-09-14");
    expect(semanaDe(new Date(2026, 8, 21))).toBe("2026-09-21");
  });
});
