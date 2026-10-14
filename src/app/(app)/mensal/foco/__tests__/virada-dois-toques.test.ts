import { describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({ decisoes: [] as { id: string; tipo: string; chave: string }[], fila: Promise.resolve() as Promise<unknown>, contas: 0 }));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: async () => ({ userId: "u", profileId: "p", profileKind: "PESSOAL" }) }));
vi.mock("@/lib/money-server", () => ({ serverMoney: async () => (v: number) => String(v) }));
vi.mock("../ano/dados", () => ({
  carregarViradaDoAno: async () => ({ ano: 2027, sugestao: { categorias: [], renda: 0, guardar: 0 }, fixas: [{ chave: "aluguel" }], talvezFixas: [] }),
}));
vi.mock("@/lib/decisoes/virada-ano", () => ({ contasFixasQueFaltam: (l: unknown[]) => l.map(() => ({ descricao: "Aluguel", valor: 1000, parentCategory: "MORADIA" })) }));
vi.mock("@/lib/repositories/monthly-entry.repo", () => ({
  createRecurringMonthlyEntries: async () => {
    banco.contas += 1;
  },
  updateOwnMonthlyEntriesCategory: async () => {},
}));
vi.mock("@/lib/db/prisma", () => {
  // Uma transação por vez, como a trava do Postgres faz.
  const tx = {
    decisao: {
      count: async ({ where }: { where: { tipo: string; chave: string } }) => banco.decisoes.filter((d) => d.tipo === where.tipo && d.chave === where.chave).length,
      create: async ({ data }: { data: { tipo: string; chave: string } }) => {
        const d = { id: String(banco.decisoes.length + 1), ...data };
        banco.decisoes.push(d);
        return d;
      },
    },
    $executeRaw: async () => 0,
  };
  return {
    prisma: {
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => {
        const r = banco.fila.then(() => fn(tx));
        banco.fila = r.catch(() => {});
        return r;
      },
      monthlyEntry: { findMany: async () => [] },
      decisao: { deleteMany: async () => ({ count: 0 }) },
    },
  };
});

import { comecarAnoAction } from "../actions";

describe("Começar o ano", () => {
  it("dois toques ao mesmo tempo gravam as contas fixas uma vez só", async () => {
    const [a, b] = await Promise.all([comecarAnoAction("sugestao"), comecarAnoAction("sugestao")]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(banco.contas).toBe(1);
    expect(banco.decisoes).toHaveLength(1);
  });
});
