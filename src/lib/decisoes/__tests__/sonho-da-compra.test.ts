import { describe, expect, it } from "vitest";
import { planoDoSonho } from "../sonho-da-compra";

describe("Virar meta do Posso comprar?", () => {
  it("Ana: celular de R$ 3.000 com renda de R$ 7.700 vira 4 meses de R$ 750, compra em fev/2027", () => {
    expect(planoDoSonho(3000, 7700, { ano: 2026, mes: 10 })).toEqual({ meses: 4, porMes: 750, comeca: { ano: 2026, mes: 11 }, compraEm: { ano: 2027, mes: 2 }, compraEmCurto: "fev/2027" });
  });
  it("o por mês nunca passa de 10% da renda arredondado, e a soma cobre o valor", () => {
    for (const [valor, renda] of [[500, 1500], [12000, 4000], [99, 10000], [40000, 8000]]) {
      const p = planoDoSonho(valor, renda, { ano: 2026, mes: 12 })!;
      expect(p.porMes * p.meses).toBeGreaterThanOrEqual(valor);
      expect(p.porMes).toBeLessThanOrEqual(Math.ceil((renda * 0.1) / 10) * 10 + 10);
    }
  });
  it("sem renda, sem sonho (não inventa prazo)", () => {
    expect(planoDoSonho(3000, 0, { ano: 2026, mes: 10 })).toBeNull();
  });
});

describe("Virar meta: prazo máximo", () => {
  it("nunca passa de 120 meses (o limite do sonho criado)", () => {
    expect(planoDoSonho(40000, 3000, { ano: 2026, mes: 10 })!.meses).toBe(120);
  });
});
