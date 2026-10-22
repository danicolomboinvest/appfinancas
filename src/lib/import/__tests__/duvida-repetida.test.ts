import { describe, expect, it } from "vitest";
import { duvidasIguais, semDuvidaRepetida } from "../revisao-em-grupo";

const pix = (key: number, mes: string, valor: number, extra: Record<string, unknown> = {}) => ({
  key,
  description: `Transferência enviada pelo Pix - TESTE CACADOR - •••.123.456-•• - ITAÚ UNIBANCO`,
  category: "EXPENSE",
  parentCategory: null,
  customCategoryId: null,
  autoClassified: false,
  profileId: null,
  duvida: "conta_propria",
  amount: valor,
  date: `2026-${mes}-09`,
  ...extra,
});

describe("o mesmo Pix para a própria conta, mês a mês (22/10/2026)", () => {
  const linhas = [pix(1, "08", 500), pix(2, "09", 500), pix(3, "10", 500), pix(4, "10", 300), pix(5, "10", 500, { description: "Transferência enviada pelo Pix - MARIA DA SILVA - •••.987.654-••" })];

  it("vira uma pergunta só: mesma pessoa e mesmo valor", () => {
    expect(semDuvidaRepetida(linhas).map((l) => l.key)).toEqual([1, 4, 5]);
  });

  it("a resposta vale para as iguais que ainda esperam", () => {
    expect(duvidasIguais(linhas, 1)).toEqual([2, 3]);
    expect(duvidasIguais(linhas.map((l) => (l.key === 2 ? { ...l, duvida: null } : l)), 1)).toEqual([3]);
    expect(duvidasIguais(linhas, 4)).toEqual([]);
  });

  it("outra dúvida (resgate) não junta", () => {
    const resgates = [pix(1, "08", 500, { duvida: "resgate" }), pix(2, "09", 500, { duvida: "resgate" })];
    expect(semDuvidaRepetida(resgates)).toHaveLength(2);
    expect(duvidasIguais(resgates, 1)).toEqual([]);
  });
});
