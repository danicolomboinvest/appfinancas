import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
import { diaNoMesDoLancamento } from "../orcamento-detalhe.repo";

const d = (a: number, m: number, dia: number) => new Date(Date.UTC(a, m - 1, dia));

describe("diaNoMesDoLancamento", () => {
  it("sem data conta no dia 1", () => expect(diaNoMesDoLancamento(null, 2026, 10)).toBe(1));
  it("data do próprio mês é o dia dela", () => expect(diaNoMesDoLancamento(d(2026, 10, 12), 2026, 10)).toBe(12));
  it("compra de 29/09 na fatura de outubro já aconteceu: dia 1, nunca 'a vencer'", () => expect(diaNoMesDoLancamento(d(2026, 9, 29), 2026, 10)).toBe(1));
  it("compra de dezembro do ano anterior em janeiro: dia 1", () => expect(diaNoMesDoLancamento(d(2025, 12, 30), 2026, 1)).toBe(1));
  it("data de um mês depois fica depois do último dia (a vencer)", () => expect(diaNoMesDoLancamento(d(2026, 11, 2), 2026, 10)).toBe(32));
});
