import { describe, expect, it } from "vitest";
import { redistribuir } from "../ajuste-da-estrategia";

const MODERADA = { RENDA_FIXA_POS_FIXADA: 35, RENDA_FIXA_IPCA: 20, PREFIXADO: 5, ACOES_BRASIL: 15, FIIS: 15, EXTERIOR: 10, OUTROS: 0 };
const soma = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);

describe("Ajustar a estratégia: a soma fica em 100", () => {
  it("subir o exterior para 20 tira das outras na proporção", () => {
    const r = redistribuir(MODERADA, "EXTERIOR", 20);
    expect(r.EXTERIOR).toBe(20);
    expect(soma(r)).toBe(100);
    expect(r.RENDA_FIXA_POS_FIXADA).toBeLessThan(35);
  });
  it("em qualquer valor de 0 a 100, em qualquer classe", () => {
    for (const k of Object.keys(MODERADA) as (keyof typeof MODERADA)[]) for (const v of [0, 1, 33, 77, 100]) expect(soma(redistribuir(MODERADA, k, v))).toBe(100);
  });
  it("com as outras zeradas, o resto vai para a primeira", () => {
    const tudoNoExterior = { ...MODERADA, RENDA_FIXA_POS_FIXADA: 0, RENDA_FIXA_IPCA: 0, PREFIXADO: 0, ACOES_BRASIL: 0, FIIS: 0, EXTERIOR: 100 };
    expect(redistribuir(tudoNoExterior, "EXTERIOR", 60).RENDA_FIXA_POS_FIXADA).toBe(40);
  });
});
