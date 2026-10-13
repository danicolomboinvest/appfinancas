import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * "Coloquei o Pix pro meu pai em Moradia e não está contando como Moradia" (Dani, 13/10/2026).
 *
 * A regra: a categoria que ela deu vence qualquer "parece transferência". O Pix para uma pessoa
 * que ela pôs em Moradia soma em Moradia no combinado (o padrão e a média do assistente do
 * Orçamento), no Orçamento do mês, no ano e na semana. O Pix sem categoria fica fora de todas.
 *
 * O banco aqui é uma lista na memória que entende o pedaço do `where` do Prisma que essas somas
 * usam. Se um filtro pela descrição aparecer nelas, o teste quebra.
 */
type Linha = {
  userId: string; profileId: string; year: number; month: number; category: string;
  parentCategory: string | null; customCategoryId: string | null; description: string; amount: number;
  entryDate: Date | null; createdAt: Date;
};
const banco = vi.hoisted(() => ({ linhas: [] as Linha[], wheres: [] as unknown[] }));

function casa(valor: unknown, cond: unknown): boolean {
  if (cond === null || typeof cond !== "object" || cond instanceof Date) {
    return cond instanceof Date ? valor instanceof Date && valor.getTime() === cond.getTime() : valor === cond;
  }
  const c = cond as Record<string, unknown>;
  if ("not" in c) return !casa(valor, c.not);
  if ("in" in c) return (c.in as unknown[]).includes(valor);
  if ("gte" in c || "lte" in c || "lt" in c) {
    if (valor === null || valor === undefined) return false;
    const v = valor instanceof Date ? valor.getTime() : (valor as number);
    const n = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number));
    return (!("gte" in c) || v >= n(c.gte)) && (!("lte" in c) || v <= n(c.lte)) && (!("lt" in c) || v < n(c.lt));
  }
  throw new Error(`condição que o teste não conhece: ${JSON.stringify(cond)}`);
}
function bate(l: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "AND") return (v as Record<string, unknown>[]).every((w) => bate(l, w));
    if (k === "OR") return (v as Record<string, unknown>[]).some((w) => bate(l, w));
    if (k === "NOT") return !bate(l, v as Record<string, unknown>);
    return casa(l[k], v);
  });
}

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    monthlyEntry: {
      groupBy: async ({ by, where }: { by: string[]; where: Record<string, unknown> }) => {
        banco.wheres.push(where);
        const grupos = new Map<string, { chave: Record<string, unknown>; soma: number }>();
        for (const l of banco.linhas.filter((x) => bate(x as unknown as Record<string, unknown>, where))) {
          const chave = Object.fromEntries(by.map((k) => [k, (l as unknown as Record<string, unknown>)[k]]));
          const id = JSON.stringify(chave);
          const g = grupos.get(id) ?? { chave, soma: 0 };
          g.soma += l.amount;
          grupos.set(id, g);
        }
        return [...grupos.values()].map((g) => ({ ...g.chave, _sum: { amount: g.soma } }));
      },
    },
  },
}));
vi.mock("@/lib/repositories/renda-media.repo", () => ({ getRendaMedia: async () => null }));

import { sumExpensesByCustomCategory, sumExpensesByParentCategory, sumExpensesByParentCategoryForYear, sumExpensesByParentCategorySince } from "../budget.repo";
import { getBudgetHints } from "@/lib/planning/budget-hints";

const ctx = { userId: "u1", profileId: "p1", profileKind: "PESSOAL" } as AuthContext;
const PIX_PAI = "13h52 Transferência Pix enviado Ricardo Souza Lima";
const PIX_CPF = "Transferência enviada pelo Pix - Ricardo Souza Lima - •••.123.456-•• - ITAÚ UNIBANCO S.A. (0341)";

function linha(month: number, description: string, amount: number, parentCategory: string | null, extra: Partial<Linha> = {}): Linha {
  return {
    userId: "u1", profileId: "p1", year: 2026, month, category: "EXPENSE", parentCategory, customCategoryId: null,
    description, amount, entryDate: new Date(Date.UTC(2026, month - 1, 7)), createdAt: new Date(Date.UTC(2026, 9, 13)), ...extra,
  };
}

beforeEach(() => {
  banco.linhas = [];

});

describe("Pix para pessoa que ela pôs em Moradia conta como Moradia", () => {
  it("no combinado: o padrão e a média de Moradia incluem o Pix pro pai; o Pix sem categoria fica fora", async () => {
    for (const m of [7, 8, 9]) {
      banco.linhas.push(linha(m, PIX_PAI, 1500, "MORADIA"));
      banco.linhas.push(linha(m, "Vivo", 150, "MORADIA"));
      banco.linhas.push(linha(m, "Transferência Pix enviado Fulana de Tal", 300, null));
      banco.linhas.push(linha(m, "Mercado", 800, "ALIMENTACAO"));
    }
    const h = await getBudgetHints(ctx, 2026, new Date(2026, 9, 13, 12));
    expect(h.padraoByCategory.MORADIA).toBe(1650);
    expect(h.averageByCategory.MORADIA).toBe(1650);
    expect(h.lastMonthByCategory.MORADIA).toBe(1650);
    // O Pix sem categoria não entra em categoria nenhuma.
    expect(Object.values(h.padraoByCategory).reduce((s, v) => s + v, 0)).toBe(1650 + 800);
  });

  it("no Orçamento do mês, do ano e da semana: o Pix com CPF mascarado em Moradia soma em Moradia", async () => {
    banco.linhas.push(linha(10, PIX_CPF, 2000, "MORADIA", { entryDate: new Date(Date.UTC(2026, 9, 12)) }));
    banco.linhas.push(linha(10, "Transferência enviada pelo Pix - Maria - •••.999.888-••", 90, null, { entryDate: new Date(Date.UTC(2026, 9, 12)) }));
    expect(await sumExpensesByParentCategory(ctx, 2026, 10)).toEqual([{ parentCategory: "MORADIA", spent: 2000 }]);
    expect(await sumExpensesByParentCategoryForYear(ctx, 2026)).toEqual([{ month: 10, parentCategory: "MORADIA", spent: 2000 }]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 13, 15)));
    try {
      expect(await sumExpensesByParentCategorySince(ctx, new Date(2026, 9, 6))).toEqual([{ parentCategory: "MORADIA", spent: 2000 }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("numa categoria que ela criou, igual", async () => {
    banco.linhas.push(linha(9, PIX_PAI, 700, null, { customCategoryId: "ajuda-pai" }));
    expect(await sumExpensesByCustomCategory(ctx, 2026, 9)).toEqual([{ customCategoryId: "ajuda-pai", spent: 700 }]);
  });

  it("nenhuma dessas somas filtra pela descrição", () => {
    expect(banco.wheres.length).toBeGreaterThan(5);
    expect(JSON.stringify(banco.wheres)).not.toMatch(/description/);
  });
});
