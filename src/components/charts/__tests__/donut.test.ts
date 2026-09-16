import { describe, expect, it } from "vitest";
import { groupTail, donutRadii } from "../Donut";

const s = (name: string, value: number) => ({ name, value, color: "x" });

describe("groupTail", () => {
  it("ordena do maior para o menor e descarta fatia zerada", () => {
    const out = groupTail([s("a", 10), s("zero", 0), s("b", 30)], 6);
    expect(out.map((x) => x.name)).toEqual(["b", "a"]);
  });

  it("mantém tudo quando cabe no limite", () => {
    const out = groupTail([s("a", 3), s("b", 2), s("c", 1)], 3);
    expect(out).toHaveLength(3);
    expect(out.some((x) => x.name === "Outros")).toBe(false);
  });

  it("junta a cauda em Outros sem perder valor do total", () => {
    const entrada = [s("a", 50), s("b", 30), s("c", 8), s("d", 7), s("e", 5)];
    const out = groupTail(entrada, 3);
    expect(out.map((x) => x.name)).toEqual(["a", "b", "Outros"]);
    // O total tem que bater com o de antes, senão os percentuais mentem.
    const antes = entrada.reduce((t, x) => t + x.value, 0);
    const depois = out.reduce((t, x) => t + x.value, 0);
    expect(depois).toBe(antes);
    expect(out[2].value).toBe(20);
  });

  it("não deixa 'Outros' com uma fatia só — o limite conta a própria Outros", () => {
    // 4 fatias com limite 4 cabem inteiras; se agrupasse, "Outros" teria uma fatia só,
    // que é pior que mostrar o nome dela.
    const out = groupTail([s("a", 4), s("b", 3), s("c", 2), s("d", 1)], 4);
    expect(out.map((x) => x.name)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("donutRadii", () => {
  it("nunca passa da metade da caixa — senão o SVG corta o círculo", () => {
    // Foi exatamente esse o bug: raio 90 numa caixa de 160 cortava os quatro lados e a rosca
    // ficava com cara de octógono.
    for (const size of [120, 140, 160, 170, 180, 200, 240]) {
      const { inner, outer } = donutRadii(size);
      expect(outer).toBeLessThanOrEqual(size / 2);
      expect(inner).toBeLessThan(outer);
      expect(inner).toBeGreaterThan(0);
    }
  });

  it("mantém a espessura de anel do desenho aprovado", () => {
    // Faixa, e não valor exato: os raios são arredondados pra pixel inteiro, então a razão
    // oscila um pouco conforme o tamanho. O que importa é a espessura continuar sendo a mesma.
    for (const size of [140, 160, 200]) {
      const { inner, outer } = donutRadii(size);
      expect(inner / outer).toBeGreaterThan(0.66);
      expect(inner / outer).toBeLessThan(0.7);
    }
  });
});
