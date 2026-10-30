import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Atualizar com o extrato novo" e foto no lugar do PDF (30/10/2026), com o banco de dados trocado
 * por uma lista em memória. Em 14 dias, 68 pessoas subiram o mesmo arquivo de novo 195 vezes e
 * 31 subiram uma imagem onde o app esperava o arquivo do banco. O que fica protegido:
 * - o mesmo arquivo duas vezes = 0 novos; arquivo com 3 novos e 5 repetidos = 3 novos;
 * - duas compras iguais no mesmo dia num arquivo NOVO entram as duas (só se compara com o que
 *   já está gravado, e no máximo se pula tantos quanto já existem);
 * - a fatura gravada inteira no mês do vencimento (sem dia) subida de novo já aparece na leitura
 *   como "já estava no app";
 * - a imagem subida como extrato vai para o leitor de print e volta como fatura aberta.
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
const lotes = new Map<string, { docType: string; faturaAberta: boolean }>();
let proximoId = 0;

/** O pedaço do `where` do Prisma que o import usa. Condição que o teste não conhece: passa. */
function bate(e: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([campo, cond]) => {
    if (campo === "OR") return (cond as Record<string, unknown>[]).some((w) => bate(e, w));
    if (campo === "importBatch") {
      const is = (cond as { is?: { docType?: string; faturaAberta?: boolean } }).is ?? {};
      const l = e.importBatchId === null ? null : lotes.get(e.importBatchId as string);
      if (!l) return false;
      return (is.docType === undefined || l.docType === is.docType) && (is.faturaAberta === undefined || l.faturaAberta === is.faturaAberta);
    }
    if (!(campo in e)) return true;
    const valor = e[campo];
    if (cond === null) return valor === null || valor === undefined;
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { not?: unknown; in?: unknown[]; gte?: Date; lte?: Date };
      if ("in" in c) return c.in!.includes(valor);
      if ("not" in c) return c.not === null ? valor !== null && valor !== undefined : valor !== c.not;
      if (c.gte instanceof Date || c.lte instanceof Date) {
        if (!(valor instanceof Date)) return false;
        return (!c.gte || valor >= c.gte) && (!c.lte || valor <= c.lte);
      }
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
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    customCategory: { findMany: vi.fn(async () => []) },
    importBatch: { count: vi.fn(async () => 0) },
    cartao: { findMany: vi.fn(async () => []) },
    contaRecusada: { findMany: vi.fn(async () => []) },
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
  createImportBatch: vi.fn(async (_ctx: unknown, { docType, faturaAberta }: { docType: string; faturaAberta?: boolean }) => {
    const id = `lote-${++lote}`;
    lotes.set(id, { docType, faturaAberta: faturaAberta === true });
    return { id };
  }),
  deleteEmptyImportBatch: vi.fn(async () => {}),
  deleteImportBatchWithEntries: vi.fn(async () => 0),
}));
vi.mock("@/lib/repositories/profile.repo", () => ({ listProfiles: vi.fn(async () => [{ id: "pessoal" }, { id: "empresa" }]) }));
vi.mock("@/lib/repositories/decisao.repo", () => ({ descricoesOriginais: vi.fn(async () => new Map()), registrarDecisao: vi.fn(async () => {}) }));
vi.mock("@/lib/repositories/custom-category.repo", () => ({ listCustomCategories: vi.fn(async () => []), garantirCuidadoPessoal: vi.fn(async () => null) }));
vi.mock("@/lib/repositories/transaction-rule.repo", () => ({
  listTransactionRules: vi.fn(async () => []),
  upsertTransactionRule: vi.fn(async () => {}),
  aplicarNosOutrosMeses: vi.fn(async () => {}),
}));
const { recordImportDiagnostic } = vi.hoisted(() => ({ recordImportDiagnostic: vi.fn(async () => "diag") }));
vi.mock("@/lib/repositories/import-diagnostic.repo", () => ({
  recordImportDiagnostic,
  isPartialRead: vi.fn(() => false),
  mensagemImplausivel: vi.fn(() => ""),
  safeHeader: vi.fn(() => ""),
  MARCA_CONFERIDO: "[conferido]",
  MARCA_NAO_FECHOU: "[não fechou]",
}));
vi.mock("@/lib/repositories/import-file.repo", () => ({ storeFailedImportFile: vi.fn(async () => {}) }));
// O OCR (tesseract) não roda no teste: o leitor de print devolve o que o "print" tinha, ou nada.
const { lerImagensComoPrints } = vi.hoisted(() => ({ lerImagensComoPrints: vi.fn() }));
vi.mock("@/lib/import/foto-no-lugar-do-pdf-servidor", () => ({ lerImagensComoPrints, paginasDoPdfComoImagens: vi.fn(async () => []) }));

const { importTransactionsAction, parseStatementAction } = await import("../import-actions");
const { MSG_FOTO_SEM_EXTRATO, MSG_FOTO_SEM_FATURA } = await import("@/lib/import/foto-no-lugar-do-pdf");

/** Lê um CSV "Data;Descrição;Valor" como a tela faria. */
async function ler(docType: "extrato" | "fatura", linhas: string[], nome = `${docType}.csv`) {
  const form = new FormData();
  form.set("file", new File([["Data;Descrição;Valor", ...linhas].join("\n")], nome));
  form.set("encoding", "text");
  form.set("docType", docType);
  const r = await parseStatementAction(form);
  if (!r.ok) throw new Error(r.error);
  return r;
}

/**
 * Lê e grava como a tela: o que a leitura deu como "já estava no app" vindo de outro arquivo vai
 * marcado `jaEstava` (só gasta a vaga do gravado igual) e volta contado em `pulados`.
 */
async function importar(docType: "extrato" | "fatura", linhas: string[], mes?: { year: number; month: number }, nome?: string) {
  const r = await ler(docType, linhas, nome);
  const confirmados = r.items.filter((it) => !it.ignorar && (!it.jaNoApp || !it.jaNoApp.id)).map((it) => ({ ...it, learn: false, jaEstava: !!it.jaNoApp }));
  const g = await importTransactionsAction(confirmados, docType, mes?.year, mes?.month, nome ?? `${docType}.csv`, undefined, undefined, docType === "fatura" ? { vencimento: r.stats.vencimento, fechamento: r.stats.fechamento } : null);
  if (!g.ok) throw new Error(g.error);
  return { leitura: r, jaEstavam: r.items.filter((it) => !it.ignorar && it.jaNoApp).length, novos: g.created, pulados: g.skipped };
}

beforeEach(() => {
  banco.length = 0;
  lotes.clear();
  lerImagensComoPrints.mockReset();
});

const EXTRATO = ["03/09/2026;Salário;5000,00", "05/09/2026;PADARIA DO ZE;-12,50", "05/09/2026;UBER TRIP;-23,90", "10/09/2026;PIX ENVIADO MARIA;-100,00", "12/09/2026;NETFLIX.COM;-39,90"];

describe("atualizar com o extrato novo", () => {
  it("o mesmo arquivo duas vezes: 0 novos, e a leitura já diz que tudo estava no app", async () => {
    const primeira = await importar("extrato", EXTRATO);
    expect(primeira).toMatchObject({ jaEstavam: 0, novos: 5, pulados: 0 });
    const segunda = await importar("extrato", EXTRATO);
    expect(segunda).toMatchObject({ jaEstavam: 5, novos: 0, pulados: 5 });
    expect(banco).toHaveLength(5);
  });

  it("o extrato do mês inteiro depois do da primeira quinzena: entram só os 3 novos, os 5 repetidos ficam de fora", async () => {
    await importar("extrato", EXTRATO);
    const mesInteiro = [...EXTRATO, "18/09/2026;FARMACIA;-45,00", "20/09/2026;IFOOD;-62,30", "25/09/2026;PIX RECEBIDO JOAO;150,00"];
    const r = await importar("extrato", mesInteiro);
    expect(r).toMatchObject({ jaEstavam: 5, novos: 3, pulados: 5 });
    expect(banco).toHaveLength(8);
    expect(banco.map((e) => e.description)).toEqual(expect.arrayContaining(["FARMACIA", "IFOOD", "PIX RECEBIDO JOAO"]));
  });

  it("duas compras iguais no mesmo dia num arquivo novo entram as duas", async () => {
    const r = await importar("extrato", ["05/09/2026;CAFE DA ESQUINA;-6,00", "05/09/2026;CAFE DA ESQUINA;-6,00"]);
    expect(r).toMatchObject({ jaEstavam: 0, novos: 2, pulados: 0 });
    expect(banco.filter((e) => e.description === "CAFE DA ESQUINA")).toHaveLength(2);
  });

  it("só pula tantos quanto já existem: um café já no app e dois no arquivo novo, entra um", async () => {
    await importar("extrato", ["05/09/2026;CAFE DA ESQUINA;-6,00"]);
    const r = await importar("extrato", ["05/09/2026;CAFE DA ESQUINA;-6,00", "05/09/2026;CAFE DA ESQUINA;-6,00"]);
    expect(r).toMatchObject({ jaEstavam: 1, novos: 1, pulados: 1 });
    expect(banco.filter((e) => e.description === "CAFE DA ESQUINA")).toHaveLength(2);
  });

  it("a gravação também segura: o que a leitura não marcou e já existe é pulado, não duplicado", async () => {
    await importar("extrato", EXTRATO);
    // A tela manda tudo (como se ela tivesse respondido "anotar também" em todas).
    const r = await ler("extrato", EXTRATO);
    const g = await importTransactionsAction(r.items.map((it) => ({ ...it, jaNoApp: null, learn: false })), "extrato");
    expect(g).toMatchObject({ ok: true, created: 0, skipped: 5 });
    expect(banco).toHaveLength(5);
  });
});

describe("a mesma fatura de novo", () => {
  const FATURA = ["02/09/2026;AMAZON;120,00", "04/09/2026;NETFLIX.COM;39,90", "04/09/2026;UBER TRIP;18,40", "06/09/2026;IFOOD;55,00"];
  const OUT = { year: 2026, month: 10 };

  it("gravada inteira no mês do vencimento, sem dia: a segunda leitura já diz que tudo estava no app, e nada entra", async () => {
    const primeira = await importar("fatura", FATURA, OUT, "Nubank_2026-10-10.csv");
    expect(primeira).toMatchObject({ novos: 4, pulados: 0 });
    expect(banco.every((e) => e.entryDate === null && e.month === 10)).toBe(true);
    const segunda = await importar("fatura", FATURA, OUT, "Nubank_2026-10-10.csv");
    expect(segunda).toMatchObject({ jaEstavam: 4, novos: 0, pulados: 4 });
    expect(segunda.leitura.items.every((it) => it.jaNoApp?.importado)).toBe(true);
    expect(banco).toHaveLength(4);
  });

  it("a fatura fechada depois do print parcial: entram só as compras que faltavam", async () => {
    await importar("fatura", FATURA.slice(0, 2), OUT, "Nubank_2026-10-10.csv");
    const r = await importar("fatura", FATURA, OUT, "Nubank_2026-10-10.csv");
    expect(r).toMatchObject({ jaEstavam: 2, novos: 2, pulados: 2 });
    expect(banco).toHaveLength(4);
  });

  it("duas compras iguais na fatura nova entram as duas; com uma já no app, entra uma", async () => {
    const r1 = await importar("fatura", ["04/09/2026;UBER TRIP;18,40", "04/09/2026;UBER TRIP;18,40"], OUT, "Nubank_2026-10-10.csv");
    expect(r1).toMatchObject({ jaEstavam: 0, novos: 2 });
    const r2 = await importar("fatura", ["04/09/2026;UBER TRIP;18,40", "04/09/2026;UBER TRIP;18,40", "04/09/2026;UBER TRIP;18,40"], OUT, "Nubank_2026-10-10.csv");
    expect(r2).toMatchObject({ jaEstavam: 2, novos: 1, pulados: 2 });
    expect(banco.filter((e) => e.description === "UBER TRIP")).toHaveLength(3);
  });
});

describe("foto no lugar do PDF", () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1]);
  const print = { linhas: [{ data: "2026-10-03", nome: "Ifood", valor: 55, sinal: null, credito: false, parcela: null, categoriaDoBanco: null }, { data: "2026-10-05", nome: "Uber", valor: 18.4, sinal: null, credito: false, parcela: null, categoriaDoBanco: null }], cabecalhoNoFim: null, totalDaFatura: null };

  it("a imagem subida como extrato vai para o leitor de print e volta como fatura aberta, com as compras", async () => {
    lerImagensComoPrints.mockResolvedValue({ prints: [print], banco: "Nubank" });
    const form = new FormData();
    form.set("file", new File([PNG], "IMG_2041.jpg"));
    form.set("encoding", "text");
    form.set("docType", "extrato");
    const r = await parseStatementAction(form);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(lerImagensComoPrints).toHaveBeenCalledTimes(1);
    expect(r.stats.faturaAberta).toBe(true);
    expect(r.stats.detectedKind).toBe("fatura");
    expect(r.items.map((i) => [i.description, i.amount, i.category])).toEqual([["Ifood", 55, "EXPENSE"], ["Uber", 18.4, "EXPENSE"]]);
    // O diagnóstico guarda de que arquivo veio.
    expect(recordImportDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ ok: true, fileName: "IMG_2041.jpg", encoding: "imagem" }));
  });

  it("a imagem em que o leitor de print não acha fatura: a mensagem curta diz o que mandar", async () => {
    lerImagensComoPrints.mockResolvedValue(null);
    const form = new FormData();
    form.set("file", new File([PNG], "IMG_2041.jpg"));
    form.set("encoding", "text");
    form.set("docType", "fatura");
    const r = await parseStatementAction(form);
    expect(r).toEqual({ ok: false, error: MSG_FOTO_SEM_FATURA });
    expect(recordImportDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ ok: false, kind: "foto-sem-fatura" }));
  });

  it("subida como extrato, sem banco nem total no print: não vira fatura, a mensagem é a de extrato", async () => {
    lerImagensComoPrints.mockResolvedValue({ prints: [print], banco: null });
    const form = new FormData();
    form.set("file", new File([PNG], "IMG_2041.jpg"));
    form.set("encoding", "text");
    form.set("docType", "extrato");
    const r = await parseStatementAction(form);
    expect(r).toEqual({ ok: false, error: MSG_FOTO_SEM_EXTRATO });
  });

  it("subida como extrato, com o total da fatura no print: segue como fatura aberta", async () => {
    lerImagensComoPrints.mockResolvedValue({ prints: [{ ...print, totalDaFatura: 73.4 }], banco: null });
    const form = new FormData();
    form.set("file", new File([PNG], "IMG_2041.jpg"));
    form.set("encoding", "text");
    form.set("docType", "extrato");
    const r = await parseStatementAction(form);
    expect(r.ok && r.stats.faturaAberta).toBe(true);
  });

  it("o arquivo de texto do banco nem passa pelo leitor de print", async () => {
    await ler("extrato", EXTRATO);
    expect(lerImagensComoPrints).not.toHaveBeenCalled();
  });
});
