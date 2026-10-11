import { describe, expect, it } from "vitest";
import { dataLonga, renovacaoEm } from "../renovacao";

const d = (a: number, m: number, dia: number) => new Date(Date.UTC(a, m - 1, dia));

describe("renovação da assinatura: 1 ano depois da compra", () => {
  it("comprou em 15/03/2026: renova em 15 de março de 2027", () => {
    expect(dataLonga(renovacaoEm(d(2026, 3, 15), d(2026, 10, 11)))).toBe("15 de março de 2027");
  });
  it("comprou há mais de um ano: a próxima é o próximo aniversário", () => {
    expect(dataLonga(renovacaoEm(d(2024, 11, 2), d(2026, 10, 11)))).toBe("2 de novembro de 2026");
    expect(dataLonga(renovacaoEm(d(2025, 10, 11), d(2026, 10, 11)))).toBe("11 de outubro de 2027");
  });
  it("29 de fevereiro renova no último dia de fevereiro", () => {
    expect(dataLonga(renovacaoEm(d(2024, 2, 29), d(2024, 3, 1)))).toBe("28 de fevereiro de 2025");
  });
});
