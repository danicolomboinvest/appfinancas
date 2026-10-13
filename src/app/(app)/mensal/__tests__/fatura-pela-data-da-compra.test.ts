import { parseInstallment } from "@/lib/entries/recurrence";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fatura sem a pergunta "de que mês é?" (out/2026): cada compra no mês em que foi feita, parcela k
 * no mês da compra + (k - 1). Banco de dados trocado por uma lista em memória. O que está sendo
 * protegido: a mesma fatura duas vezes não duplica (inclusive a que já está gravada no modelo
 * antigo, inteira num mês e sem dia), parcela não duplica nem some na troca de modelo, e o
 * pagamento da fatura no extrato decide sozinho entre "só mudei de conta" e gasto do cartão.
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

const { importTransactionsAction, parseStatementAction } = await import("../import-actions");
type ConfirmedItem = Parameters<typeof importTransactionsAction>[0][number];

/** Fatura que fecha em 05/09 e vence em 12/09/2026 (o que a tela manda junto, lido do arquivo). */
const SET = { vencimento: "2026-09-12", fechamento: "2026-09-05" };
const OUT = { vencimento: "2026-10-12", fechamento: "2026-10-05" };
const NOV = { vencimento: "2026-11-12", fechamento: "2026-11-05" };

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
/** Pela data da compra: sem mês escolhido, com as datas lidas. */
const importarFatura = (itens: ConfirmedItem[], datas: { vencimento: string | null; fechamento: string | null }) =>
  importTransactionsAction(itens, "fatura", undefined, undefined, "fatura.pdf", null, null, datas);

const doMes = (year: number, month: number) => banco.filter((e) => e.year === year && e.month === month);
const comDescricao = (d: string) => banco.filter((e) => e.description === d);
const dia = (e: Linha | undefined) => (e?.entryDate ? e.entryDate.toISOString().slice(0, 10) : null);

beforeEach(() => {
  banco.length = 0;
  lotes.clear();
});

const FATURA_SETEMBRO = [
  compra("2026-08-20", "MERCADO EXTRA", 150),
  compra("2026-08-28", "FARMACIA", 80),
  compra("2026-09-03", "NETFLIX", 39.9),
  compra("2026-06-20", "LOJA X PARC 03/10", 100),
];

describe("fatura pela data da compra", () => {
  it("cada compra no mês dela, com o dia; a parcela no mês da compra + (k - 1) no dia da compra, e as seguintes projetadas no mesmo dia", async () => {
    const r = await importarFatura(FATURA_SETEMBRO, SET);
    // 3 compras + a 03/10 + 04..10 projetadas
    expect(r).toMatchObject({ ok: true, created: 11, skipped: 0 });
    expect(doMes(2026, 8).map((e) => e.description).sort()).toEqual(["FARMACIA", "LOJA X PARC 03/10", "MERCADO EXTRA"]);
    expect(dia(comDescricao("MERCADO EXTRA")[0])).toBe("2026-08-20");
    expect(dia(comDescricao("NETFLIX")[0])).toBe("2026-09-03");
    expect(comDescricao("LOJA X PARC 03/10")[0]).toMatchObject({ year: 2026, month: 8 });
    // Nenhuma em "Sem data": o dia 20 da compra vale em todas.
    expect(dia(comDescricao("LOJA X PARC 03/10")[0])).toBe("2026-08-20");
    expect(comDescricao("LOJA X PARC 04/10")[0]).toMatchObject({ year: 2026, month: 9 });
    expect(dia(comDescricao("LOJA X PARC 04/10")[0])).toBe("2026-09-20");
    expect(comDescricao("LOJA X PARC 10/10")[0]).toMatchObject({ year: 2027, month: 3 });
    expect(dia(comDescricao("LOJA X PARC 10/10")[0])).toBe("2027-03-20");
  });

  it("parcela gravada sem dia (antes desta versão) é reconhecida pela fatura nova, que tem dia", async () => {
    // A 03/10 e a 04/10 como o app gravava até out/2026: sem dia.
    await importarFatura(FATURA_SETEMBRO, SET);
    for (const e of banco) if (/PARC/.test(String(e.description))) e.entryDate = null;
    const r = await importarFatura([compra("2026-06-20", "LOJA X PARC 04/10", 100), compra("2026-09-15", "PADARIA", 20)], OUT);
    expect(r).toMatchObject({ ok: true, created: 1, skipped: 1 });
    expect(comDescricao("LOJA X PARC 04/10")).toHaveLength(1);
  });

  it("BTG: Amazon (9/10) entre parênteses projeta a 10/10 no mês seguinte, no dia da compra, sem herdar o palpite da loja de tudo", async () => {
    const r = await importarFatura([compra("2026-01-15", "Amazon Marketplace Cc (8/10)", 89.09, { installment: parseInstallment("Amazon Marketplace Cc (8/10)"), parentCategory: "LAZER" }), compra("2026-08-20", "MERCADO EXTRA", 50)], SET);
    expect(r).toMatchObject({ ok: true, created: 4 });
    expect(comDescricao("Amazon Marketplace Cc (8/10)")[0]).toMatchObject({ year: 2026, month: 8 });
    expect(dia(comDescricao("Amazon Marketplace Cc (9/10)")[0])).toBe("2026-09-15");
    expect(dia(comDescricao("Amazon Marketplace Cc (10/10)")[0])).toBe("2026-10-15");
    // O "Lazer" foi o app que pôs (learn: false): as próximas ficam sem categoria, para ela dizer.
    expect(comDescricao("Amazon Marketplace Cc (10/10)")[0].parentCategory ?? null).toBeNull();
  });

  it("a categoria que ela escolheu na compra de loja de tudo vale para as próximas parcelas", async () => {
    await importarFatura([compra("2026-01-15", "Amazon Marketplace Cc (8/10)", 89.09, { installment: parseInstallment("Amazon Marketplace Cc (8/10)"), parentCategory: "LAZER", learn: true })], SET);
    expect(comDescricao("Amazon Marketplace Cc (10/10)")[0].parentCategory).toBe("LAZER");
  });

  it("a mesma fatura duas vezes não duplica nada", async () => {
    await importarFatura(FATURA_SETEMBRO, SET);
    const antes = banco.length;
    const r = await importarFatura(FATURA_SETEMBRO, SET);
    expect(r).toMatchObject({ ok: true, created: 0, skipped: 4 });
    expect(banco).toHaveLength(antes);
  });

  it("a fatura seguinte confirma a parcela projetada (uma por mês, nenhuma some)", async () => {
    await importarFatura(FATURA_SETEMBRO, SET);
    const r = await importarFatura([compra("2026-06-20", "LOJA X PARC 04/10", 100), compra("2026-09-15", "PADARIA", 20)], OUT);
    expect(r).toMatchObject({ ok: true, created: 1, skipped: 1 });
    for (let n = 3; n <= 10; n += 1) expect(comDescricao(`LOJA X PARC ${String(n).padStart(2, "0")}/10`)).toHaveLength(1);
  });

  it("virada de ano: a compra de dezembro na fatura que vence em janeiro fica em dezembro do ano anterior", async () => {
    await importarFatura([compra("2027-12-20", "PRESENTE", 300), compra("2027-01-03", "PADARIA", 15)], { vencimento: "2027-01-10", fechamento: null });
    expect(comDescricao("PRESENTE")[0]).toMatchObject({ year: 2026, month: 12 });
    expect(dia(comDescricao("PRESENTE")[0])).toBe("2026-12-20");
    expect(comDescricao("PADARIA")[0]).toMatchObject({ year: 2027, month: 1 });
  });

  it("a mesma compra que já veio do extrato (mesmo dia, valor e descrição) não entra de novo", async () => {
    await importTransactionsAction([compra("2026-08-28", "FARMACIA", 80)], "extrato");
    const r = await importarFatura(FATURA_SETEMBRO.slice(0, 2), SET);
    expect(r).toMatchObject({ created: 1, skipped: 1 });
    expect(comDescricao("FARMACIA")).toHaveLength(1);
  });
});

describe("fatura já gravada no modelo antigo (inteira num mês, sem dia)", () => {
  it("subir de novo a fatura antiga não duplica as compras nem a parcela", async () => {
    // Como ela entrou em setembro: mês escolhido, sem dia, 03/10 em setembro e 04..10 projetadas.
    await importTransactionsAction(FATURA_SETEMBRO, "fatura", 2026, 9);
    expect(doMes(2026, 9)).toHaveLength(4);
    const antes = banco.length;
    const r = await importarFatura(FATURA_SETEMBRO, SET);
    expect(r).toMatchObject({ ok: true, created: 0, skipped: 4 });
    expect(banco).toHaveLength(antes);
  });

  it("a assinatura da fatura antiga de agosto não faz a de setembro (modelo novo) ser pulada", async () => {
    await importTransactionsAction([compra("2026-08-03", "NETFLIX", 39.9), compra("2026-08-05", "POSTO", 200), compra("2026-08-06", "UBER", 30)], "fatura", 2026, 9);
    const r = await importarFatura(
      [compra("2026-09-03", "NETFLIX", 39.9), compra("2026-09-04", "MERCADO", 300), compra("2026-09-05", "PADARIA", 25)],
      OUT,
    );
    expect(r).toMatchObject({ created: 3, skipped: 0 });
  });

  it("troca de modelo no meio de uma compra parcelada: cada parcela continua existindo uma vez", async () => {
    await importTransactionsAction([compra("2026-06-20", "LOJA X PARC 03/10", 100)], "fatura", 2026, 9); // modelo antigo
    await importarFatura([compra("2026-06-20", "LOJA X PARC 04/10", 100)], OUT);
    await importarFatura([compra("2026-06-20", "LOJA X PARC 05/10", 100)], NOV);
    for (let n = 3; n <= 10; n += 1) expect(comDescricao(`LOJA X PARC ${String(n).padStart(2, "0")}/10`)).toHaveLength(1);
  });

  it("e o contrário: a fatura gravada pela data da compra subida de novo com 'tudo num mês' não duplica", async () => {
    await importarFatura(FATURA_SETEMBRO, SET);
    const antes = banco.length;
    const r = await importTransactionsAction(FATURA_SETEMBRO, "fatura", 2026, 9, "fatura.pdf", null, null, SET);
    expect(r).toMatchObject({ created: 0, skipped: 4 });
    expect(banco).toHaveLength(antes);
  });
});

/** Lê um CSV "Data;Descrição;Valor" como a tela faria. */
async function ler(docType: "extrato" | "fatura", linhas: string[]) {
  const form = new FormData();
  form.set("file", new File([["Data;Descrição;Valor", ...linhas].join("\n")], `${docType}.csv`));
  form.set("encoding", "text");
  form.set("docType", docType);
  const r = await parseStatementAction(form);
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe("pagamento da fatura no extrato", () => {
  const extrato = ["05/09/2026;Salário;5000,00", "12/09/2026;Pagamento de fatura;-269,90", "13/09/2026;Padaria;-10,00"];

  it("com a fatura dele no app: fica de fora como 'só mudei de conta', sem pergunta", async () => {
    await importarFatura(FATURA_SETEMBRO, SET);
    const { items } = await ler("extrato", extrato);
    const pagamento = items.find((i) => i.description === "Pagamento de fatura");
    expect(pagamento).toMatchObject({ ignorar: true, nota: expect.stringMatching(/só mudou de conta/) });
    expect(pagamento?.duvida ?? null).toBeNull();
  });

  it("sem a fatura: entra como gasto em Outros › Cartão de crédito, já classificado, e a fatura que chega depois oferece tirar", async () => {
    const { items } = await ler("extrato", extrato);
    const pagamento = items.find((i) => i.description === "Pagamento de fatura");
    expect(pagamento?.ignorar).toBeFalsy();
    expect(pagamento).toMatchObject({ parentCategory: "OUTROS", subcategory: "Cartão de crédito", autoClassified: true });
    await importTransactionsAction(
      items.filter((i) => !i.ignorar).map((i) => ({ ...i, learn: false, parentCategory: i.parentCategory ?? "OUTROS" })),
      "extrato",
    );
    const r = await importarFatura(FATURA_SETEMBRO, SET);
    if (!r.ok) throw new Error(r.error);
    expect(r.cardPaymentCandidates.map((c) => c.description)).toEqual(["Pagamento de fatura"]);
  });

  it("só a fatura de agosto no app: o pagamento de setembro não some", async () => {
    await importarFatura([compra("2026-07-20", "MERCADO", 100), compra("2026-08-02", "POSTO", 50)], { vencimento: "2026-08-12", fechamento: "2026-08-05" });
    const { items } = await ler("extrato", extrato);
    expect(items.find((i) => i.description === "Pagamento de fatura")).toMatchObject({ subcategory: "Cartão de crédito" });
  });
});

describe("o que a tela recebe pra frase de confirmação", () => {
  it("fatura lida: meses das compras e quantas são", async () => {
    const r = await ler("fatura", ["20/08/2026;MERCADO EXTRA;150,00", "28/08/2026;FARMACIA;80,00", "03/09/2026;NETFLIX;39,90", "04/09/2026;ESTORNO NETFLIX;-39,90"]);
    expect(r.stats).toMatchObject({ compras: 3, mesesDasCompras: ["2026-08", "2026-09"], vencimento: null, fechamento: null });
  });
});
