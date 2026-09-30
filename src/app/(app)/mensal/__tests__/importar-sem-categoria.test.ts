import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Não sei agora" na revisão: o gasto entra SEM categoria, em vez de sumir da importação. O
 * servidor precisa gravar a linha como veio (sem categoria-mãe nem personalizada) e não pode
 * transformar isso em regra aprendida — não houve escolha pra aprender. Banco em memória, com os
 * mesmos dublês de importar-extrato-duplicata.test.ts.
 */

type Linha = {
  id: string;
  userId: string;
  profileId: string;
  year: number;
  month: number;
  entryDate: Date | null;
  amount: number;
  description: string | null;
  category: string;
  parentCategory?: string | null;
  customCategoryId?: string | null;
  importBatchId: string | null;
};

const banco: Linha[] = [];
let proximoId = 0;

type Where = Record<string, unknown> & { OR?: { year: number; month: number }[] };

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "pessoal" })) }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    monthlyEntry: {
      findMany: vi.fn(async ({ where }: { where: Where }) => {
        return banco.filter((e) => {
          if (e.userId !== where.userId || e.profileId !== where.profileId) return false;
          if (where.OR) return where.OR.some((m) => m.year === e.year && m.month === e.month) && loteBate(where.importBatchId, e.importBatchId);
          return e.year === where.year && e.month === where.month;
        });
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    customCategory: { findMany: vi.fn(async () => [{ id: "pet", profileId: "pessoal" }]) },
    importBatch: { count: vi.fn(async () => 0) },
    user: { findUnique: vi.fn(async () => ({ name: "Fulana" })) },
  },
}));

/** `importBatchId: null` (à mão) ou `{ not: null }` (de arquivo), como o Prisma entende. */
function loteBate(filtro: unknown, valor: string | null): boolean {
  if (filtro === undefined) return true;
  if (filtro === null) return valor === null;
  return valor !== null;
}

vi.mock("@/lib/repositories/monthly-entry.repo", () => ({
  createMonthlyEntry: vi.fn(async (ctx: { userId: string; profileId: string }, input: Record<string, unknown>) => {
    banco.push({
      id: `e${++proximoId}`,
      userId: ctx.userId,
      profileId: (input.profileId as string) ?? ctx.profileId,
      year: input.year as number,
      month: input.month as number,
      entryDate: (input.entryDate as Date | undefined) ?? null,
      amount: input.amount as number,
      description: (input.description as string) ?? null,
      category: input.category as string,
      parentCategory: (input.parentCategory as string | undefined) ?? null,
      customCategoryId: (input.customCategoryId as string | undefined) ?? null,
      importBatchId: (input.importBatchId as string) ?? null,
    });
  }),
}));
let lote = 0;
vi.mock("@/lib/repositories/import-batch.repo", () => ({
  createImportBatch: vi.fn(async () => ({ id: `lote-${++lote}` })),
  deleteEmptyImportBatch: vi.fn(async () => {}),
  deleteImportBatchWithEntries: vi.fn(async () => 0),
}));
vi.mock("@/lib/repositories/profile.repo", () => ({ listProfiles: vi.fn(async () => [{ id: "pessoal" }, { id: "empresa" }]) }));
vi.mock("@/lib/repositories/decisao.repo", () => ({ descricoesOriginais: vi.fn(async () => new Map()) }));
vi.mock("@/lib/repositories/custom-category.repo", () => ({ listCustomCategories: vi.fn(async () => []) }));
const { upsertTransactionRule } = vi.hoisted(() => ({ upsertTransactionRule: vi.fn(async () => {}) }));
vi.mock("@/lib/repositories/transaction-rule.repo", () => ({
  listTransactionRules: vi.fn(async () => []),
  upsertTransactionRule,
}));
vi.mock("@/lib/repositories/import-diagnostic.repo", () => ({
  recordImportDiagnostic: vi.fn(async () => "diag"),
  isPartialRead: vi.fn(() => false),
  mensagemImplausivel: vi.fn(() => ""),
  safeHeader: vi.fn(() => ""),
  MARCA_CONFERIDO: "[conferido]",
  MARCA_NAO_FECHOU: "[não fechou]",
}));
vi.mock("@/lib/repositories/import-file.repo", () => ({ storeFailedImportFile: vi.fn(async () => {}) }));

const { importTransactionsAction } = await import("../import-actions");

beforeEach(() => {
  banco.length = 0;
  upsertTransactionRule.mockClear();
});

describe("gasto sem categoria vindo da importação", () => {
  it("entra no mês, sem categoria, e não vira regra", async () => {
    const r = await importTransactionsAction(
      [
        {
          date: "2026-09-10",
          description: "PIX ENVIADO MARIA SOUZA",
          amount: 50,
          category: "EXPENSE",
          parentCategory: null,
          customCategoryId: null,
          subcategory: null,
          learn: true,
        },
      ],
      "extrato",
    );
    expect(r).toMatchObject({ ok: true, created: 1 });
    expect(banco).toHaveLength(1);
    expect(banco[0]).toMatchObject({ category: "EXPENSE", amount: 50, parentCategory: null, customCategoryId: null, year: 2026, month: 9 });
    expect(upsertTransactionRule).not.toHaveBeenCalled();
  });

  it("na fatura também: cai no mês escolhido, sem categoria", async () => {
    const r = await importTransactionsAction(
      [{ date: "2026-08-28", description: "LOJA NOVA", amount: 30, category: "EXPENSE", parentCategory: null, customCategoryId: null, subcategory: null, learn: true }],
      "fatura",
      2026,
      10,
    );
    expect(r).toMatchObject({ ok: true, created: 1 });
    expect(banco[0]).toMatchObject({ year: 2026, month: 10, parentCategory: null, customCategoryId: null, entryDate: null });
  });
});
