import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Extrato com o mesmo dia, valor e tipo de um lançamento que já veio de OUTRO arquivo, com o
 * banco de dados trocado por uma lista em memória. Antes a confirmação pulava a linha calada só
 * por data + valor: o saque de R$ 100 do Itaú sumia porque o Nubank já tinha um Pix de R$ 100
 * no mesmo dia. Decisão da Dani: descrição igual continua pulando; diferente, a revisão pergunta.
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

const { importTransactionsAction, parseStatementAction } = await import("../import-actions");

/** Lançamento que já veio de um arquivo anterior (outro banco, outro formato). */
function jaImportado(description: string, amount: number, dia = "2026-09-10", loteId = "lote-antigo") {
  banco.push({
    id: `e${++proximoId}`,
    userId: "u1",
    profileId: "pessoal",
    year: Number(dia.slice(0, 4)),
    month: Number(dia.slice(5, 7)),
    entryDate: new Date(`${dia}T12:00:00`),
    amount,
    description,
    category: "EXPENSE",
    importBatchId: loteId,
  });
}

const saida = (description: string, amount: number, date = "2026-09-10") => ({
  date,
  description,
  amount,
  category: "EXPENSE" as const,
  parentCategory: "OUTROS" as const,
  customCategoryId: null,
  subcategory: null,
  learn: false,
});

async function lerExtrato(linhas: string[]) {
  const form = new FormData();
  form.set("file", new File([["Data;Descrição;Valor", ...linhas].join("\n")], "extrato.csv"));
  form.set("encoding", "text");
  form.set("docType", "extrato");
  const r = await parseStatementAction(form);
  if (!r.ok) throw new Error(r.error);
  return r.items;
}

beforeEach(() => {
  banco.length = 0;
  upsertTransactionRule.mockClear();
});

describe("mesmo dia e valor de outra importação, na confirmação", () => {
  it("descrição diferente (saque no Itaú × Pix no Nubank) entra, não é pulada calada", async () => {
    jaImportado("PIX ENVIADO MARIA", 100);
    const r = await importTransactionsAction([saida("SAQUE 24H", 100)], "extrato");
    expect(r).toMatchObject({ ok: true, created: 1, skipped: 0 });
    expect(banco.map((e) => e.description).sort()).toEqual(["PIX ENVIADO MARIA", "SAQUE 24H"]);
  });

  it("mesma descrição escrita de outro jeito (outro formato do mesmo extrato) continua pulando", async () => {
    jaImportado("PIX ENVIADO - Maria", 100);
    const r = await importTransactionsAction([saida("Pix enviado Maria", 100)], "extrato");
    expect(r).toMatchObject({ created: 0, skipped: 1 });
  });

  it("descrição cortada pelo CSV é a mesma; 'Pix enviado' sozinho não é", async () => {
    jaImportado("PIX ENVIADO MARIA SILVA SANTOS", 100);
    jaImportado("PIX ENVIADO JOAO PEREIRA", 50);
    const r = await importTransactionsAction([saida("PIX ENVIADO MARIA SIL", 100), saida("PIX ENVIADO", 50)], "extrato");
    expect(r).toMatchObject({ created: 1, skipped: 1 });
    expect(banco.filter((e) => e.description === "PIX ENVIADO")).toHaveLength(1);
  });
});

describe("mesmo dia e valor de outra importação, na leitura do arquivo", () => {
  it("descrição diferente vira pergunta, mostrando o que já está no app", async () => {
    jaImportado("PIX ENVIADO MARIA", 100);
    const items = await lerExtrato(["10/09/2026;SAQUE 24H;-100,00", "11/09/2026;PADARIA;-12,00"]);
    expect(items.find((i) => i.description === "SAQUE 24H")?.possivelDuplicata).toEqual({
      descricao: "PIX ENVIADO MARIA",
      data: "2026-09-10",
      importado: true,
    });
    expect(items.find((i) => i.description === "PADARIA")?.possivelDuplicata).toBeFalsy();
  });

  it("a mesma linha subida de novo não pergunta nada (a confirmação pula sozinha)", async () => {
    jaImportado("PIX ENVIADO MARIA", 100);
    const items = await lerExtrato(["10/09/2026;Pix enviado Maria;-100,00"]);
    expect(items[0].possivelDuplicata).toBeFalsy();
  });

  it("cada lançamento já importado responde por uma linha só: a igual fica com ele, a outra não pergunta", async () => {
    jaImportado("UBER TRIP", 15);
    const items = await lerExtrato(["10/09/2026;99 POP;-15,00", "10/09/2026;UBER TRIP;-15,00"]);
    expect(items.every((i) => !i.possivelDuplicata)).toBe(true);
  });
});

describe("categoria personalizada numa linha mandada pra outro perfil", () => {
  it("cai em Outros no perfil de destino, em vez de ficar sem categoria, e não vira regra", async () => {
    const r = await importTransactionsAction(
      [{ ...saida("PETZ", 80), parentCategory: null, customCategoryId: "pet", profileId: "empresa", learn: true }],
      "extrato",
    );
    expect(r).toMatchObject({ created: 1 });
    expect(banco[0]).toMatchObject({ profileId: "empresa", parentCategory: "OUTROS", customCategoryId: null });
    expect(upsertTransactionRule).not.toHaveBeenCalled();
  });

  it("no próprio perfil, a personalizada continua valendo", async () => {
    await importTransactionsAction([{ ...saida("PETZ", 80), parentCategory: null, customCategoryId: "pet" }], "extrato");
    expect(banco[0]).toMatchObject({ profileId: "pessoal", parentCategory: null, customCategoryId: "pet" });
  });
});

/** Conta lançada à mão antes de pagar (03/10/2026): a data é a do vencimento, o valor é o previsto. */
function lancadoAMao(description: string, amount: number, dia: string) {
  banco.push({
    id: `mao${++proximoId}`,
    userId: "u1",
    profileId: "pessoal",
    year: Number(dia.slice(0, 4)),
    month: Number(dia.slice(5, 7)),
    entryDate: new Date(`${dia}T12:00:00`),
    amount,
    description,
    category: "EXPENSE",
    importBatchId: null,
  });
}

describe("conta lançada à mão antes de pagar", () => {
  it("paga 5 dias antes do vencimento ainda pergunta, e diz qual lançamento é", async () => {
    lancadoAMao("Aluguel", 1500, "2026-09-10");
    const items = await lerExtrato(["05/09/2026;PIX ENVIADO IMOBILIARIA;-1500,00"]);
    expect(items[0].possivelDuplicata).toMatchObject({ descricao: "Aluguel", data: "2026-09-10", valor: 1500 });
    expect(items[0].possivelDuplicata?.id).toMatch(/^mao/);
  });

  it("conta com valor um pouco diferente do previsto (luz de 180 que veio 192) pergunta", async () => {
    lancadoAMao("Conta de luz", 180, "2026-09-15");
    const items = await lerExtrato(["14/09/2026;ENEL;-192,00"]);
    expect(items[0].possivelDuplicata).toMatchObject({ descricao: "Conta de luz", valor: 180 });
  });

  it("valor muito diferente ou mais de uma semana de distância não pergunta", async () => {
    lancadoAMao("Conta de luz", 180, "2026-09-15");
    lancadoAMao("Internet", 100, "2026-09-25");
    const items = await lerExtrato(["14/09/2026;ENEL;-260,00", "10/09/2026;VIVO;-100,00"]);
    expect(items.every((i) => !i.possivelDuplicata)).toBe(true);
  });

  it("o valor exato e perto ganha do valor parecido: cada lançamento casa com uma linha só", async () => {
    lancadoAMao("Academia", 100, "2026-09-10");
    const items = await lerExtrato(["09/09/2026;SMART FIT;-95,00", "10/09/2026;SMART FIT;-100,00"]);
    expect(items.find((i) => i.amount === 100)?.possivelDuplicata).toMatchObject({ descricao: "Academia" });
    expect(items.find((i) => i.amount === 95)?.possivelDuplicata).toBeFalsy();
  });
});
