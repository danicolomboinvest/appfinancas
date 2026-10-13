import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * Mover lançamentos já importados de um perfil para outro (12/10/2026), contra um banco em
 * memória que entende as mesmas formas de `where` do Prisma usadas no repositório. A conta Ana:
 * Pessoal, Nós dois (Casal) e Ateliê da Ana (Empresa), e o Lucas, par dela no Casal.
 */

type Linha = Record<string, unknown> & { id: string; userId: string; profileId: string };

const db: Record<string, Linha[]> = {};
let seq = 0;

function bate(linha: Record<string, unknown>, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([chave, cond]) => {
    if (cond === undefined) return true;
    if (chave === "OR") return (cond as Record<string, unknown>[]).some((w) => bate(linha, w));
    if (chave === "AND") return (cond as Record<string, unknown>[]).every((w) => bate(linha, w));
    const valor = linha[chave];
    if (cond !== null && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date)) {
      const c = cond as { in?: unknown[]; not?: unknown; startsWith?: string; mode?: string };
      if ("in" in c) return (c.in ?? []).includes(valor);
      if ("not" in c) return valor !== c.not;
      if ("startsWith" in c) return typeof valor === "string" && valor.toLowerCase().startsWith(String(c.startsWith).toLowerCase());
      throw new Error(`where desconhecido: ${chave}`);
    }
    return (valor ?? null) === cond;
  });
}

function tabela(nome: string) {
  db[nome] ??= [];
  return {
    findMany: vi.fn(async ({ where, take }: { where?: Record<string, unknown>; take?: number } = {}) => db[nome].filter((l) => bate(l, where)).slice(0, take ?? Infinity).map((l) => ({ ...l }))),
    findFirst: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => db[nome].find((l) => bate(l, where)) ?? null),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const alvo = db[nome].filter((l) => bate(l, where));
      for (const l of alvo) Object.assign(l, data);
      return { count: alvo.length };
    }),
    create: vi.fn(async ({ data }: { data: Linha }) => {
      const l = { ...data, id: `${nome}-${++seq}` };
      db[nome].push(l);
      return l;
    }),
    deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const antes = db[nome].length;
      db[nome] = db[nome].filter((l) => !bate(l, where));
      return { count: antes - db[nome].length };
    }),
  };
}

vi.mock("@/lib/db/prisma", () => {
  const nomes = ["monthlyEntry", "contributionAllocation", "customCategory", "transactionCategoryRule", "regraDePerfil", "goal"];
  const prisma: Record<string, unknown> = Object.fromEntries(nomes.map((n) => [n, tabela(n)]));
  prisma.$transaction = async (ops: Promise<unknown>[]) => Promise.all(ops);
  return { prisma };
});

const ANA = "ana";
const LUCAS = "lucas";
const PESSOAL = "pessoal";
const CASAL = "casal";
const EMPRESA = "empresa";
const PERFIS = [
  { id: PESSOAL, name: "Pessoal", kind: "PESSOAL", icon: "wallet", theme: "padrao", userId: ANA },
  { id: CASAL, name: "Nós dois", kind: "CASAL", icon: "heart", theme: "padrao", userId: ANA },
  { id: EMPRESA, name: "Ateliê da Ana", kind: "EMPRESA", icon: "briefcase", theme: "girly", userId: ANA },
  { id: "pessoal-lucas", name: "Pessoal", kind: "PESSOAL", icon: "wallet", theme: "padrao", userId: LUCAS },
];
vi.mock("@/lib/repositories/profile.repo", () => ({
  listProfiles: vi.fn(async (userId: string) => PERFIS.filter((p) => p.userId === userId)),
}));

const { moverLancamentos, desfazerMudanca, outrasParcelas, perfisDeDestino, regrasDePerfil } = await import("../mover-perfil.repo");

const naPessoal: AuthContext = { userId: ANA, role: "CLIENT", profileId: PESSOAL, profileTheme: "padrao", profileKind: "PESSOAL" };
const noCasal: AuthContext = { ...naPessoal, profileId: CASAL, profileKind: "CASAL" };
const parNoCasal: AuthContext = { userId: LUCAS, role: "CLIENT", profileId: CASAL, profileTheme: "padrao", profileKind: "CASAL", par: { letra: "B", donoId: ANA } as never, donoId: ANA };

function lancamento(id: string, o: Record<string, unknown> = {}): Linha {
  return {
    id, userId: ANA, profileId: PESSOAL, year: 2026, month: 10, category: "EXPENSE", parentCategory: null, customCategoryId: null, subcategory: null,
    description: id, amount: 50, goalId: null, externalId: null, pessoa: null, doCasal: null, soMeu: false, autorUserId: null,
    cliente: null, formaDeRecebimento: null, recebeEm: null, recebidoEm: null, importBatchId: "lote-pessoal", ...o,
  };
}

const linha = (id: string) => db.monthlyEntry.find((l) => l.id === id)!;

beforeEach(() => {
  for (const k of Object.keys(db)) db[k] = [];
  db.monthlyEntry.push(
    lancamento("canva", { description: "CANVA PRO", parentCategory: "OUTROS", subcategory: "Assinaturas e apps" }),
    lancamento("mercado", { description: "PAO DE ACUCAR", parentCategory: "ALIMENTACAO", subcategory: "Mercado", goalId: "meta-viagem" }),
    lancamento("petz", { description: "PETZ PINHEIROS", customCategoryId: "pet-pessoal" }),
    lancamento("magalu-2", { description: "MAGALU PARC 02/06", amount: 150 }),
    lancamento("magalu-3", { description: "MAGALU PARC 03/06", amount: 150, month: 11 }),
    lancamento("magalu-4", { description: "MAGALU PARC 04/06", amount: 150, month: 12 }),
    lancamento("aporte", { category: "INVESTMENT_CONTRIBUTION", description: "Aplicação" }),
    lancamento("casal-ana", { profileId: CASAL, description: "MERCADO", parentCategory: "ALIMENTACAO", pessoa: "A", doCasal: true }),
    lancamento("casal-lucas", { profileId: CASAL, description: "BARBEARIA", pessoa: "B", autorUserId: LUCAS }),
    lancamento("empresa-venda", { profileId: EMPRESA, category: "INCOME", description: "Venda" }),
  );
  db.contributionAllocation.push({ id: "al1", userId: ANA, profileId: PESSOAL, entryId: "aporte" });
  db.customCategory.push({ id: "pet-pessoal", userId: ANA, profileId: PESSOAL, name: "Pet" }, { id: "pet-casal", userId: ANA, profileId: CASAL, name: "Pet" });
  db.goal.push({ id: "meta-viagem", userId: ANA, profileId: PESSOAL });
});

describe("mover lançamentos entre perfis", () => {
  it("só os outros perfis dela aparecem; para o par, nenhum", async () => {
    expect((await perfisDeDestino(naPessoal)).map((p) => p.id)).toEqual([CASAL, EMPRESA]);
    expect(await perfisDeDestino(parNoCasal)).toEqual([]);
  });

  it("move um: troca de perfil, mantém o lote e recalcula a categoria pelo motor da Empresa", async () => {
    const r = await moverLancamentos(naPessoal, { ids: ["canva"], destinoId: EMPRESA, lembrar: false });
    expect(r.ok && r.movidos).toBe(1);
    expect(linha("canva")).toMatchObject({ profileId: EMPRESA, parentCategory: "MORADIA", subcategory: "Software e assinaturas", importBatchId: "lote-pessoal" });
  });

  it("move vários de uma vez; a meta do Pessoal fica para trás", async () => {
    const r = await moverLancamentos(naPessoal, { ids: ["canva", "mercado"], destinoId: CASAL, lembrar: false });
    expect(r.ok && r.movidos).toBe(2);
    expect(linha("mercado")).toMatchObject({ profileId: CASAL, parentCategory: "ALIMENTACAO", subcategory: "Mercado", goalId: null });
    expect(linha("canva")).toMatchObject({ profileId: CASAL, parentCategory: "OUTROS" });
  });

  it("personalizada: usa a de mesmo nome no destino; sem ela, nunca aponta para a do outro perfil", async () => {
    await moverLancamentos(naPessoal, { ids: ["petz"], destinoId: CASAL, lembrar: false });
    expect(linha("petz")).toMatchObject({ profileId: CASAL, customCategoryId: "pet-casal" });
    await moverLancamentos(noCasal, { ids: ["petz"], destinoId: EMPRESA, lembrar: false });
    expect(linha("petz")).toMatchObject({ profileId: EMPRESA, customCategoryId: null, parentCategory: null });
  });

  it("desfazer devolve tudo como era (categoria, meta) e apaga a regra que nasceu agora", async () => {
    const r = await moverLancamentos(naPessoal, { ids: ["canva", "mercado"], destinoId: EMPRESA, lembrar: true });
    if (!r.ok) throw new Error(r.erro);
    expect(db.regraDePerfil.map((x) => x.pattern).sort()).toEqual(["canva pro", "pao acucar"]);
    const d = await desfazerMudanca(naPessoal, r.desfazer);
    expect(d).toMatchObject({ ok: true, voltaram: 2 });
    expect(linha("canva")).toMatchObject({ profileId: PESSOAL, parentCategory: "OUTROS", subcategory: "Assinaturas e apps" });
    expect(linha("mercado")).toMatchObject({ profileId: PESSOAL, goalId: "meta-viagem" });
    expect(db.regraDePerfil).toEqual([]);
  });

  it("desfazer não aceita meta nem categoria de outro perfil vindas do cliente", async () => {
    const r = await moverLancamentos(naPessoal, { ids: ["canva"], destinoId: EMPRESA, lembrar: false });
    if (!r.ok) throw new Error(r.erro);
    r.desfazer.linhas[0] = { ...r.desfazer.linhas[0], customCategoryId: "pet-casal", goalId: "meta-de-outro", parentCategory: "INVENTADA" };
    await desfazerMudanca(naPessoal, r.desfazer);
    expect(linha("canva")).toMatchObject({ profileId: PESSOAL, customCategoryId: null, goalId: null, parentCategory: null });
  });

  it("as outras parcelas da mesma compra", async () => {
    expect((await outrasParcelas(naPessoal, ["magalu-2"])).sort()).toEqual(["magalu-3", "magalu-4"]);
    const r = await moverLancamentos(naPessoal, { ids: ["magalu-2", "magalu-3", "magalu-4"], destinoId: EMPRESA, lembrar: false });
    expect(r.ok && r.movidos).toBe(3);
    expect(r.ok && r.meses.length).toBe(3);
  });

  it("'sempre mandar': a regra mora no perfil de onde a compra sai e aponta para o destino", async () => {
    await moverLancamentos(naPessoal, { ids: ["canva"], destinoId: EMPRESA, lembrar: true });
    expect(await regrasDePerfil(naPessoal)).toEqual([expect.objectContaining({ pattern: "canva pro", destinoProfileId: EMPRESA })]);
    expect(await regrasDePerfil({ ...naPessoal, profileId: EMPRESA })).toEqual([]);
  });

  it("guardado que já entrou na carteira fica", async () => {
    const r = await moverLancamentos(naPessoal, { ids: ["aporte", "canva"], destinoId: EMPRESA, lembrar: false });
    expect(r.ok && [r.movidos, r.ficaram]).toEqual([1, 1]);
    expect(linha("aporte").profileId).toBe(PESSOAL);
  });

  it("saindo do Casal, quem pagou sai junto", async () => {
    await moverLancamentos(noCasal, { ids: ["casal-ana"], destinoId: PESSOAL, lembrar: false });
    expect(linha("casal-ana")).toMatchObject({ profileId: PESSOAL, pessoa: null, doCasal: null, soMeu: false });
  });
});

describe("isolamento", () => {
  it("perfil que não é dela é recusado", async () => {
    const r = await moverLancamentos(naPessoal, { ids: ["canva"], destinoId: "pessoal-lucas", lembrar: false });
    expect(r.ok).toBe(false);
    expect(linha("canva").profileId).toBe(PESSOAL);
  });

  it("o par não move nada, nem o que é dele no Casal", async () => {
    const r = await moverLancamentos(parNoCasal, { ids: ["casal-ana", "casal-lucas"], destinoId: "pessoal-lucas", lembrar: false });
    expect(r.ok).toBe(false);
    expect(linha("casal-ana").profileId).toBe(CASAL);
    expect(linha("casal-lucas").profileId).toBe(CASAL);
  });

  it("a titular não move o que o par lançou no Casal", async () => {
    const r = await moverLancamentos(noCasal, { ids: ["casal-lucas"], destinoId: PESSOAL, lembrar: false });
    expect(r.ok).toBe(false);
    expect(linha("casal-lucas").profileId).toBe(CASAL);
  });

  it("só move o que está no perfil aberto (id de outro perfil é ignorado)", async () => {
    const r = await moverLancamentos(naPessoal, { ids: ["empresa-venda", "canva"], destinoId: CASAL, lembrar: false });
    expect(r.ok && r.movidos).toBe(1);
    expect(linha("empresa-venda").profileId).toBe(EMPRESA);
  });

  it("desfazer só traz de volta o que está no destino", async () => {
    const d = await desfazerMudanca(naPessoal, { destinoId: EMPRESA, regras: [], linhas: [{ id: "empresa-venda" } as never, { id: "casal-ana" } as never] });
    expect(d.voltaram).toBe(1);
    expect(linha("casal-ana").profileId).toBe(CASAL);
  });
});
