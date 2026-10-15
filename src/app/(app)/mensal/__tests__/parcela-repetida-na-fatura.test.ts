import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A mesma parcela duas vezes (15/10/2026, achado em produção: 20 contas com 253 linhas a mais e
 * até 24 com a parcela k num mês que não bate com a da outra fatura). Banco trocado por uma lista
 * em memória (o mesmo molde de fatura-pela-data-da-compra.test.ts). O que está sendo protegido:
 * cada parcela de cada compra existe uma vez, mesmo com a k e a k+1 no mesmo arquivo e com a
 * mesma parcela vinda de uma fatura antiga (inteira num mês) e de uma nova (compra + (k - 1)).
 * A regra está em lib/import/parcela-repetida.ts.
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
  parentCategory: string | null;
  importBatchId: string | null;
  externalId: string | null;
};

const banco: Linha[] = [];
const lotes = new Map<string, string>(); // id → docType
let proximoId = 0;

/** O pedaço do `where` do Prisma que o import usa, com o `importBatch: { is: { docType } }`. */
function bate(e: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([campo, cond]) => {
    if (campo === "OR") return (cond as Record<string, unknown>[]).some((w) => bate(e, w));
    if (campo === "importBatch") {
      const is = (cond as { is?: { docType?: string; profileId?: string } }).is ?? {};
      return e.importBatchId !== null && (is.docType === undefined || lotes.get(e.importBatchId as string) === is.docType);
    }
    const valor = e[campo];
    if (cond === null) return valor === null || valor === undefined;
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { not?: unknown; in?: unknown[]; gte?: unknown };
      if ("in" in c) return c.in!.includes(valor);
      if ("not" in c) return c.not === null ? valor !== null && valor !== undefined : valor !== c.not;
      return true;
    }
    return valor === cond;
  });
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "pessoal", profileKind: "PESSOAL" })) }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    monthlyEntry: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => banco.filter((e) => bate(e, where))),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Linha> }) => {
        const alvo = banco.filter((e) => bate(e, where));
        for (const e of alvo) Object.assign(e, data);
        return { count: alvo.length };
      }),
      deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const antes = banco.length;
        for (let i = banco.length - 1; i >= 0; i -= 1) if (bate(banco[i], where)) banco.splice(i, 1);
        return { count: antes - banco.length };
      }),
    },
    customCategory: { findMany: vi.fn(async () => []) },
    importBatch: { count: vi.fn(async () => 0) },
    user: { findUnique: vi.fn(async () => ({ name: "Fulana Teste" })) },
  },
}));
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
      importBatchId: (input.importBatchId as string) ?? null,
      externalId: null,
    });
  }),
}));
let lote = 0;
vi.mock("@/lib/repositories/import-batch.repo", () => ({
  createImportBatch: vi.fn(async (_ctx: unknown, { docType }: { docType: string }) => {
    const id = `lote-${++lote}`;
    lotes.set(id, docType);
    return { id };
  }),
  deleteEmptyImportBatch: vi.fn(async () => {}),
  deleteImportBatchWithEntries: vi.fn(async () => 0),
}));
vi.mock("@/lib/repositories/profile.repo", () => ({ listProfiles: vi.fn(async () => [{ id: "pessoal" }, { id: "empresa" }]) }));
vi.mock("@/lib/repositories/decisao.repo", () => ({ descricoesOriginais: vi.fn(async () => new Map()) }));
vi.mock("@/lib/repositories/custom-category.repo", () => ({ listCustomCategories: vi.fn(async () => []) }));
vi.mock("@/lib/repositories/transaction-rule.repo", () => ({
  listTransactionRules: vi.fn(async () => []),
  upsertTransactionRule: vi.fn(async () => {}),
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
type ConfirmedItem = Parameters<typeof importTransactionsAction>[0][number];

/** Fatura que fecha em 05/09 e vence em 12/09/2026 (o que a tela manda junto, lido do arquivo). */
const SET = { vencimento: "2026-09-12", fechamento: "2026-09-05" };

const compra = (date: string, description: string, amount: number, extra: Partial<ConfirmedItem> = {}): ConfirmedItem => ({
  date,
  description,
  amount,
  category: "EXPENSE",
  parentCategory: "OUTROS",
  customCategoryId: null,
  subcategory: null,
  learn: false,
  installment: (() => {
    const m = description.match(/PARC (\d{1,2})\/(\d{1,2})$/);
    return m ? { current: Number(m[1]), total: Number(m[2]), confident: true } : null;
  })(),
  ...extra,
});
/** Pela data da compra ("Mudar › contar cada compra no mês dela"), com as datas lidas. */
const importarFatura = (itens: ConfirmedItem[], datas: { vencimento: string | null; fechamento: string | null }) =>
  importTransactionsAction(itens, "fatura", undefined, undefined, "fatura.pdf", null, null, { ...datas, porCompra: true });

const comDescricao = (d: string) => banco.filter((e) => e.description === d);

beforeEach(() => {
  banco.length = 0;
  lotes.clear();
});

/** Quantas vezes cada parcela da compra "LOJA X" de R$ 100 em 10x está no app, de `de` até 10. */
const vezes = (de: number) => Array.from({ length: 11 - de }, (_, i) => comDescricao(`LOJA X PARC ${String(de + i).padStart(2, "0")}/10`).length);
const umaDeCada = (de: number) => Array.from({ length: 11 - de }, () => 1);

describe("duas parcelas da mesma compra (causa 1)", () => {
  it("a 03/10 e a 04/10 no mesmo arquivo projetam o rabo uma vez só", async () => {
    // BTG: a data é a da compra original (20/06) nas duas linhas.
    const r = await importarFatura([compra("2026-06-20", "LOJA X PARC 03/10", 100), compra("2026-06-20", "LOJA X PARC 04/10", 100)], SET);
    expect(r).toMatchObject({ ok: true });
    expect(vezes(3)).toEqual(umaDeCada(3));
    // A 05/10 em diante cai uma vez por mês, a partir de outubro.
    expect(comDescricao("LOJA X PARC 05/10")[0]).toMatchObject({ year: 2026, month: 10 });
  });

  it("o mesmo no modo antigo (tudo num mês): a 04/10 do arquivo não ganha uma projetada ao lado", async () => {
    await importTransactionsAction([compra("2026-06-20", "LOJA X PARC 03/10", 100), compra("2026-06-20", "LOJA X PARC 04/10", 100)], "fatura", 2026, 9, "fatura.pdf", null, null, SET);
    expect(vezes(3)).toEqual(umaDeCada(3));
  });

  it("duas compras iguais de verdade no mesmo arquivo continuam duas", async () => {
    await importarFatura([compra("2026-06-20", "LOJA X PARC 03/10", 100), compra("2026-06-20", "LOJA X PARC 03/10", 100)], SET);
    expect(vezes(3)).toEqual(Array.from({ length: 8 }, () => 2));
  });

  it("compras diferentes da mesma loja (outro valor, outro mês da compra) não são juntadas", async () => {
    await importarFatura([compra("2026-06-20", "LOJA X PARC 03/10", 100), compra("2026-07-20", "LOJA X PARC 02/10", 100), compra("2026-06-20", "LOJA X PARC 03/10", 250)], SET);
    // A de junho (100) e a de julho (100) caem as duas em agosto, cada uma com o seu rabo.
    expect(comDescricao("LOJA X PARC 10/10").map((e) => e.amount).sort((a, b) => a - b)).toEqual([100, 100, 250]);
  });
});

describe("parcela de outra fatura um mês fora (causa 2)", () => {
  it("a 03/10 que a fatura antiga pôs em setembro é reconhecida pela nova, que a põe em agosto", async () => {
    // Modo antigo: a fatura de setembro inteira em setembro, sem dia.
    await importTransactionsAction([compra("2026-06-20", "LOJA X PARC 03/10", 100), compra("2026-08-10", "LIVRARIA", 60)], "fatura", 2026, 9);
    // Outro arquivo, pela data da compra: a mesma 03/10 cai em agosto (junho + 2). As outras
    // compras são diferentes, então não é "a mesma fatura subida de novo".
    const r = await importarFatura([compra("2026-06-20", "LOJA X PARC 03/10", 100), compra("2026-08-25", "PADARIA", 20), compra("2026-08-26", "POSTO", 90)], SET);
    expect(r).toMatchObject({ ok: true, created: 2, skipped: 1 });
    expect(vezes(3)).toEqual(umaDeCada(3));
  });

  it("e as seguintes que a fatura nova projetaria também não duplicam", async () => {
    await importTransactionsAction([compra("2026-06-20", "LOJA X PARC 04/10", 100)], "fatura", 2026, 10);
    // A fatura de setembro, nova: a 03/10 em agosto e as seguintes a partir de setembro. A 04/10
    // de outubro (real, do modo antigo) é a 04/10 de setembro, um mês fora.
    await importarFatura([compra("2026-06-20", "LOJA X PARC 03/10", 100)], SET);
    expect(vezes(3)).toEqual(umaDeCada(3));
  });

  it("dois meses de distância não é a mesma parcela", async () => {
    await importTransactionsAction([compra("2026-06-20", "LOJA X PARC 03/10", 100)], "fatura", 2026, 10);
    await importarFatura([compra("2026-06-20", "LOJA X PARC 03/10", 100), compra("2026-08-25", "PADARIA", 20)], SET);
    expect(comDescricao("LOJA X PARC 03/10")).toHaveLength(2);
  });
});
