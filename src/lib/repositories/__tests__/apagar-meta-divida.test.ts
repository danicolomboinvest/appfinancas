import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * Apagar meta e dívida pelo menu "…", e o Desfazer (13/10/2026), contra um banco em memória que
 * entende as formas de `where` usadas nos repositórios. A conta Ana: Pessoal, Nós dois (Casal) e
 * Ateliê (Empresa); o Lucas é o par dela no Casal (logado com o userId dele, no perfil Casal).
 */

type Linha = Record<string, unknown> & { id: string };
const db: Record<string, Linha[]> = {};
let seq = 0;

function bate(linha: Record<string, unknown>, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([chave, cond]) => {
    if (cond === undefined) return true;
    const valor = linha[chave];
    if (cond !== null && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date)) {
      const c = cond as { in?: unknown[]; not?: unknown };
      if ("in" in c) return (c.in ?? []).includes(valor);
      if ("not" in c) return (valor ?? null) !== c.not;
      throw new Error(`where desconhecido: ${chave}`);
    }
    return (valor ?? null) === cond;
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
      return l;
    }),
    deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const antes = (db[nome] ?? []).length;
      db[nome] = (db[nome] ?? []).filter((l) => !bate(l, where));
      return { count: antes - db[nome].length };
    }),
  };
}

vi.mock("@/lib/db/prisma", () => {
  const prisma: Record<string, unknown> = Object.fromEntries(["goal", "monthlyEntry", "asset", "divida"].map((n) => [n, tabela(n)]));
  prisma.$transaction = async (arg: unknown) => (typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as Promise<unknown>[]));
  return { prisma };
});

// As actions: a sessão é a do teste; o revalidate não faz nada fora do Next.
let sessao: AuthContext;
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  getRequiredSession: vi.fn(async () => sessao),
  doDono: (ctx: AuthContext) => ({ userId: ctx.userId, profileId: ctx.profileId }),
}));

process.env.AUTH_SECRET = "segredo-de-teste";

const { apagarMeta, restaurarMeta } = await import("../goal.repo");
const { apagarDivida, restaurarDivida, listarDividas } = await import("../divida.repo");
const { criarRecibo, lerRecibo, VALIDADE_DO_RECIBO_MS } = await import("@/lib/desfazer/recibo");
const metas = await import("@/app/(app)/planejamento/metas/acoes");
const dividas = await import("@/app/(app)/dividas/actions");

const ANA = "ana";
const LUCAS = "lucas";
const naPessoal: AuthContext = { userId: ANA, role: "CLIENT", profileId: "pessoal", profileTheme: "padrao", profileKind: "PESSOAL" };
const naEmpresa: AuthContext = { ...naPessoal, profileId: "empresa", profileKind: "EMPRESA" };
const anaNoCasal: AuthContext = { ...naPessoal, profileId: "casal", profileKind: "CASAL" };
const lucasNoCasal: AuthContext = { ...anaNoCasal, userId: LUCAS };

const decimal = (v: string) => ({ toString: () => v, valueOf: () => Number(v) });

function meta(id: string, ctx: AuthContext, extra: Record<string, unknown> = {}) {
  db.goal.push({
    id,
    userId: ctx.userId,
    profileId: ctx.profileId,
    name: "Viagem para Lisboa",
    targetAmount: decimal("20000"),
    targetDate: new Date("2027-10-01T12:00:00Z"),
    currentAmount: decimal("1500"),
    monthlyContribution: decimal("800"),
    annualRate: decimal("0.1"),
    viagem: null,
    status: "ON_TRACK",
    icon: "VIAGEM",
    checkinDismissedMonth: "2026-10",
    fotoUrl: "/fotos/metas/europa.jpg",
    aporteAdiadoMes: null,
    aportesRecusados: ["e-recusado"],
    createdAt: new Date("2026-01-05T10:00:00Z"),
    ...extra,
  });
}

function divida(id: string, ctx: AuthContext) {
  db.divida.push({
    id,
    userId: ctx.userId,
    profileId: ctx.profileId,
    tipo: "rotativo",
    credor: "Nubank",
    apelido: "Fatura",
    paraQue: null,
    planejada: false,
    saldo: decimal("3200.5"),
    porMes: decimal("400"),
    parcelasAbertas: 8,
    parcelasTotal: 10,
    semParcela: false,
    taxaMensal: decimal("12.5"),
    diaVencimento: 10,
    atrasada: false,
    quitadaEm: null,
    createdAt: new Date("2026-09-01T10:00:00Z"),
  });
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.goal = [];
  db.monthlyEntry = [];
  db.asset = [];
  db.divida = [];
  sessao = naPessoal;
  meta("g1", naPessoal);
  db.monthlyEntry.push(
    { id: "e1", userId: ANA, profileId: "pessoal", goalId: "g1", amount: 800, category: "INVESTMENT_CONTRIBUTION" },
    { id: "e2", userId: ANA, profileId: "pessoal", goalId: "g1", amount: 500, category: "INVESTMENT_CONTRIBUTION" },
    { id: "e3", userId: ANA, profileId: "pessoal", goalId: null, amount: 90, category: "INVESTMENT_CONTRIBUTION" },
  );
  db.asset.push({ id: "a1", userId: ANA, profileId: "pessoal", goalId: "g1", objective: "META", currentValue: 3000 });
  divida("d1", naPessoal);
});

describe("apagar meta", () => {
  it("some só a meta: os aportes ficam nos meses e o ativo na Carteira", async () => {
    const r = await apagarMeta(naPessoal, "g1");
    expect(r?.meta.id).toBe("g1");
    expect(r?.aportes.sort()).toEqual(["e1", "e2"]);
    expect(db.goal).toHaveLength(0);
    expect(db.monthlyEntry.map((e) => [e.id, e.goalId, e.amount])).toEqual([
      ["e1", null, 800],
      ["e2", null, 500],
      ["e3", null, 90],
    ]);
    expect(db.asset[0]).toMatchObject({ id: "a1", goalId: null, objective: "OUTRO", currentValue: 3000 });
  });

  it("desfazer traz a meta igual, com o mesmo id, os aportes e o ativo com o objetivo de antes", async () => {
    const r = await apagarMeta(naPessoal, "g1");
    expect(await restaurarMeta(naPessoal, JSON.parse(JSON.stringify(r)))).toBe(true);
    expect(db.goal).toHaveLength(1);
    expect(db.goal[0]).toMatchObject({
      id: "g1",
      userId: ANA,
      profileId: "pessoal",
      name: "Viagem para Lisboa",
      targetAmount: "20000",
      currentAmount: "1500",
      icon: "VIAGEM",
      aportesRecusados: ["e-recusado"],
      checkinDismissedMonth: "2026-10",
    });
    expect((db.goal[0].createdAt as Date).toISOString()).toBe("2026-01-05T10:00:00.000Z");
    expect(db.monthlyEntry.filter((e) => e.goalId === "g1").map((e) => e.id)).toEqual(["e1", "e2"]);
    // O aporte que nunca foi da meta continua solto.
    expect(db.monthlyEntry.find((e) => e.id === "e3")?.goalId).toBeNull();
    expect(db.asset[0]).toMatchObject({ goalId: "g1", objective: "META" });
  });

  it("aporte ligado a outra meta nesse meio tempo fica onde está; desfazer duas vezes não duplica", async () => {
    const r = await apagarMeta(naPessoal, "g1");
    meta("g2", naPessoal, { name: "Carro" });
    db.monthlyEntry.find((e) => e.id === "e2")!.goalId = "g2";
    expect(await restaurarMeta(naPessoal, r!)).toBe(true);
    expect(await restaurarMeta(naPessoal, r!)).toBe(true);
    expect(db.goal.filter((g) => g.id === "g1")).toHaveLength(1);
    expect(db.monthlyEntry.find((e) => e.id === "e2")?.goalId).toBe("g2");
  });

  it("dono errado é recusado: o par no Casal, outro perfil da mesma conta", async () => {
    meta("gc", anaNoCasal, { name: "Casa nova" });
    expect(await apagarMeta(lucasNoCasal, "gc")).toBeNull();
    expect(await apagarMeta(naEmpresa, "g1")).toBeNull();
    expect(await apagarMeta(naPessoal, "gc")).toBeNull();
    expect(db.goal.map((g) => g.id).sort()).toEqual(["g1", "gc"]);
    expect(db.monthlyEntry.filter((e) => e.goalId === "g1")).toHaveLength(2);
    expect(db.asset[0]).toMatchObject({ goalId: "g1", objective: "META" });
  });

  it("isolamento por perfil: o desfazer só religa o que é do mesmo perfil", async () => {
    const r = await apagarMeta(naPessoal, "g1");
    // Um recibo forjado com um aporte da Empresa não puxa o lançamento de lá.
    db.monthlyEntry.push({ id: "eE", userId: ANA, profileId: "empresa", goalId: null, amount: 1, category: "INVESTMENT_CONTRIBUTION" });
    await restaurarMeta(naPessoal, { ...r!, aportes: [...r!.aportes, "eE"] });
    expect(db.monthlyEntry.find((e) => e.id === "eE")?.goalId).toBeNull();
  });

  it("casal: a titular apaga a meta do Nós dois e desfaz; o par não", async () => {
    meta("gc", anaNoCasal, { name: "Casa nova" });
    sessao = lucasNoCasal;
    expect(await metas.apagarMetaAction("gc")).toMatchObject({ ok: false });
    sessao = anaNoCasal;
    const r = await metas.apagarMetaAction("gc");
    expect(r.ok).toBe(true);
    const recibo = r.ok ? r.desfazer : null;
    expect(recibo).toBeTruthy();
    // O recibo da titular não vale na mão do par.
    sessao = lucasNoCasal;
    expect(await metas.desfazerApagarMetaAction(recibo!)).toMatchObject({ ok: false });
    expect(db.goal.some((g) => g.id === "gc")).toBe(false);
    sessao = anaNoCasal;
    expect(await metas.desfazerApagarMetaAction(recibo!)).toEqual({ ok: true });
    expect(db.goal.find((g) => g.id === "gc")).toMatchObject({ userId: ANA, profileId: "casal" });
  });

  it("pela action: apagar devolve o recibo e o Desfazer, no mesmo perfil, traz de volta", async () => {
    const r = await metas.apagarMetaAction("g1");
    expect(r.ok && r.desfazer).toBeTruthy();
    sessao = naEmpresa;
    expect(await metas.desfazerApagarMetaAction(r.ok ? r.desfazer! : "")).toMatchObject({ ok: false });
    sessao = naPessoal;
    expect(await metas.desfazerApagarMetaAction(r.ok ? r.desfazer! : "")).toEqual({ ok: true });
    expect(db.goal.map((g) => g.id)).toEqual(["g1"]);
    expect(await metas.apagarMetaAction("nao-existe")).toMatchObject({ ok: false });
  });
});

describe("apagar dívida", () => {
  it("apaga só a dívida do perfil e o Desfazer devolve igual, no mesmo lugar", async () => {
    const r = await apagarDivida(naPessoal, "d1");
    expect(r).toMatchObject({ id: "d1", saldo: 3200.5, taxaMensal: 12.5, parcelasAbertas: 8 });
    expect(db.divida).toHaveLength(0);
    expect(await restaurarDivida(naPessoal, JSON.parse(JSON.stringify(r)))).toBe(true);
    expect(await restaurarDivida(naPessoal, r!)).toBe(true);
    expect(db.divida).toHaveLength(1);
    expect(db.divida[0]).toMatchObject({ id: "d1", userId: ANA, profileId: "pessoal", credor: "Nubank", saldo: 3200.5, quitadaEm: null });
    expect((db.divida[0].createdAt as Date).toISOString()).toBe("2026-09-01T10:00:00.000Z");
    expect((await listarDividas(naPessoal)).map((d) => d.id)).toEqual(["d1"]);
  });

  it("dono errado é recusado (outra conta, outro perfil)", async () => {
    expect(await apagarDivida({ ...naPessoal, userId: LUCAS }, "d1")).toBeNull();
    expect(await apagarDivida(naEmpresa, "d1")).toBeNull();
    expect(db.divida).toHaveLength(1);
  });

  it("pela action, com o Desfazer preso a quem apagou", async () => {
    const r = await dividas.apagarDividaAction("d1");
    expect(r.ok).toBe(true);
    const recibo = r.ok ? r.desfazer! : "";
    sessao = naEmpresa;
    expect(await dividas.desfazerApagarDividaAction(recibo)).toMatchObject({ ok: false });
    sessao = naPessoal;
    expect(await dividas.desfazerApagarDividaAction(recibo)).toEqual({ ok: true });
    expect(db.divida.map((d) => d.id)).toEqual(["d1"]);
    expect(await dividas.apagarDividaAction("nao-existe")).toMatchObject({ ok: false });
  });
});

describe("recibo do Desfazer", () => {
  const dono = { userId: ANA, profileId: "pessoal" };
  it("lê o que assinou, e só para o mesmo tipo e dono, dentro do prazo", () => {
    const r = criarRecibo("meta", dono, { a: 1 }, 1000)!;
    expect(lerRecibo("meta", dono, r, 1000)).toEqual({ a: 1 });
    expect(lerRecibo("divida", dono, r, 1000)).toBeNull();
    expect(lerRecibo("meta", { ...dono, profileId: "empresa" }, r, 1000)).toBeNull();
    expect(lerRecibo("meta", { ...dono, userId: LUCAS }, r, 1000)).toBeNull();
    expect(lerRecibo("meta", dono, r, 1000 + VALIDADE_DO_RECIBO_MS + 1)).toBeNull();
  });
  it("recusa recibo mexido", () => {
    const r = criarRecibo("meta", dono, { a: 1 })!;
    const [corpo, sig] = r.split(".");
    const outro = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(corpo, "base64url").toString()), d: { a: 2 } })).toString("base64url");
    expect(lerRecibo("meta", dono, `${outro}.${sig}`)).toBeNull();
    expect(lerRecibo("meta", dono, "lixo")).toBeNull();
    expect(lerRecibo("meta", dono, 42)).toBeNull();
  });
});
