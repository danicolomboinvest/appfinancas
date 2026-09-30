import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Extrato e fatura do MESMO mês, extrato da semana + extrato do mês, fatura que fecha em outro
 * mês, parcelas, estornos e o pagamento da fatura — com o banco de dados trocado por uma lista em
 * memória que entende o pedaço do `where` do Prisma que import-actions.ts usa.
 *
 * Os `it(...)` protegem o que já funciona. Os `it.fails(...)` descrevem o resultado CERTO de um
 * caso que hoje sai errado: o teste passa enquanto o defeito existe e começa a falhar quando o
 * defeito for consertado — aí é só trocar `it.fails` por `it`.
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
let proximoId = 0;
/** O que `prisma.importBatch.count` responde: quantas faturas ela importou nos últimos 120 dias. */
let faturasRecentes = 0;

/** O pedaço do `where` do Prisma que o import usa: igualdade, null, { not: null }, { in: [...] } e OR. */
function bate(e: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([campo, cond]) => {
    if (campo === "OR") return (cond as Record<string, unknown>[]).some((w) => bate(e, w));
    const valor = e[campo];
    if (cond === null) return valor === null || valor === undefined;
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { not?: unknown; in?: unknown[] };
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
    importBatch: { count: vi.fn(async () => faturasRecentes) },
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
  createImportBatch: vi.fn(async () => ({ id: `lote-${++lote}` })),
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

const { importTransactionsAction, parseStatementAction, removeCardPaymentCandidateAction } = await import("../import-actions");
type ReviewItem = Extract<Awaited<ReturnType<typeof parseStatementAction>>, { ok: true }>["items"][number];

// ---------------------------------------------------------------- ajudantes

/** Lê um CSV "Data;Descrição;Valor" como a tela faria (extrato ou fatura). */
async function ler(docType: "extrato" | "fatura", linhas: string[], faturaMonth?: string) {
  const form = new FormData();
  form.set("file", new File([["Data;Descrição;Valor", ...linhas].join("\n")], `${docType}.csv`));
  form.set("encoding", "text");
  form.set("docType", docType);
  if (faturaMonth) form.set("faturaMonth", faturaMonth);
  const r = await parseStatementAction(form);
  if (!r.ok) throw new Error(r.error);
  return r.items;
}

/** O que `handleImport` (StatementImport.tsx) manda pro servidor: tira o que ficou de fora e o
 * gasto sem categoria, e o resto vai como está. `mexer` faz o papel dos toques na revisão; o
 * gasto que chegou sem categoria ganha "Outros", como quem passa pela fila de revisão. */
function confirmar(items: ReviewItem[], mexer: (it: ReviewItem) => ReviewItem = (it) => it) {
  return items
    .map((it) => (it.category === "EXPENSE" && !it.parentCategory && !it.customCategoryId ? { ...it, parentCategory: "OUTROS" as const } : it))
    .map((it) => mexer({ ...it }))
    .filter((it) => !it.ignorar && (it.category !== "EXPENSE" || it.parentCategory || it.customCategoryId))
    .map((it) => ({
      date: it.date,
      description: it.description,
      amount: it.amount,
      category: it.category,
      parentCategory: it.parentCategory,
      customCategoryId: it.customCategoryId,
      subcategory: it.subcategory,
      learn: false,
      installment: it.installment,
      profileId: it.profileId,
      estorno: it.estorno ?? false,
    }));
}

/** Lê e confirma, sem mexer em nada (quem só aperta "Importar"). */
async function importar(docType: "extrato" | "fatura", linhas: string[], faturaMonth?: string, mexer?: (it: ReviewItem) => ReviewItem) {
  const items = await ler(docType, linhas, faturaMonth);
  const [y, m] = (faturaMonth ?? "").split("-").map(Number);
  return importTransactionsAction(confirmar(items, mexer), docType, docType === "fatura" ? y : undefined, docType === "fatura" ? m : undefined);
}

/** Compra da fatura já pronta pra confirmar (sem passar pelo leitor de arquivo). */
const compra = (description: string, amount: number, extra: Record<string, unknown> = {}) => ({
  date: "2026-09-12",
  description,
  amount,
  category: "EXPENSE" as const,
  parentCategory: "OUTROS" as const,
  customCategoryId: null,
  subcategory: null,
  learn: false,
  installment: (() => {
    const m = description.match(/PARC (\d{1,2})\/(\d{1,2})$/);
    return m ? { current: Number(m[1]), total: Number(m[2]), confident: true } : null;
  })(),
  ...extra,
});

const doMes = (year: number, month: number, profileId = "pessoal") => banco.filter((e) => e.year === year && e.month === month && e.profileId === profileId);
/** O que a Visão mensal mostra como "gastou": gasto soma, estorno (negativo) desconta. */
const gastouNoMes = (year: number, month: number, profileId = "pessoal") =>
  Math.round(doMes(year, month, profileId).filter((e) => e.category === "EXPENSE").reduce((s, e) => s + e.amount, 0) * 100) / 100;
const desfazer = (loteId: string) => {
  for (let i = banco.length - 1; i >= 0; i -= 1) if (banco[i].importBatchId === loteId) banco.splice(i, 1);
};

beforeEach(() => {
  banco.length = 0;
  faturasRecentes = 0;
});

// ---------------------------------------------------------------- extrato + fatura do mesmo mês

describe("extrato e fatura do mesmo mês: o pagamento da fatura não conta duas vezes", () => {
  const extratoSetembro = [
    "05/09/2026;Salário;5000,00",
    "08/09/2026;Pagamento de fatura;-2800,00",
    "09/09/2026;Padaria Pão Quente;-18,50",
  ];
  const faturaSetembro = ["20/08/2026;MERCADO EXTRA;1500,00", "02/09/2026;FARMACIA PAGUE MENOS;800,00", "05/09/2026;POSTO SHELL;500,00"];

  it("extrato ANTES da fatura: a fatura oferece o pagamento do extrato pra remover, e remover deixa o mês certo", async () => {
    await importar("extrato", extratoSetembro);
    expect(gastouNoMes(2026, 9)).toBe(2818.5); // sem fatura ainda, o pagamento é o gasto do cartão
    const r = await importar("fatura", faturaSetembro, "2026-09");
    if (!r.ok) throw new Error(r.error);
    expect(r.cardPaymentCandidates).toHaveLength(1);
    expect(r.cardPaymentCandidates[0]).toMatchObject({ description: "Pagamento de fatura", amount: 2800, date: "2026-09-08" });
    // Antes de remover: fatura e pagamento contando juntos (a tela pergunta justamente isso).
    expect(gastouNoMes(2026, 9)).toBe(5618.5);
    await removeCardPaymentCandidateAction(r.cardPaymentCandidates[0].id);
    expect(gastouNoMes(2026, 9)).toBe(2818.5); // 2.800 de compras + 18,50 da padaria
  });

  it("fatura ANTES do extrato: o pagamento já sai marcado 'fica de fora', com o motivo", async () => {
    await importar("fatura", faturaSetembro, "2026-09");
    faturasRecentes = 1;
    const items = await ler("extrato", extratoSetembro);
    const pagamento = items.find((i) => i.description === "Pagamento de fatura");
    expect(pagamento).toMatchObject({ ignorar: true });
    expect(pagamento?.nota).toMatch(/fatura/i);
    await importTransactionsAction(confirmar(items), "extrato");
    expect(gastouNoMes(2026, 9)).toBe(2818.5);
  });

  it("a fatura não oferece pagamento de outro perfil nem estorno antigo (valor negativo)", async () => {
    banco.push(
      { id: "emp", userId: "u1", profileId: "empresa", year: 2026, month: 9, entryDate: new Date("2026-09-08T12:00:00"), amount: 900, description: "Pagamento de fatura", category: "EXPENSE", parentCategory: "OUTROS", importBatchId: "x", externalId: null },
      { id: "neg", userId: "u1", profileId: "pessoal", year: 2026, month: 9, entryDate: null, amount: -2800, description: "Pagamento de fatura", category: "EXPENSE", parentCategory: "OUTROS", importBatchId: "y", externalId: null },
    );
    const r = await importar("fatura", faturaSetembro, "2026-09");
    if (!r.ok) throw new Error(r.error);
    expect(r.cardPaymentCandidates).toEqual([]);
  });

  it("fatura que fecha em outro mês: o pagamento feito no mês seguinte também aparece pra remover", async () => {
    // Compras de agosto, fatura escolhida como agosto, paga em 08/09.
    await importar("extrato", extratoSetembro);
    const r = await importar("fatura", ["20/07/2026;MERCADO EXTRA;1500,00", "02/08/2026;FARMACIA;1300,00"], "2026-08");
    if (!r.ok) throw new Error(r.error);
    expect(r.cardPaymentCandidates.map((c) => c.date)).toEqual(["2026-09-08"]);
  });

  // ERA DEFEITO (corrigido em set/2026): o extrato do Banco do Brasil escreve "Pagto cartão crédito" (ver
  // lib/import/__tests__/bb-pdf.test.ts), sem a palavra "fatura". Nem `parecePagamentoDeFatura`
  // (dinheiro-proprio.ts:37) nem `looksLikeCardPayment` (import-actions.ts:380) reconhecem:
  // quem importa a fatura fica com o cartão contado DUAS vezes e o app nem pergunta.
  it("extrato do BB ('Pagto cartão crédito') com fatura importada: o pagamento fica de fora", async () => {
    faturasRecentes = 1;
    const items = await ler("extrato", ["05/09/2026;Salário;5000,00", "08/09/2026;Pagto cartão crédito VISA;-2800,00", "09/09/2026;Padaria;-18,50"]);
    expect(items.find((i) => i.description.startsWith("Pagto cart"))?.ignorar).toBe(true);
  });

  it("extrato do BB antes da fatura: o 'Pagto cartão crédito' aparece pra remover", async () => {
    await importar("extrato", ["05/09/2026;Salário;5000,00", "08/09/2026;Pagto cartão crédito VISA;-2800,00"]);
    const r = await importar("fatura", faturaSetembro, "2026-09");
    if (!r.ok) throw new Error(r.error);
    expect(r.cardPaymentCandidates).toHaveLength(1);
  });

  // ERA DEFEITO (corrigido em set/2026): as duas regras de "pagamento de fatura" do import não concordam. "PGTO FATURA" e
  // "PAGTO FATURA" passam em `parecePagamentoDeFatura` (dinheiro-proprio.ts:37, que aceita
  // pgto/pag) mas não em `looksLikeCardPayment` (import-actions.ts:382, que só aceita
  // "pagament" ou "cartão"): com o extrato subido antes, a fatura não oferece remover.
  it("extrato com 'PGTO FATURA' subido antes da fatura: aparece pra remover", async () => {
    await importar("extrato", ["05/09/2026;Salário;5000,00", "08/09/2026;PGTO FATURA NUBANK;-2800,00"]);
    const r = await importar("fatura", faturaSetembro, "2026-09");
    if (!r.ok) throw new Error(r.error);
    expect(r.cardPaymentCandidates.map((c) => c.description)).toEqual(["PGTO FATURA NUBANK"]);
  });

  // ERA DEFEITO (corrigido em set/2026): "Pagamento de fatura CLARO" é a conta do celular, não o cartão. Com uma fatura de
  // cartão importada, o extrato a deixa de fora sozinho, e a conta de telefone some do mês.
  // (classify.test.ts já reconhece essa linha como Internet.)
  it("conta de celular 'Pagamento de fatura CLARO' continua contando como gasto", async () => {
    faturasRecentes = 1;
    const items = await ler("extrato", ["05/09/2026;Salário;5000,00", "10/09/2026;Pagamento de fatura CLARO;-89,90", "11/09/2026;Padaria;-10,00"]);
    expect(items.find((i) => i.description.includes("CLARO"))?.ignorar).toBeFalsy();
  });

  it("o pagamento lançado À MÃO como 'Pagamento da fatura do cartão' também aparece pra remover", async () => {
    banco.push({ id: "mao", userId: "u1", profileId: "pessoal", year: 2026, month: 9, entryDate: null, amount: 2800, description: "Pagamento da fatura do cartão", category: "EXPENSE", parentCategory: "OUTROS", importBatchId: null, externalId: null });
    const r = await importar("fatura", faturaSetembro, "2026-09");
    if (!r.ok) throw new Error(r.error);
    expect(r.cardPaymentCandidates.map((c) => c.id)).toEqual(["mao"]);
  });

  // ERA DEFEITO (corrigido em set/2026): quem é iniciante lança a fatura à mão do jeito que fala: "Fatura Nubank", "Cartão
  // Nubank". Sem "pagamento" junto de "fatura" (import-actions.ts:382), a importação da fatura não
  // oferece remover, e o mês fica com a fatura inteira contada duas vezes.
  it("o lançamento à mão 'Fatura Nubank' aparece pra remover quando a fatura é importada", async () => {
    banco.push({ id: "mao", userId: "u1", profileId: "pessoal", year: 2026, month: 9, entryDate: null, amount: 2800, description: "Fatura Nubank", category: "EXPENSE", parentCategory: "OUTROS", importBatchId: null, externalId: null });
    const r = await importar("fatura", faturaSetembro, "2026-09");
    if (!r.ok) throw new Error(r.error);
    expect(r.cardPaymentCandidates.map((c) => c.id)).toEqual(["mao"]);
  });
});

// ---------------------------------------------------------------- extrato da semana + do mês

describe("extrato da semana e depois o extrato do mês inteiro", () => {
  const semana = ["01/09/2026;Salário;5000,00", "02/09/2026;Mercado Dia;-120,40", "03/09/2026;Uber Trip;-15,00", "03/09/2026;Uber Trip;-15,00"];
  const mes = [...semana, "10/09/2026;Farmácia São João;-45,00", "15/09/2026;ESTORNO Loja Renner;80,00", "20/09/2026;Aplicação RDB;-300,00"];

  it("só entra o que é novo; as duas corridas iguais do mesmo dia continuam sendo duas", async () => {
    const r1 = await importar("extrato", semana);
    expect(r1).toMatchObject({ ok: true, created: 4 });
    const r2 = await importar("extrato", mes);
    expect(r2).toMatchObject({ ok: true, created: 3, skipped: 4 });
    expect(doMes(2026, 9).filter((e) => e.description === "Uber Trip")).toHaveLength(2);
  });

  it("estorno e aplicação do extrato do mês, subido duas vezes, não duplicam", async () => {
    await importar("extrato", mes);
    const r = await importar("extrato", mes);
    expect(r).toMatchObject({ created: 0, skipped: 7 });
    expect(doMes(2026, 9).find((e) => e.description === "ESTORNO Loja Renner")).toMatchObject({ amount: -80, category: "EXPENSE" });
    expect(doMes(2026, 9).find((e) => e.description === "Aplicação RDB")).toMatchObject({ category: "INVESTMENT_CONTRIBUTION" });
  });

  it("a semana em CSV e o mês em outro formato (acento/pontuação diferentes) não duplicam", async () => {
    await importar("extrato", ["02/09/2026;MERCADO DIA - SP;-120,40", "20/09/2026;APLICACAO RDB;-300,00"]);
    const r = await importar("extrato", ["02/09/2026;Mercado Dia SP;-120,40", "20/09/2026;Aplicação RDB;-300,00"]);
    expect(r).toMatchObject({ created: 0, skipped: 2 });
  });

  // ERA DEFEITO (corrigido em set/2026): na semana ela tocou "Estorno" num crédito que o app leu como renda ("PIX RECEBIDO
  // LOJA X" = devolução). Gravou -80 como gasto. No extrato do mês a mesma linha volta como
  // renda +80: a chave exata compara o valor COM sinal (import-actions.ts:729-733) e a solta
  // compara o tipo (import-actions.ts:751-752), então nenhuma bate e a devolução entra de novo,
  // agora como renda — o mês fica com 80 de renda que não existe.
  it("crédito marcado como estorno na semana não volta como renda no extrato do mês", async () => {
    const linhas = ["01/09/2026;Salário;5000,00", "04/09/2026;PIX RECEBIDO LOJA X;80,00", "05/09/2026;Padaria;-10,00"];
    await importar("extrato", linhas, undefined, (it) =>
      it.description === "PIX RECEBIDO LOJA X" ? { ...it, category: "EXPENSE", estorno: true, parentCategory: "OUTROS" } : it,
    );
    const r = await importar("extrato", linhas);
    expect(r).toMatchObject({ created: 0 });
  });

  // ERA DEFEITO (corrigido em set/2026): na semana ela mandou a compra da papelaria pra Empresa ("mandar pra outro perfil").
  // No extrato do mês a linha vem sem perfil, vai pro Pessoal, e as três comparações só olham o
  // perfil de destino (import-actions.ts:640, 552): a compra entra de novo no Pessoal, calada.
  it("linha mandada pra Empresa no extrato da semana não entra de novo no Pessoal no extrato do mês", async () => {
    const linhas = ["02/09/2026;KALUNGA PAPELARIA;-230,00", "05/09/2026;Padaria;-10,00"];
    await importar("extrato", linhas, undefined, (it) => (it.description.startsWith("KALUNGA") ? { ...it, profileId: "empresa" } : it));
    expect(doMes(2026, 9, "empresa")).toHaveLength(1);
    await importar("extrato", linhas);
    expect(doMes(2026, 9, "pessoal").map((e) => e.description)).toEqual(["Padaria"]);
  });
});

// ---------------------------------------------------------------- fatura que fecha em outro mês

describe("fatura que fecha em outro mês", () => {
  it("compras de agosto e setembro vão todas pro mês escolhido, sem dia", async () => {
    const r = await importar("fatura", ["14/08/2026;LOJA A;100,00", "28/08/2026;LOJA B;50,00", "10/09/2026;LOJA C;25,00"], "2026-09");
    expect(r).toMatchObject({ ok: true, created: 3 });
    expect(doMes(2026, 8)).toHaveLength(0);
    expect(doMes(2026, 9).every((e) => e.entryDate === null)).toBe(true);
  });

  it("a fatura parcial (em aberto) e depois a fechada, no mesmo mês: só entra o que é novo", async () => {
    await importar("fatura", ["01/09/2026;IFOOD;40,00", "02/09/2026;IFOOD;40,00", "03/09/2026;NETFLIX;39,90"], "2026-10");
    const r = await importar("fatura", ["01/09/2026;IFOOD;40,00", "02/09/2026;IFOOD;40,00", "03/09/2026;NETFLIX;39,90", "12/09/2026;IFOOD;40,00", "15/09/2026;ESTORNO NETFLIX;-39,90"], "2026-10");
    expect(r).toMatchObject({ created: 2, skipped: 3 });
    expect(gastouNoMes(2026, 10)).toBe(120); // 3 iFood; Netflix e o estorno dela se anulam
  });

  it("a assinatura que se repete todo mês entra nas duas faturas (meses diferentes não são duplicata)", async () => {
    await importar("fatura", ["03/08/2026;NETFLIX;39,90"], "2026-08");
    const r = await importar("fatura", ["03/09/2026;NETFLIX;39,90"], "2026-09");
    expect(r).toMatchObject({ created: 1, skipped: 0 });
  });

  it("parcela na fatura de dezembro projeta as seguintes em janeiro e fevereiro do ano seguinte", async () => {
    await importTransactionsAction([compra("CELULAR PARC 10/12", 250)], "fatura", 2026, 12);
    expect(doMes(2027, 1).map((e) => e.description)).toEqual(["CELULAR PARC 11/12"]);
    expect(doMes(2027, 2).map((e) => e.description)).toEqual(["CELULAR PARC 12/12"]);
    expect(banco).toHaveLength(3);
  });

  // ERA DEFEITO (corrigido em set/2026): o mês da fatura vem do seletor, que começa no mês de HOJE. Setembro subida em
  // setembro projeta a 04/10 em outubro; outubro subida já em novembro (o seletor ficou em
  // novembro) procura a 04/10 em NOVEMBRO, não acha, grava de novo e projeta 05..10 por cima das
  // que setembro já tinha projetado. Todas as parcelas restantes ficam em dobro.
  it("fatura de outubro lançada em novembro depois da de setembro não duplica as parcelas", async () => {
    await importTransactionsAction([compra("LOJA X PARC 03/10", 100)], "fatura", 2026, 9);
    await importTransactionsAction([compra("LOJA X PARC 04/10", 100)], "fatura", 2026, 11);
    expect(banco.filter((e) => e.description === "LOJA X PARC 10/10")).toHaveLength(1);
  });

  // Hoje a mesma fatura subida em dois meses diferentes (ela corrigiu o mês e subiu de novo)
  // entra inteira duas vezes: a checagem é por mês escolhido, e a revisão da fatura nem compara
  // com outras importações (import-actions.ts:314). Fica registrado como está hoje.
  it("a mesma fatura subida com outro mês escolhido entra inteira de novo (sem aviso)", async () => {
    const fatura = ["01/09/2026;LOJA A;100,00", "02/09/2026;LOJA B;50,00", "03/09/2026;LOJA C;25,00"];
    await importar("fatura", fatura, "2026-09");
    const items = await ler("fatura", fatura, "2026-10");
    expect(items.every((i) => !i.possivelDuplicata)).toBe(true);
    const r = await importTransactionsAction(confirmar(items), "fatura", 2026, 10);
    expect(r).toMatchObject({ created: 3 });
  });
});

// ---------------------------------------------------------------- parcelas e estornos

describe("parcelas e estornos na fatura", () => {
  it("estorno de uma parcela não projeta estornos nos meses seguintes nem conta como parcela", async () => {
    const r = await importTransactionsAction(
      [compra("LOJA Y PARC 02/05", 200), compra("ESTORNO LOJA Y PARC 02/05", 200, { estorno: true, installment: { current: 2, total: 5, confident: true } })],
      "fatura",
      2026,
      9,
    );
    expect(r).toMatchObject({ created: 5 }); // 02 + estorno em setembro, 03..05 projetadas
    expect(gastouNoMes(2026, 9)).toBe(0);
    expect(banco.filter((e) => e.amount < 0)).toHaveLength(1);
  });

  it("desfazer a fatura leva as parcelas projetadas por ela", async () => {
    await importTransactionsAction([compra("SOFA PARC 01/10", 300)], "fatura", 2026, 9);
    desfazer(banco[0].importBatchId!);
    expect(banco).toHaveLength(0);
  });

  it("a fatura lida do arquivo: crédito vira estorno negativo na categoria, e a compra e o estorno se anulam", async () => {
    await importar("fatura", ["01/09/2026;RENNER;199,90", "03/09/2026;RENNER;-199,90", "05/09/2026;PADARIA;20,00"], "2026-09");
    expect(gastouNoMes(2026, 9)).toBe(20);
  });

  it("parcela na fatura lida do arquivo ('Parcela 3/6') projeta 4/6..6/6 com o mesmo jeito de escrever", async () => {
    await importar("fatura", ["01/09/2026;Loja Z - Parcela 3/6;120,00", "02/09/2026;Padaria;20,00", "03/09/2026;Mercado;50,00"], "2026-09");
    expect(doMes(2026, 10).map((e) => e.description)).toEqual(["Loja Z - Parcela 4/6"]);
    expect(doMes(2026, 12).map((e) => e.description)).toEqual(["Loja Z - Parcela 6/6"]);
  });

  // Continua it.fails: tirar as parcelas sozinho é decisão de produto (o app nunca apaga gasto
  // sem ela ver, como no pagamento da fatura) e pede tela nova pra perguntar.
  // DEFEITO: compra parcelada cancelada. Setembro projetou 02..05; outubro traz a 02 e o estorno
  // dela (a loja cancelou). As faturas de novembro em diante não trazem mais nada da loja, mas as
  // parcelas projetadas 03..05 continuam lá: R$ 600 de gasto que não existe, e nenhum aviso.
  it.fails("compra parcelada cancelada (estorno na fatura) não deixa parcelas fantasmas nos meses seguintes", async () => {
    await importTransactionsAction([compra("LOJA Y PARC 01/05", 200)], "fatura", 2026, 9);
    await importTransactionsAction(
      [compra("LOJA Y PARC 02/05", 200), compra("ESTORNO LOJA Y", 1000, { estorno: true, installment: null })],
      "fatura",
      2026,
      10,
    );
    expect(doMes(2026, 11).filter((e) => e.description?.startsWith("LOJA Y"))).toHaveLength(0);
  });
});
