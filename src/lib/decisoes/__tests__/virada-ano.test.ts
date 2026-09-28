import { describe, expect, it } from "vitest";
import { sugerirAno } from "../virada-ano";

const money = (v: number) => `R$ ${Math.round(v)}`;
const cat = (key: string, planejado: number, realMedio: number) => ({ key, label: key, planejado, realMedio, mae: true });

describe("sugerirAno", () => {
  it("mantém o plano que funcionou e sobe o que ficou baixo", () => {
    const s = sugerirAno({ ano: 2026, renda: { planejada: 10000, mediana: 9800 }, guardarPlanejado: 1500, categorias: [cat("MORADIA", 3000, 3000), cat("ALIMENTACAO", 1200, 1650), cat("LAZER", 600, 500)] }, money);
    expect(s.categorias.map((c) => [c.key, c.sugerido, c.motivo])).toEqual([
      ["MORADIA", 3000, "plano"],
      ["ALIMENTACAO", 1650, "real"],
      ["LAZER", 600, "plano"],
    ]);
    expect(s.renda).toBe(10000);
    expect(s.guardar).toBe(1500);
    expect(s.avisos).toEqual([]);
  });

  it("guardar nunca fica abaixo de 10% da renda; sem plano de renda, usa a mediana", () => {
    const s = sugerirAno({ ano: 2026, renda: { planejada: null, mediana: 8000 }, guardarPlanejado: 300, categorias: [cat("A", 5000, 5000)] }, money);
    expect(s.renda).toBe(8000);
    expect(s.guardar).toBe(800);
    expect(s.avisos.join(" ")).toContain("10%");
  });

  it("categoria que ela gastou sem planejar entra com o gasto real; avisa se passar de 90%", () => {
    const s = sugerirAno({ ano: 2026, renda: { planejada: 6000, mediana: null }, guardarPlanejado: 600, categorias: [cat("A", 4000, 4000), cat("B", 0, 1500)] }, money);
    expect(s.categorias.find((c) => c.key === "B")?.motivo).toBe("novo");
    expect(s.avisos.some((a) => a.includes("90%"))).toBe(true);
  });
});
