import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Duas proteções da área de robustez, com o banco trocado por espiões:
 * 1. Tela aberta num perfil que não é mais o ativo (ela trocou em outro aparelho) não grava:
 *    nem o lançamento avulso nem a importação, que antes caíam inteiros no perfil novo.
 * 2. A lista da fatia na aba Semana de "Só gastos" usa o mesmo critério do total da fatia
 *    (filtroDaSemana), não só "criado nos últimos 7 dias".
 */

const findMany = vi.fn<(args: unknown) => Promise<unknown[]>>(async () => []);
const createImportBatch = vi.fn(async () => ({ id: "lote1" }));
const createMonthlyEntry = vi.fn(async () => ({}));
const createRecurringMonthlyEntries = vi.fn(async () => ({}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "pessoal" })) }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { monthlyEntry: { findMany: (args: unknown) => findMany(args) }, customCategory: { findMany: vi.fn(async () => []) } },
}));
vi.mock("@/lib/repositories/import-batch.repo", () => ({
  createImportBatch: () => createImportBatch(),
  deleteImportBatch: vi.fn(),
  deleteEmptyImportBatch: vi.fn(),
  listImportBatches: vi.fn(async () => []),
}));
vi.mock("@/lib/repositories/monthly-entry.repo", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createMonthlyEntry: () => createMonthlyEntry(),
  createRecurringMonthlyEntries: () => createRecurringMonthlyEntries(),
}));
vi.mock("@/lib/money-server", () => ({ getUserCurrency: vi.fn(async () => "BRL") }));

const { importTransactionsAction } = await import("../import-actions");
const { createMonthlyEntryAction } = await import("../[year]/[month]/actions");
const { getCategoryTransactionsAction } = await import("../gastos/actions");
const { filtroDaSemana } = await import("@/lib/repositories/budget.repo");
const { nowInBrazil } = await import("@/lib/date/brazil-now");

function formulario(extra: Record<string, string> = {}) {
  const f = new FormData();
  const campos: Record<string, string> = {
    year: "2026",
    month: "9",
    category: "EXPENSE",
    amount: "50",
    parentCategory: "ALIMENTACAO",
    subcategory: "",
    description: "Padaria",
    entryDate: "2026-09-30",
    ...extra,
  };
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

beforeEach(() => {
  findMany.mockClear();
  createImportBatch.mockClear();
  createMonthlyEntry.mockClear();
  createRecurringMonthlyEntries.mockClear();
});

describe("tela aberta em outro perfil", () => {
  it("a importação recusa antes de criar o lote", async () => {
    const r = await importTransactionsAction([], "extrato", undefined, undefined, "extrato.csv", "empresa");
    expect(r).toEqual({ ok: false, error: expect.stringContaining("trocou de perfil") });
    expect(createImportBatch).not.toHaveBeenCalled();
  });

  it("o lançamento avulso recusa sem gravar", async () => {
    const r = await createMonthlyEntryAction({}, formulario({ profileId: "empresa" }));
    expect(r.error).toContain("trocou de perfil");
    expect(createMonthlyEntry).not.toHaveBeenCalled();
  });

  it("no perfil certo, o lançamento grava normalmente", async () => {
    const r = await createMonthlyEntryAction({}, formulario({ profileId: "pessoal" }));
    expect(r).toEqual({});
    expect(createMonthlyEntry).toHaveBeenCalledTimes(1);
  });
});

describe("lista da fatia na aba Semana", () => {
  afterEach(() => vi.useRealTimers());

  it("usa o mesmo filtro do total (não só createdAt dos últimos 7 dias)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T15:00:00Z"));
    await getCategoryTransactionsAction("semana", 2026, 9, { kind: "parent", value: "MORADIA" });
    const hoje = nowInBrazil();
    const esperado = filtroDaSemana(new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000), hoje);
    const { where } = findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(where.OR).toEqual(esperado.OR);
    expect(where.createdAt).toBeUndefined();
    expect(where).toMatchObject({ userId: "u1", profileId: "pessoal", category: "EXPENSE", parentCategory: "MORADIA" });
  });
});
