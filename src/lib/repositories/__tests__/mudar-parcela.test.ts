import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * O menu "…" das parcelas de Recorrentes (13/10/2026): Editar, Apagar esta compra, Não é parcela e
 * o Desfazer, contra um banco em memória que entende os `where` dos repositórios (AND, OR, in,
 * gte/lte, contains, startsWith). Hoje é 13/10/2026. A conta Ana: Pessoal, Empresa e o Casal com
 * o Lucas (logado com o userId dele, no perfil Casal).
 */

type Linha = Record<string, unknown> & { id: string };
const db: Record<string, Linha[]> = {};
let seq = 0;

function valorDe(v: unknown): unknown {
  if (v instanceof Date) return v.getTime();
  if (v !== null && typeof v === "object" && "valueOf" in v) return (v as { valueOf(): unknown }).valueOf();
  return v;
}

function bate(linha: Record<string, unknown>, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([chave, cond]) => {
    if (cond === undefined) return true;
    if (chave === "AND") return (cond as Record<string, unknown>[]).every((w) => bate(linha, w));
    if (chave === "OR") return (cond as Record<string, unknown>[]).some((w) => bate(linha, w));
    if (chave === "NOT") return !bate(linha, cond as Record<string, unknown>);
    const valor = valorDe(linha[chave] ?? null);
    if (cond !== null && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      return Object.entries(c).every(([op, alvo]) => {
        const a = valorDe(alvo);
        const insensivel = c.mode === "insensitive";
        const txt = (x: unknown) => (insensivel ? String(x ?? "").toLowerCase() : String(x ?? ""));
        switch (op) {
          case "in":
            return (alvo as unknown[]).includes(valor);
          case "not":
            return valor !== (a ?? null);
          case "gt":
            return valor !== null && (valor as number) > (a as number);
          case "gte":
            return valor !== null && (valor as number) >= (a as number);
          case "lt":
            return valor !== null && (valor as number) < (a as number);
          case "lte":
            return valor !== null && (valor as number) <= (a as number);
          case "contains":
            return valor !== null && txt(valor).includes(txt(alvo));
          case "startsWith":
            return valor !== null && txt(valor).startsWith(txt(alvo));
          case "mode":
          case "is":
            return true;
          default:
            throw new Error(`where desconhecido: ${chave}.${op}`);
        }
      });
    }
    return valor === (valorDe(cond) ?? null);
  });
}

function tabela(nome: string) {
  return {
    findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => (db[nome] ?? []).filter((l) => bate(l, where)).map((l) => ({ ...l }))),
    findFirst: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
      const l = (db[nome] ?? []).find((x) => bate(x, where));
      return l ? { ...l } : null;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const alvo = (db[nome] ?? []).filter((l) => bate(l, where));
      for (const l of alvo) Object.assign(l, data);
      return { count: alvo.length };
    }),
    create: vi.fn(async ({ data }: { data: Linha }) => {
      if (data.id && (db[nome] ?? []).some((l) => l.id === data.id)) throw new Error("P2002");
      const l = { ...data, id: data.id ?? `${nome}-${++seq}` };
      (db[nome] ??= []).push(l);
      return { ...l };
    }),
    deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const antes = (db[nome] ?? []).length;
      db[nome] = (db[nome] ?? []).filter((l) => !bate(l, where));
      return { count: antes - db[nome].length };
    }),
  };
}

vi.mock("@/lib/db/prisma", () => {
  const prisma: Record<string, unknown> = Object.fromEntries(["monthlyEntry", "contaAPagar", "contaRecusada"].map((n) => [n, tabela(n)]));
  prisma.$transaction = async (arg: unknown) => (typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as Promise<unknown>[]));
  return { prisma };
});

let sessao: AuthContext;
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => new Date(2026, 9, 13, 10) }));
vi.mock("@/lib/auth/session", () => ({
  getRequiredSession: vi.fn(async () => sessao),
  doDono: (ctx: AuthContext) => ({ userId: ctx.userId, profileId: ctx.profileId }),
}));

process.env.AUTH_SECRET = "segredo-de-teste";

const acoes = await import("@/app/(app)/orcamento/contas/parcelas-actions");
const { listarLancamentosParcelaveis } = await import("../monthly-entry.repo");
const { listarRecusasDeParcela } = await import("../parcelas.repo");
const { parcelasDoMes, ehParcelaDela, projecaoRecusada } = await import("@/lib/contas/parcelas-do-mes");

const ANA = "ana";
const LUCAS = "lucas";
const naPessoal: AuthContext = { userId: ANA, role: "CLIENT", profileId: "pessoal", profileTheme: "padrao", profileKind: "PESSOAL" };
const naEmpresa: AuthContext = { ...naPessoal, profileId: "empresa", profileKind: "EMPRESA" };
const OUTUBRO = { year: 2026, month: 10 };

const decimal = (v: number) => ({ toString: () => String(v), valueOf: () => v, toFixed: (n: number) => v.toFixed(n) });

function lancamento(ctx: AuthContext, year: number, month: number, description: string, amount: number, extra: Record<string, unknown> = {}) {
  const id = `e-${++seq}`;
  (db.monthlyEntry ??= []).push({
    id,
    userId: ctx.userId,
    profileId: ctx.profileId,
    year,
    month,
    category: "EXPENSE",
    parentCategory: "LAZER",
    customCategoryId: null,
    subcategory: null,
    description,
    amount: decimal(amount),
    entryDate: new Date(Date.UTC(year, month - 1, 5, 12)),
    goalId: null,
    importBatchId: "lote-1",
    pessoa: null,
    doCasal: null,
    noCartao: true,
    autorUserId: null,
    soMeu: false,
    createdAt: new Date("2026-08-06T12:00:00Z"),
    ...extra,
  });
  return id;
}

/** A Amazon 7/10 de agosto, com as seguintes projetadas pela fatura até novembro (10/10). */
function amazon(ctx: AuthContext = naPessoal) {
  return [7, 8, 9, 10].map((n) => lancamento(ctx, 2026, 8 + (n - 7), `Amazon Marketplace Cc (${n}/10)`, 120));
}

async function parcelasDe(ctx: AuthContext) {
  sessao = ctx;
  const [lancs, recusas] = await Promise.all([listarLancamentosParcelaveis(ctx, OUTUBRO), listarRecusasDeParcela(ctx)]);
  return parcelasDoMes(lancs, OUTUBRO, [], recusas);
}

const daCompra = (ctx: AuthContext = naPessoal) =>
  (db.monthlyEntry ?? [])
    .filter((l) => l.userId === ctx.userId && l.profileId === ctx.profileId && String(l.description).startsWith("Amazon"))
    .sort((a, b) => (a.year as number) * 12 + (a.month as number) - ((b.year as number) * 12 + (b.month as number)))
    .map((l) => `${l.month}:${l.description}:${Number(valorDe(l.amount))}`);

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  seq = 0;
  sessao = naPessoal;
});

describe("Editar parcela", () => {
  it("muda valor e total deste mês em diante; cria as que faltam; o passado só acompanha o N/T", async () => {
    const [, , outubro] = amazon();
    const r = await acoes.editarParcelaAction(outubro, { valor: 100, atual: 9, total: 12, dia: 20, categoria: "EDUCACAO" });
    expect(r.ok).toBe(true);
    expect(daCompra()).toEqual([
      "8:Amazon Marketplace Cc (7/12):120",
      "9:Amazon Marketplace Cc (8/12):120",
      "10:Amazon Marketplace Cc (9/12):100",
      "11:Amazon Marketplace Cc (10/12):100",
      "12:Amazon Marketplace Cc (11/12):100",
      "1:Amazon Marketplace Cc (12/12):100",
    ]);
    const out = db.monthlyEntry.find((l) => l.id === outubro)!;
    expect(out.parentCategory).toBe("EDUCACAO");
    expect((out.entryDate as Date).getUTCDate()).toBe(20);
    // Recorrentes vê a nova: 9 de 12, R$ 100.
    const { itens, total } = await parcelasDe(naPessoal);
    expect(itens.map((i) => [i.atual, i.total, i.valor])).toEqual([[9, 12, 100]]);
    expect(total).toBe(100);
  });

  it("editar de novo depois de mudar o valor ainda acha as pagas (uma compra só)", async () => {
    const [, , outubro] = amazon();
    await acoes.editarParcelaAction(outubro, { valor: 100, atual: 9, total: 12, dia: null, categoria: null });
    const r = await acoes.editarParcelaAction(outubro, { valor: 100, atual: 9, total: 11, dia: null, categoria: null });
    expect(r.ok).toBe(true);
    expect(daCompra()).toEqual([
      "8:Amazon Marketplace Cc (7/11):120",
      "9:Amazon Marketplace Cc (8/11):120",
      "10:Amazon Marketplace Cc (9/11):100",
      "11:Amazon Marketplace Cc (10/11):100",
      "12:Amazon Marketplace Cc (11/11):100",
    ]);
    expect((await parcelasDe(naPessoal)).itens).toHaveLength(1);
  });

  it("encurtar apaga os meses que passaram do novo fim", async () => {
    const [, , outubro] = amazon();
    await acoes.editarParcelaAction(outubro, { valor: 120, atual: 10, total: 10, dia: null, categoria: null });
    expect(daCompra()).toEqual(["8:Amazon Marketplace Cc (8/10):120", "9:Amazon Marketplace Cc (9/10):120", "10:Amazon Marketplace Cc (10/10):120"]);
  });

  it("Desfazer volta tudo como era (inclusive as criadas somem)", async () => {
    const [, , outubro] = amazon();
    const antes = daCompra();
    const r = await acoes.editarParcelaAction(outubro, { valor: 100, atual: 9, total: 12, dia: 20, categoria: "EDUCACAO" });
    if (!r.ok || !r.desfazer) throw new Error("sem recibo");
    expect((await acoes.desfazerParcelaAction(r.desfazer)).ok).toBe(true);
    expect(daCompra()).toEqual(antes);
    expect(db.monthlyEntry.find((l) => l.id === outubro)!.parentCategory).toBe("LAZER");
  });

  it("a prevista (sem lançamento no mês) ganha o lançamento ao editar", async () => {
    // Fatura antiga: só agosto (7/10). Outubro é prevista.
    lancamento(naPessoal, 2026, 8, "Amazon Marketplace Cc (7/10)", 120);
    const { itens } = await parcelasDe(naPessoal);
    expect(itens[0].origem).toBe("prevista");
    const r = await acoes.editarParcelaAction(itens[0].chave, { valor: 120, atual: 9, total: 10, dia: null, categoria: null });
    expect(r.ok).toBe(true);
    expect(daCompra()).toEqual(["8:Amazon Marketplace Cc (7/10):120", "10:Amazon Marketplace Cc (9/10):120", "11:Amazon Marketplace Cc (10/10):120"]);
  });

  it("recusa número que não fecha", async () => {
    const [, , outubro] = amazon();
    const r = await acoes.editarParcelaAction(outubro, { valor: 100, atual: 11, total: 10, dia: null, categoria: null });
    expect(r.ok).toBe(false);
  });
});

describe("Apagar esta compra", () => {
  it("tira este mês e os projetados; os passados ficam e a compra não volta como prevista", async () => {
    const [, , outubro] = amazon();
    const r = await acoes.apagarCompraAction(outubro, false);
    expect(r.ok).toBe(true);
    expect(daCompra()).toEqual(["8:Amazon Marketplace Cc (7/10):120", "9:Amazon Marketplace Cc (8/10):120"]);
    expect((await parcelasDe(naPessoal)).itens).toEqual([]);
  });

  it("com 'apagar também as que já passaram' some tudo", async () => {
    const [, , outubro] = amazon();
    await acoes.apagarCompraAction(outubro, true);
    expect(daCompra()).toEqual([]);
    expect(db.contaRecusada ?? []).toEqual([]);
  });

  it("leva junto a conta parcelada cadastrada que é a mesma compra", async () => {
    const [, , outubro] = amazon();
    db.contaAPagar = [{ id: "c1", userId: ANA, profileId: "pessoal", nome: "Amazon", valor: decimal(120), parcelas: 10, parcelaAtual: 9, quitada: false, diaDoMes: 5, categoria: null, vencimento: new Date("2026-10-05T00:00:00Z") }];
    await acoes.apagarCompraAction(outubro, false);
    expect(db.contaAPagar).toEqual([]);
  });

  it("Desfazer devolve os lançamentos, a conta e esquece a compra apagada", async () => {
    const [, , outubro] = amazon();
    db.contaAPagar = [{ id: "c1", userId: ANA, profileId: "pessoal", nome: "Amazon", valor: decimal(120), parcelas: 10, parcelaAtual: 9, quitada: false, diaDoMes: 5, categoria: null, vencimento: new Date("2026-10-05T00:00:00Z") }];
    const antes = daCompra();
    const r = await acoes.apagarCompraAction(outubro, false);
    if (!r.ok || !r.desfazer) throw new Error("sem recibo");
    expect((await acoes.desfazerParcelaAction(r.desfazer)).ok).toBe(true);
    expect(daCompra()).toEqual(antes);
    expect(db.contaAPagar.map((c) => c.id)).toEqual(["c1"]);
    expect(db.contaRecusada).toEqual([]);
    expect((await parcelasDe(naPessoal)).itens).toHaveLength(1);
  });

  it("a conta parcelada cadastrada sozinha também apaga", async () => {
    db.contaAPagar = [{ id: "c2", userId: ANA, profileId: "pessoal", nome: "Geladeira", valor: decimal(300), parcelas: 10, parcelaAtual: 3, quitada: false, diaDoMes: 10, categoria: "MORADIA", vencimento: new Date("2026-10-10T00:00:00Z") }];
    const r = await acoes.apagarCompraAction("conta:c2", false);
    expect(r.ok).toBe(true);
    expect(db.contaAPagar).toEqual([]);
  });
});

describe("Não é parcela", () => {
  it("some de Recorrentes, os meses projetados saem e não volta (nem na importação)", async () => {
    lancamento(naPessoal, 2026, 10, "Posto Shell (3/6)", 80);
    const nov = lancamento(naPessoal, 2026, 11, "Posto Shell (4/6)", 80);
    const { itens } = await parcelasDe(naPessoal);
    const posto = itens.find((i) => i.nome.startsWith("Posto"))!;
    const r = await acoes.naoEParcelaAction(posto.chave);
    expect(r.ok).toBe(true);
    // O de outubro fica como gasto comum; o projetado de novembro some.
    expect(db.monthlyEntry.map((l) => l.description)).toEqual(["Posto Shell (3/6)"]);
    expect(db.monthlyEntry.some((l) => l.id === nov)).toBe(false);
    // Recorrentes e o gasto da semana não contam mais.
    const recusas = await listarRecusasDeParcela(naPessoal);
    expect((await parcelasDe(naPessoal)).itens).toEqual([]);
    expect(ehParcelaDela("Posto Shell (3/6)", true, recusas)).toBe(false);
    // Uma fatura nova com a mesma série não é projetada de novo.
    expect(projecaoRecusada(recusas, "POSTO SHELL (5/6)", 6, 2026 * 12 + 11 - 4)).toBe(true);
    expect(projecaoRecusada(recusas, "Netflix (2/3)", 3, 2026 * 12)).toBe(false);
  });

  it("Desfazer volta a ser parcela, com o projetado", async () => {
    lancamento(naPessoal, 2026, 10, "Posto Shell (3/6)", 80);
    lancamento(naPessoal, 2026, 11, "Posto Shell (4/6)", 80);
    const { itens } = await parcelasDe(naPessoal);
    const r = await acoes.naoEParcelaAction(itens[0].chave);
    if (!r.ok || !r.desfazer) throw new Error("sem recibo");
    await acoes.desfazerParcelaAction(r.desfazer);
    expect(db.monthlyEntry.map((l) => l.description)).toEqual(["Posto Shell (3/6)", "Posto Shell (4/6)"]);
    expect((await parcelasDe(naPessoal)).itens).toHaveLength(1);
  });

  it("não vale para a conta cadastrada (ela mesma disse que era parcelada)", async () => {
    db.contaAPagar = [{ id: "c3", userId: ANA, profileId: "pessoal", nome: "Sofá", valor: decimal(200), parcelas: 5, parcelaAtual: 2, quitada: false, diaDoMes: 10, categoria: null, vencimento: new Date("2026-10-10T00:00:00Z") }];
    expect((await acoes.naoEParcelaAction("conta:c3")).ok).toBe(false);
  });
});

describe("Isolamento", () => {
  it("de outro perfil não acha a parcela nem mexe", async () => {
    const [, , outubro] = amazon(naPessoal);
    sessao = naEmpresa;
    expect((await acoes.apagarCompraAction(outubro, true)).ok).toBe(false);
    expect((await acoes.editarParcelaAction(outubro, { valor: 1, atual: 9, total: 10, dia: null, categoria: null })).ok).toBe(false);
    expect((await acoes.naoEParcelaAction(outubro)).ok).toBe(false);
    expect(daCompra(naPessoal)).toHaveLength(4);
  });

  it("o recibo de uma não desfaz na outra", async () => {
    const [, , outubro] = amazon(naPessoal);
    const r = await acoes.apagarCompraAction(outubro, false);
    if (!r.ok || !r.desfazer) throw new Error("sem recibo");
    sessao = naEmpresa;
    expect((await acoes.desfazerParcelaAction(r.desfazer)).ok).toBe(false);
    expect(daCompra(naPessoal)).toHaveLength(2);
  });

  it("Casal: o par vê a parcela dela sem poder mudar; só quem lançou edita", async () => {
    const anaNoCasal: AuthContext = { ...naPessoal, profileId: "casal-ana", profileKind: "PESSOAL" };
    const lucasNoCasal: AuthContext = { ...naPessoal, userId: LUCAS, profileId: "casal-lucas", profileKind: "PESSOAL" };
    const casa = (eu: AuthContext, outro: AuthContext) => ({
      eu: { userId: eu.userId, profileId: eu.profileId, nome: "Eu", papel: "titular", letra: "A" },
      outro: { userId: outro.userId, profileId: outro.profileId, nome: "Outro", papel: "par", letra: "B" },
    });
    const ana = { ...anaNoCasal, casa: casa(anaNoCasal, lucasNoCasal) } as unknown as AuthContext;
    const lucas = { ...lucasNoCasal, casa: casa(lucasNoCasal, anaNoCasal) } as unknown as AuthContext;
    const [, , outubro] = amazon(ana);
    db.importBatch = [];
    // O Lucas vê (a casa mostra o do outro) mas não pode mudar.
    const vista = await parcelasDe(lucas);
    expect(vista.itens.map((i) => [i.chave, i.editavel])).toEqual([[outubro, false]]);
    sessao = lucas;
    expect((await acoes.apagarCompraAction(outubro, true)).ok).toBe(false);
    expect(daCompra(ana)).toHaveLength(4);
    // Ela pode.
    expect((await parcelasDe(ana)).itens[0].editavel).toBe(true);
    sessao = ana;
    expect((await acoes.apagarCompraAction(outubro, false)).ok).toBe(true);
  });
});
