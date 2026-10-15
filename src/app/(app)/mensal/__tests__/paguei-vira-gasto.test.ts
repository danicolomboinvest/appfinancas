import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Paguei" vira gasto (15/10/2026), gravando de verdade num banco de mentira: o Pronto cria o
 * gasto ligado à conta e passa o vencimento; o Desfazer apaga o gasto e volta; o extrato que traz
 * o mesmo pagamento deixa um só (a linha do extrato, com a categoria e a ligação da conta),
 * inclusive na conta que varia; e nada sai sem ela ver.
 */

type Linha = Record<string, unknown> & { id: string };
const banco = vi.hoisted(() => ({ lancamentos: [] as Linha[], contas: [] as Linha[], lotes: [] as Linha[], seq: 0 }));

/** O `where` do Prisma, no pedaço que estas telas usam. */
function bate(where: Record<string, unknown> | undefined, l: Linha): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (cond === undefined) return true;
    if (k === "OR") return (cond as Record<string, unknown>[]).some((w) => bate(w, l));
    if (k === "AND") return (cond as Record<string, unknown>[]).every((w) => bate(w, l));
    if (k === "importBatch") {
      const lote = banco.lotes.find((b) => b.id === l.importBatchId);
      const is = (cond as { is?: Record<string, unknown> }).is;
      return is ? !!lote && bate(is, lote) : true;
    }
    const v = l[k] ?? null;
    if (cond === null) return v === null;
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
    if (typeof cond === "object") {
      const c = cond as Record<string, unknown>;
      if ("in" in c) return (c.in as unknown[]).includes(v);
      if ("not" in c) return c.not === null ? v !== null : v !== c.not;
      if ("gte" in c || "lte" in c) {
        if (!(v instanceof Date)) return false;
        return (!c.gte || v >= (c.gte as Date)) && (!c.lte || v <= (c.lte as Date));
      }
      if ("startsWith" in c) return typeof v === "string" && v.toLowerCase().startsWith(String(c.startsWith).toLowerCase());
      return true;
    }
    return v === cond;
  });
}

function ordenar(lista: Linha[], orderBy: unknown): Linha[] {
  const ob = (Array.isArray(orderBy) ? orderBy[0] : orderBy) as Record<string, "asc" | "desc"> | undefined;
  if (!ob) return lista;
  const [campo, dir] = Object.entries(ob)[0];
  return [...lista].sort((a, b) => {
    const x = a[campo] as number | Date | string;
    const y = b[campo] as number | Date | string;
    return (x < y ? -1 : x > y ? 1 : 0) * (dir === "desc" ? -1 : 1);
  });
}

/** Uma cópia, como o Prisma devolve (mexer no banco depois não muda o que já foi lido). */
function comRelacao(l: Linha, select?: Record<string, unknown>): Linha {
  if (!select?.contaAPagar) return { ...l };
  const c = banco.contas.find((x) => x.id === l.contaAPagarId);
  return { ...l, contaAPagar: c ? { ...c } : null };
}

function tabela(nome: "lancamentos" | "contas" | "lotes", padrao: () => Record<string, unknown>) {
  return {
    findMany: vi.fn(async (a: { where?: Record<string, unknown>; orderBy?: unknown; take?: number; select?: Record<string, unknown> } = {}) =>
      ordenar(banco[nome].filter((l) => bate(a.where, l)), a.orderBy).slice(0, a.take ?? 10_000).map((l) => comRelacao(l, a.select)),
    ),
    findFirst: vi.fn(async (a: { where?: Record<string, unknown>; orderBy?: unknown; select?: Record<string, unknown> } = {}) => {
      const l = ordenar(banco[nome].filter((x) => bate(a.where, x)), a.orderBy)[0];
      return l ? comRelacao(l, a.select) : null;
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const l = { ...padrao(), id: `${nome[0]}${++banco.seq}`, createdAt: new Date(Date.now() + banco.seq), ...data } as Linha;
      banco[nome].push(l);
      return l;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const alvo = banco[nome].filter((l) => bate(where, l));
      alvo.forEach((l) => Object.assign(l, data));
      return { count: alvo.length };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(banco[nome].find((l) => l.id === where.id)!, data)),
    deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const antes = banco[nome].length;
      banco[nome] = banco[nome].filter((l) => !bate(where, l));
      return { count: antes - banco[nome].length };
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      const l = banco[nome].find((x) => x.id === where.id);
      banco[nome] = banco[nome].filter((x) => x.id !== where.id);
      return l;
    }),
    count: vi.fn(async (a: { where?: Record<string, unknown> } = {}) => banco[nome].filter((l) => bate(a.where, l)).length),
    groupBy: vi.fn(async () => []),
  };
}

vi.mock("@/lib/db/prisma", () => {
  const prisma: Record<string, unknown> = {
    monthlyEntry: tabela("lancamentos", () => ({ importBatchId: null, externalId: null, contaAPagarId: null, origemDoPagamento: null, entryDate: null, parentCategory: null, customCategoryId: null, subcategory: null, doCasal: null, soMeu: false, pessoa: null, autorUserId: null, recurrenceId: null, noCartao: null })),
    contaAPagar: tabela("contas", () => ({ quitada: false, pagaEm: null, parcelas: null, parcelaAtual: null, intervalo: null, unidade: null, mesesEscolhidos: [], aproximado: false, categoria: null, tipo: null })),
    importBatch: tabela("lotes", () => ({})),
    customCategory: { findMany: vi.fn(async () => []) },
    user: { findUnique: vi.fn(async () => ({ name: "Ana" })) },
  };
  prisma.$transaction = vi.fn(async (arg: unknown) => (typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as Promise<unknown>[])));
  return { prisma };
});

const ctx = vi.hoisted(() => ({ userId: "u1", profileId: "pessoal", profileKind: "PESSOAL", casa: null as unknown }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  getRequiredSession: vi.fn(async () => ctx),
  doDono: (c: { userId: string; profileId: string }) => ({ userId: c.userId, profileId: c.profileId }),
}));
vi.mock("@/lib/contas/contas", async (orig) => ({ ...(await orig<typeof import("@/lib/contas/contas")>()), hojeEmBrasilia: () => new Date(Date.UTC(2026, 9, 15)) }));
vi.mock("@/lib/repositories/monthly-entry.repo", () => ({
  createMonthlyEntry: vi.fn(async (c: { userId: string; profileId: string }, input: Record<string, unknown>) => {
    banco.lancamentos.push({ id: `imp${++banco.seq}`, userId: c.userId, profileId: (input.profileId as string) ?? c.profileId, contaAPagarId: null, externalId: null, ...input, createdAt: new Date() } as Linha);
  }),
}));
vi.mock("@/lib/repositories/import-batch.repo", async (orig) => ({
  ...(await orig<typeof import("@/lib/repositories/import-batch.repo")>()),
  createImportBatch: vi.fn(async (_c: unknown, d: { docType: string; fileName?: string }) => {
    const l = { id: `lote-${++banco.seq}`, userId: "u1", profileId: "pessoal", docType: d.docType, fileName: d.fileName ?? null };
    banco.lotes.push(l);
    return l;
  }),
  deleteEmptyImportBatch: vi.fn(async () => {}),
}));
vi.mock("@/lib/repositories/profile.repo", () => ({ listProfiles: vi.fn(async () => [{ id: "pessoal" }]) }));
vi.mock("@/lib/repositories/decisao.repo", () => ({ descricoesOriginais: vi.fn(async () => new Map()) }));
vi.mock("@/lib/repositories/custom-category.repo", () => ({ listCustomCategories: vi.fn(async () => []) }));
vi.mock("@/lib/repositories/transaction-rule.repo", () => ({ listTransactionRules: vi.fn(async () => []), upsertTransactionRule: vi.fn(async () => {}) }));
vi.mock("@/lib/repositories/import-diagnostic.repo", () => ({
  recordImportDiagnostic: vi.fn(async () => "diag"),
  isPartialRead: vi.fn(() => false),
  mensagemImplausivel: vi.fn(() => ""),
  safeHeader: vi.fn(() => ""),
  MARCA_CONFERIDO: "[conferido]",
  MARCA_NAO_FECHOU: "[não fechou]",
}));
vi.mock("@/lib/repositories/import-file.repo", () => ({ storeFailedImportFile: vi.fn(async () => {}) }));

const { pagarContaAction, desfazerPagamentoAction } = await import("@/app/(app)/orcamento/contas/actions");
const { carregarDadosDoPaguei } = await import("@/lib/repositories/conta-a-pagar.repo");
const { deleteImportBatchWithEntries } = await import("@/lib/repositories/import-batch.repo");
const { importTransactionsAction, parseStatementAction } = await import("../import-actions");

function conta(x: Record<string, unknown>) {
  const c = { id: `c-${x.nome}`, userId: "u1", profileId: "pessoal", repete: true, lembrar: true, quitada: false, pagaEm: null, parcelas: null, parcelaAtual: null, intervalo: null, unidade: null, mesesEscolhidos: [], aproximado: false, categoria: null, tipo: null, ...x } as Linha;
  banco.contas.push(c);
  return c;
}
const aluguel = () => conta({ nome: "Aluguel", valor: 1800, vencimento: new Date(Date.UTC(2026, 9, 15)), diaDoMes: 15 });
const luz = () => conta({ nome: "Luz", valor: null, vencimento: new Date(Date.UTC(2026, 9, 18)), diaDoMes: 18 });

async function lerExtrato(linhas: string[], arquivo = "nubank-outubro.csv") {
  const form = new FormData();
  form.set("file", new File([["Data;Descrição;Valor", ...linhas].join("\n")], arquivo));
  form.set("encoding", "text");
  form.set("docType", "extrato");
  const r = await parseStatementAction(form);
  if (!r.ok) throw new Error(r.error);
  return r.items;
}

/** O que a tela manda na gravação (StatementImport.handleImport), sem a parte visual. */
function confirmar(items: Awaited<ReturnType<typeof lerExtrato>>) {
  return items.flatMap((it) => {
    const base = { date: it.date, description: it.description, amount: it.amount, category: it.category, parentCategory: it.parentCategory, customCategoryId: it.customCategoryId, subcategory: it.subcategory, learn: false, installment: it.installment, profileId: it.profileId };
    if (it.jaNoApp?.paguei) return [{ ...base, paguei: it.jaNoApp.id }];
    if (it.jaNoApp || it.ignorar) return [];
    return [base];
  });
}

const gastos = () => banco.lancamentos.filter((l) => l.category === "EXPENSE");

beforeEach(() => {
  banco.lancamentos = [];
  banco.contas = [];
  banco.lotes = [];
  ctx.casa = null;
});

describe("o Pronto do Paguei", () => {
  it("cria o gasto com a categoria, o nome, o valor, o dia, a origem e a ligação, e passa o vencimento", async () => {
    aluguel();
    const r = await pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-15", origem: "conta:nubank" });
    expect(r).toMatchObject({ ok: true, antes: "2026-10-15", proxima: "2026-11-15" });
    expect(gastos()).toHaveLength(1);
    expect(gastos()[0]).toMatchObject({ description: "Aluguel", amount: 1800, parentCategory: "MORADIA", subcategory: "Aluguel", contaAPagarId: "c-Aluguel", origemDoPagamento: "conta:nubank", noCartao: false, year: 2026, month: 10 });
    expect((gastos()[0].entryDate as Date).toISOString().slice(0, 10)).toBe("2026-10-15");
    expect((banco.contas[0].vencimento as Date).toISOString().slice(0, 10)).toBe("2026-11-15");
  });

  it("o toque duplo (dois Pronto ao mesmo tempo) não cria dois gastos nem pula dois meses", async () => {
    aluguel();
    const [r1, r2] = await Promise.all([
      pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-15", origem: "conta" }),
      pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-15", origem: "conta" }),
    ]);
    expect([r1.ok, r2.ok].sort()).toEqual([false, true]);
    expect(gastos()).toHaveLength(1);
    expect((banco.contas[0].vencimento as Date).toISOString().slice(0, 10)).toBe("2026-11-15");
  });

  it("sem valor, com dia no futuro ou origem estranha: não grava nada", async () => {
    aluguel();
    expect(await pagarContaAction("c-Aluguel", { valor: 0, dia: "2026-10-15", origem: "conta" })).toMatchObject({ ok: false, erro: "Falta o valor" });
    expect(await pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-16", origem: "conta" })).toMatchObject({ ok: false });
    expect(await pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-15", origem: "conta:<x>" })).toMatchObject({ ok: false });
    expect(gastos()).toHaveLength(0);
  });

  it("no cartão, o gasto é do cartão (conta no limite)", async () => {
    aluguel();
    await pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-14", origem: "cartao:itau" });
    expect(gastos()[0]).toMatchObject({ noCartao: true, origemDoPagamento: "cartao:itau" });
  });

  it("a próxima abre com a origem usada agora", async () => {
    aluguel();
    luz();
    await pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-15", origem: "cartao:itau" });
    const d = await carregarDadosDoPaguei(ctx as never, [{ id: "c-Luz", nome: "Luz", valor: null }], new Date(Date.UTC(2026, 9, 15)));
    expect(d.origem).toBe("cartao:itau");
  });

  it("casal simples: quem tocou é quem pagou, e o aluguel nasce Da casa", async () => {
    ctx.casa = { eu: { userId: "u1", profileId: "pessoal", letra: "A", nome: "Ana" }, outro: { userId: "u2", profileId: "p2", letra: "B", nome: "Lucas" } };
    aluguel();
    await pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-15", origem: "conta" });
    expect(gastos()[0]).toMatchObject({ userId: "u1", doCasal: true });
  });
});

describe("o Desfazer", () => {
  it("apaga o gasto que o Paguei criou e volta o vencimento", async () => {
    aluguel();
    const r = await pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-15", origem: "conta" });
    if (!r.ok) throw new Error(r.erro);
    await desfazerPagamentoAction("c-Aluguel", r.antes, r.antesParcela, r.lancamentoId);
    expect(gastos()).toHaveLength(0);
    expect((banco.contas[0].vencimento as Date).toISOString().slice(0, 10)).toBe("2026-10-15");
    expect(banco.contas[0].pagaEm).toBeNull();
  });

  it("sem o id (o Desfazer das pagas há pouco), apaga o último gasto do Paguei desta conta", async () => {
    conta({ nome: "IPVA", valor: 900, vencimento: new Date(Date.UTC(2026, 9, 15)), diaDoMes: 15, repete: false });
    await pagarContaAction("c-IPVA", { valor: 900, dia: "2026-10-15", origem: "conta" });
    expect(banco.contas[0].quitada).toBe(true);
    await desfazerPagamentoAction("c-IPVA", "2026-10-15");
    expect(gastos()).toHaveLength(0);
    expect(banco.contas[0].quitada).toBe(false);
  });

  it("nunca apaga a linha do extrato que já ficou no lugar do Paguei", async () => {
    aluguel();
    const r = await pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-15", origem: "conta:nubank" });
    if (!r.ok) throw new Error(r.erro);
    const items = await lerExtrato(["16/10/2026;PIX ENVIADO IMOBILIARIA CENTRO;-1800,00"]);
    await importTransactionsAction(confirmar(items), "extrato", undefined, undefined, "nubank-outubro.csv");
    await desfazerPagamentoAction("c-Aluguel", r.antes, r.antesParcela, r.lancamentoId);
    expect(gastos()).toHaveLength(1);
    expect(gastos()[0].importBatchId).not.toBeNull();
  });
});

describe("o extrato chega com o mesmo pagamento", () => {
  it("o aluguel: fica um só, a linha do extrato, com a categoria e a ligação da conta", async () => {
    aluguel();
    await pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-15", origem: "conta:nubank" });
    const items = await lerExtrato(["16/10/2026;PIX ENVIADO IMOBILIARIA CENTRO;-1800,00", "16/10/2026;PADARIA;-12,00"]);
    const pix = items.find((i) => i.description.includes("IMOBILIARIA"))!;
    expect(pix.jaNoApp).toMatchObject({ paguei: true, descricao: "Aluguel", valor: 1800 });
    expect(pix.possivelDuplicata).toBeFalsy();
    const r = await importTransactionsAction(confirmar(items), "extrato", undefined, undefined, "nubank-outubro.csv");
    expect(r).toMatchObject({ ok: true, created: 1, skipped: 1 });
    const aluguelNoApp = gastos().filter((g) => g.contaAPagarId === "c-Aluguel");
    expect(aluguelNoApp).toHaveLength(1);
    expect(aluguelNoApp[0]).toMatchObject({ amount: 1800, parentCategory: "MORADIA", origemDoPagamento: "conta:nubank" });
    expect(aluguelNoApp[0].importBatchId).toMatch(/^lote-/);
    expect(gastos().reduce((s, g) => s + Number(g.amount), 0)).toBe(1812);
  });

  it("a luz, que varia: R$ 185,00 no extrato contra R$ 182,40 no Paguei (1,4%) pergunta; o Sim deixa um só", async () => {
    luz();
    await pagarContaAction("c-Luz", { valor: 182.4, dia: "2026-10-14", origem: "conta:nubank" });
    const items = await lerExtrato(["15/10/2026;ENEL SP;-185,00"]);
    expect(items[0].possivelDuplicata).toMatchObject({ paguei: true, descricao: "Luz", valor: 182.4 });
    // "É o mesmo" na tela: a pergunta vira "já estava no app (Paguei)".
    const respondidas = items.map((it) => ({ ...it, possivelDuplicata: null, jaNoApp: { descricao: "Luz", data: "2026-10-14", id: it.possivelDuplicata!.id!, valor: 182.4, paguei: true } }));
    await importTransactionsAction(confirmar(respondidas), "extrato", undefined, undefined, "nubank-outubro.csv");
    expect(gastos()).toHaveLength(1);
    expect(gastos()[0]).toMatchObject({ amount: 185, contaAPagarId: "c-Luz", parentCategory: "MORADIA", subcategory: "Luz" });
  });

  it("São diferentes: os dois ficam (nada sai sem ela ver)", async () => {
    luz();
    await pagarContaAction("c-Luz", { valor: 182.4, dia: "2026-10-14", origem: "conta:nubank" });
    const items = await lerExtrato(["15/10/2026;ENEL SP;-185,00"]);
    const respondidas = items.map((it) => ({ ...it, possivelDuplicata: null }));
    await importTransactionsAction(confirmar(respondidas), "extrato", undefined, undefined, "nubank-outubro.csv");
    expect(gastos()).toHaveLength(2);
  });

  it("outro banco não junta sozinho: no máximo a pergunta geral \"parece já estar no app\"", async () => {
    aluguel();
    await pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-15", origem: "conta:nubank" });
    const items = await lerExtrato(["16/10/2026;PIX ENVIADO IMOBILIARIA;-1800,00"], "itau-outubro.csv");
    expect(items[0].jaNoApp).toBeFalsy();
    expect(items[0].possivelDuplicata?.paguei).toBeFalsy();
  });

  it("um id trocado na gravação não apaga nada: a linha entra como nova", async () => {
    aluguel();
    await pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-15", origem: "conta:nubank" });
    const id = gastos()[0].id;
    await importTransactionsAction([{ date: "2026-10-16", description: "OUTRA COISA", amount: 50, category: "EXPENSE", parentCategory: "OUTROS", customCategoryId: null, subcategory: null, learn: false, paguei: id }], "extrato", undefined, undefined, "nubank-outubro.csv");
    expect(gastos()).toHaveLength(2);
  });

  it("apagar o lote do extrato devolve o Paguei (a conta continua paga e o gasto não some)", async () => {
    aluguel();
    await pagarContaAction("c-Aluguel", { valor: 1800, dia: "2026-10-15", origem: "conta:nubank" });
    const items = await lerExtrato(["16/10/2026;PIX ENVIADO IMOBILIARIA CENTRO;-1800,00"]);
    await importTransactionsAction(confirmar(items), "extrato", undefined, undefined, "nubank-outubro.csv");
    const lote = gastos()[0].importBatchId as string;
    await deleteImportBatchWithEntries(ctx as never, lote);
    expect(gastos()).toHaveLength(1);
    expect(gastos()[0]).toMatchObject({ contaAPagarId: "c-Aluguel", importBatchId: null });
  });
});
