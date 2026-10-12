import { describe, expect, it } from "vitest";
import { corDoPlano, fatiasDoPlano } from "../cores-do-plano";

describe("cores e fatias do Seu plano", () => {
  it("não repete cor nas primeiras 21 categorias", () => {
    const cores = Array.from({ length: 21 }, (_, i) => corDoPlano(i));
    expect(new Set(cores).size).toBe(21);
  });
  it("tira as de 0 e junta as menores que 2% em Outras", () => {
    const f = fatiasDoPlano([
      { k: "a", n: "Dani Invest", v: 11200 },
      { k: "b", n: "Lazer", v: 3000 },
      { k: "c", n: "Contabilidade", v: 200 },
      { k: "d", n: "Moradia", v: 150 },
      { k: "e", n: "Saúde", v: 0 },
    ]);
    expect(f.map((x) => x.n)).toEqual(["Dani Invest", "Lazer", "Outras"]);
    expect(f[2].v).toBe(350);
  });
  it("uma pequena sozinha fica com o próprio nome", () => {
    expect(fatiasDoPlano([{ k: "a", n: "A", v: 1000 }, { k: "b", n: "B", v: 10 }]).map((x) => x.n)).toEqual(["A", "B"]);
  });
});
