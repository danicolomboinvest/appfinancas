import { describe, expect, it } from "vitest";
import { parseRate } from "../parse-rate";

describe("parseRate", () => {
  it("aceita vírgula decimal (teclado em português)", () => {
    expect(parseRate("5,91")).toBe(5.91);
    expect(parseRate("5,9071")).toBe(5.9071);
    expect(parseRate("0,18")).toBe(0.18);
  });

  it("aceita ponto decimal (teclado em inglês) sem multiplicar a cotação", () => {
    expect(parseRate("5.91")).toBe(5.91);
    expect(parseRate("5.9071")).toBe(5.9071);
    expect(parseRate("0.18")).toBe(0.18);
  });

  it("ponto com vírgula é milhar", () => {
    expect(parseRate("1.234,56")).toBe(1234.56);
  });

  it("ignora espaços em volta", () => {
    expect(parseRate(" 5,91 ")).toBe(5.91);
  });

  it("recusa vazio, zero, negativo e lixo", () => {
    expect(parseRate("")).toBeNull();
    expect(parseRate("0")).toBeNull();
    expect(parseRate("-5,91")).toBeNull();
    expect(parseRate("abc")).toBeNull();
    expect(parseRate("5,9,1")).toBeNull();
  });
});
