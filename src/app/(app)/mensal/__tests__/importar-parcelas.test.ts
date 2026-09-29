import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Importação de fatura com compra parcelada, com o banco de dados trocado por uma lista em
 * memória. O que está sendo protegido: cada parcela existe UMA vez por mês, não importa a ordem
 * em que as faturas sobem, como o banco escreve o número ("04/06" ou "4/6") nem o centavo que a
 * primeira parcela absorve. Antes, a cada fatura importada, cada mês futuro ganhava mais uma
 * cópia de cada parcela.
 */

type Linha = {
  id?: string;
  userId: string;
  profileId: string;
  year: number;
  month: number;
  entryDate: Date | null;
  amount: number;
  description: string | null;
  category: string;
  importBatchId: string | null;
};

const banco: Linha[] = [];
let proximoId = 0;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "pessoal" })) }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    monthlyEntry: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        // Consultas por período (candidatos a pagamento de fatura, duplicata à mão) não importam aqui.
        if ("OR" in where) return [];
        // Meses de cada lote (pra saber qual parcela foi projetada por ele).
        if (where.importBatchId && typeof where.importBatchId === "object") {
          const ids = (where.importBatchId as { in: string[] }).in;
          const perfis = (where.profileId as { in: string[] }).in;
          return banco.filter((e) => e.userId === where.userId && perfis.includes(e.profileId) && e.importBatchId !== null && ids.includes(e.importBatchId));
        }
        return banco.filter(
          (e) => e.userId === where.userId && e.profileId === where.profileId && e.year === where.year && e.month === where.month,
        );
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; userId: string; profileId: string }; data: { importBatchId: string } }) => {
        const alvo = banco.filter((e) => e.id === where.id && e.userId === where.userId && e.profileId === where.profileId);
        for (const e of alvo) e.importBatchId = data.importBatchId;
        return { count: alvo.length };
      }),
    },
    customCategory: { findMany: vi.fn(async () => []) },
    importBatch: { count: vi.fn(async () => 0) },
    user: { findUnique: vi.fn(async () => ({ name: "Fulana" })) },
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
}));
vi.mock("@/lib/repositories/import-file.repo", () => ({ storeFailedImportFile: vi.fn(async () => {}) }));

const { importTransactionsAction, parseStatementAction } = await import("../import-actions");

const compra = (description: string, amount: number) => ({
  date: "2026-09-12",
  description,
  amount,
  category: "EXPENSE" as const,
  parentCategory: "OUTROS" as const,
  customCategoryId: null,
  subcategory: null,
  learn: false,
  installment: (() => {
    const m = description.match(/(\d{1,2})\/(\d{1,2})$/);
    return m ? { current: Number(m[1]), total: Number(m[2]), confident: true } : null;
  })(),
});

const doMes = (year: number, month: number) => banco.filter((e) => e.year === year && e.month === month);
/** O que o "Desfazer" do histórico faz: apaga tudo que é do lote. */
const desfazer = (loteId: string) => {
  for (let i = banco.length - 1; i >= 0; i -= 1) if (banco[i].importBatchId === loteId) banco.splice(i, 1);
};

beforeEach(() => {
  banco.length = 0;
});

describe("parcelas futuras da fatura", () => {
  it("faturas fora de ordem (outubro antes de setembro) não duplicam as parcelas já lançadas", async () => {
    const outubro = await importTransactionsAction([compra("LOJA X PARC 04/10", 100)], "fatura", 2026, 10);
    expect(outubro).toMatchObject({ ok: true, created: 7 }); // 04 em out + 05…10 de nov a abr
    const setembro = await importTransactionsAction([compra("LOJA X PARC 03/10", 100)], "fatura", 2026, 9);
    // Só a parcela 03 de setembro é nova; 04…10 já estavam lá.
    expect(setembro).toMatchObject({ ok: true, created: 1 });
    expect(banco).toHaveLength(8);
    expect(doMes(2026, 10).map((e) => e.description)).toEqual(["LOJA X PARC 04/10"]);
    expect(doMes(2027, 4).map((e) => e.description)).toEqual(["LOJA X PARC 10/10"]);
  });

  it("em ordem, a fatura seguinte encontra a parcela projetada escrita no mesmo formato", async () => {
    await importTransactionsAction([compra("NETSHOES PARC 03/06", 50)], "fatura", 2026, 9);
    expect(doMes(2026, 10).map((e) => e.description)).toEqual(["NETSHOES PARC 04/06"]);
    const outubro = await importTransactionsAction([compra("NETSHOES PARC 04/06", 50)], "fatura", 2026, 10);
    expect(outubro).toMatchObject({ ok: true, created: 0, skipped: 1 });
    expect(banco).toHaveLength(4); // 03, 04, 05, 06 — uma de cada
  });

  it("reconhece a parcela gravada no formato antigo do app ('04/6') e a do banco sem zero ('4/6')", async () => {
    banco.push({ userId: "u1", profileId: "pessoal", year: 2026, month: 10, entryDate: null, amount: 50, description: "NETSHOES PARC 04/6", category: "EXPENSE", importBatchId: "antigo" });
    const r1 = await importTransactionsAction([compra("NETSHOES PARC 04/06", 50)], "fatura", 2026, 10);
    expect(r1).toMatchObject({ skipped: 1 });
    banco.push({ userId: "u1", profileId: "pessoal", year: 2026, month: 10, entryDate: null, amount: 80, description: "Loja - Parcela 04/6", category: "EXPENSE", importBatchId: "antigo" });
    const r2 = await importTransactionsAction([compra("Loja - Parcela 4/6", 80)], "fatura", 2026, 10);
    expect(r2).toMatchObject({ skipped: 1 });
  });

  it("a primeira parcela com um centavo a mais (33,34 e depois 33,33) não duplica a compra", async () => {
    await importTransactionsAction([compra("TENIS PARC 01/03", 33.34)], "fatura", 2026, 9);
    const outubro = await importTransactionsAction([compra("TENIS PARC 02/03", 33.33)], "fatura", 2026, 10);
    expect(outubro).toMatchObject({ created: 0, skipped: 1 });
    expect(banco).toHaveLength(3);
  });

  it("duas compras diferentes na mesma loja, com o mesmo número de parcela, continuam sendo duas", async () => {
    await importTransactionsAction([compra("MAGALU PARC 02/05", 120)], "fatura", 2026, 9);
    const r = await importTransactionsAction([compra("MAGALU PARC 03/05", 120), compra("MAGALU PARC 03/05", 300)], "fatura", 2026, 10);
    expect(r).toMatchObject({ skipped: 1 });
    expect(doMes(2026, 10).map((e) => e.amount).sort((a, b) => a - b)).toEqual([120, 300]);
  });
});

describe("tipo do arquivo", () => {
  it("extrato do Nubank com um salário e doze saídas não é tratado como fatura", async () => {
    const linhas = ["Data,Valor,Identificador,Descrição", "05/09/2026,5000.00,a0,Salário"];
    for (let i = 1; i <= 12; i += 1) linhas.push(`${String(i + 5).padStart(2, "0")}/09/2026,-${40 + i}.90,a${i},Pix enviado ${i}`);
    const form = new FormData();
    form.set("file", new File([linhas.join("\n")], "NU_123_01SET2026_30SET2026.csv"));
    form.set("encoding", "text");
    form.set("docType", "extrato");
    const r = await parseStatementAction(form);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.detectedKind).toBe("extrato");
    expect(r.items.filter((i) => i.category === "INCOME")).toHaveLength(1);
  });

  it("quando são os sinais que dizem fatura, o motivo mostrado é o dos sinais", async () => {
    const linhas = ["Data;Descrição;Valor"];
    for (let i = 1; i <= 10; i += 1) linhas.push(`${String(i).padStart(2, "0")}/09/2026;MERCADOLIVRE ${i};${100 + i},00`);
    const form = new FormData();
    form.set("file", new File([linhas.join("\n")], "arquivo.csv"));
    form.set("encoding", "text");
    form.set("docType", "extrato");
    const r = await parseStatementAction(form);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.detectedKind).toBe("fatura");
    expect(r.stats.detectedReason).toMatch(/mesmo lado/);
  });
});

describe("desfazer uma fatura não leva as parcelas que a fatura seguinte confirmou", () => {
  it("setembro projeta 04..12; outubro traz a 04; desfazer setembro deixa outubro em diante", async () => {
    await importTransactionsAction([compra("AMAZON PARC 03/12", 90)], "fatura", 2026, 9);
    const loteSetembro = banco[0].importBatchId!;
    const outubro = await importTransactionsAction([compra("AMAZON PARC 04/12", 90), compra("PADARIA", 20)], "fatura", 2026, 10);
    expect(outubro).toMatchObject({ ok: true, created: 1, skipped: 1 });
    const loteOutubro = doMes(2026, 10).find((e) => e.description === "PADARIA")!.importBatchId!;
    desfazer(loteSetembro);
    expect(doMes(2026, 9)).toHaveLength(0);
    expect(doMes(2026, 10).map((e) => e.description).sort()).toEqual(["AMAZON PARC 04/12", "PADARIA"]);
    // As seguintes que setembro projetou também ficam (agora são da fatura de outubro).
    expect(doMes(2027, 6).map((e) => e.importBatchId)).toEqual([loteOutubro]);
    expect(banco).toHaveLength(10); // 04..12 + padaria
  });

  it("a mesma fatura subida de novo não tira as parcelas da original", async () => {
    await importTransactionsAction([compra("AMAZON PARC 03/12", 90)], "fatura", 2026, 9);
    const loteOriginal = banco[0].importBatchId;
    const copia = await importTransactionsAction([compra("AMAZON PARC 03/12", 90)], "fatura", 2026, 9);
    expect(copia).toMatchObject({ created: 0, skipped: 1 });
    expect(banco.every((e) => e.importBatchId === loteOriginal)).toBe(true);
  });
});

describe("pagamento da fatura anterior dentro da fatura", () => {
  it("redação nova sai como resumo; crédito que fala em pagamento fica de fora, não vira estorno", async () => {
    const linhas = ["Data;Descrição;Valor"];
    for (let i = 1; i <= 6; i += 1) linhas.push(`${String(i).padStart(2, "0")}/09/2026;LOJA ${i};${100 + i},00`);
    linhas.push("05/09/2026;Pagamento da fatura;-2800,00");
    linhas.push("06/09/2026;PGTO CARTAO OBRIGADO;-2800,00");
    linhas.push("07/09/2026;ESTORNO LOJA 2;-50,00");
    const form = new FormData();
    form.set("file", new File([linhas.join("\n")], "fatura.csv"));
    form.set("encoding", "text");
    form.set("docType", "fatura");
    form.set("faturaMonth", "2026-09");
    const r = await parseStatementAction(form);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items.find((i) => i.description === "Pagamento da fatura")).toBeUndefined();
    expect(r.items.find((i) => i.description === "PGTO CARTAO OBRIGADO")).toMatchObject({ ignorar: true, estorno: true });
    expect(r.items.find((i) => i.description === "ESTORNO LOJA 2")).toMatchObject({ estorno: true });
    expect(r.items.find((i) => i.description === "ESTORNO LOJA 2")?.ignorar).toBeFalsy();
  });
});
