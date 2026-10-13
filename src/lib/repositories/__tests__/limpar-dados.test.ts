import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Limpar meus dados e recomeçar" com o banco trocado por tabelas em memória. As consultas de
 * verdade do repositório (os `where` do Prisma) são avaliadas aqui por um avaliador das mesmas
 * formas: igualdade, in, startsWith, nulo, OR, AND, NOT e o `none` das relações.
 *
 * A promessa que este teste segura: limpar apaga o dinheiro de QUEM pediu, só nos perfis
 * escolhidos; nunca outro perfil, nunca outra conta, nunca o lado do par no Nós dois; e a conta
 * (login, assinatura, compras, aparência) continua.
 */

type Linha = Record<string, unknown> & { id: string };
type Banco = Record<string, Linha[]>;

let banco: Banco = {};
let proximo = 0;

/** Relações usadas em filtros `none`: modelo.campo → [tabela filha, chave estrangeira]. */
const RELACOES: Record<string, [string, string]> = {
  "goal.entries": ["monthlyEntry", "goalId"],
  "goal.assets": ["asset", "goalId"],
  "customCategory.monthlyEntries": ["monthlyEntry", "customCategoryId"],
  "customCategory.budgets": ["budget", "customCategoryId"],
};

function bate(modelo: string, linha: Linha, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([chave, cond]) => {
    if (cond === undefined) return true;
    if (chave === "OR") return (cond as Record<string, unknown>[]).some((w) => bate(modelo, linha, w));
    if (chave === "AND") return (cond as Record<string, unknown>[]).every((w) => bate(modelo, linha, w));
    if (chave === "NOT") {
      const lista = Array.isArray(cond) ? cond : [cond];
      return lista.every((w) => !bate(modelo, linha, w as Record<string, unknown>));
    }
    const rel = RELACOES[`${modelo}.${chave}`];
    if (rel) {
      const c = cond as { none?: Record<string, unknown> };
      if (!c.none) throw new Error(`filtro de relação não suportado: ${chave}`);
      const [filha, fk] = rel;
      return !(banco[filha] ?? []).some((f) => f[fk] === linha.id && bate(filha, f, c.none));
    }
    const valor = linha[chave] ?? null;
    if (cond === null) return valor === null;
    if (typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { in?: unknown[]; startsWith?: string; not?: unknown; gte?: Date };
      if ("in" in c) return c.in!.includes(valor);
      if ("startsWith" in c) return typeof valor === "string" && valor.startsWith(c.startsWith!);
      if ("not" in c) return valor !== c.not;
      if ("gte" in c) return valor instanceof Date && valor >= c.gte!;
      throw new Error(`operador não suportado em ${modelo}.${chave}: ${JSON.stringify(cond)}`);
    }
    return valor === cond;
  });
}

function tabela(modelo: string) {
  const linhas = () => (banco[modelo] ??= []);
  return {
    findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => linhas().filter((l) => bate(modelo, l, where))),
    findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => linhas().find((l) => bate(modelo, l, where)) ?? null),
    count: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => linhas().filter((l) => bate(modelo, l, where)).length),
    deleteMany: vi.fn(({ where }: { where?: Record<string, unknown> }) => {
      const antes = linhas().length;
      banco[modelo] = linhas().filter((l) => !bate(modelo, l, where));
      return Promise.resolve({ count: antes - banco[modelo].length });
    }),
    update: vi.fn(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const l = linhas().find((x) => bate(modelo, x, where));
      if (!l) throw new Error(`${modelo}.update sem linha`);
      for (const [k, v] of Object.entries(data)) l[k] = v && typeof v === "object" && "_dbNull" in (v as object) ? null : v;
      return Promise.resolve(l);
    }),
    create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
      const l = { id: `n${++proximo}`, createdAt: new Date(), ...data };
      linhas().push(l);
      return Promise.resolve(l);
    }),
  };
}

const modelos = new Map<string, ReturnType<typeof tabela>>();
const prismaFalso = new Proxy(
  {},
  {
    get(_, nome: string) {
      // As operações já rodaram na ordem em que foram montadas (como o Prisma roda o lote).
      if (nome === "$transaction") return async (ops: Promise<unknown>[]) => Promise.all(ops);
      if (!modelos.has(nome)) modelos.set(nome, tabela(nome));
      return modelos.get(nome);
    },
  },
);

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaFalso }));
vi.mock("@prisma/client", () => ({ Prisma: { DbNull: { _dbNull: true } } }));

const { limparDados, cabeMaisUmaLimpeza } = await import("../limpar-dados.repo");

// ---------------------------------------------------------------------------------------------
// O banco de mentira: Ana (u1) com Pessoal, Empresa e Nós dois; o par dela (par) no Nós dois;
// Bia (u2), outra conta, com o Pessoal dela.
// ---------------------------------------------------------------------------------------------

const TABELAS_COM_PERFIL = [
  "monthlyEntry", "importBatch", "budget", "monthlyPlan", "yearlyConsolidationCache", "accumulationProjectionCache",
  "asset", "portfolioStrategy", "patrimonySnapshot", "analysisSheet", "simulation", "emergencyFund", "planningParams",
  "transactionCategoryRule", "goal", "fotoDaMeta", "customCategory", "decisao", "contaAPagar", "contaRecusada", "divida",
  "achadoDinheiroPerdido", "fechamentoDoMes", "contributionAllocation",
];

function linhaDe(modelo: string, userId: string, profileId: string | null, extra: Record<string, unknown> = {}): Linha {
  const l: Linha = { id: `${modelo}-${userId}-${profileId}-${++proximo}`, userId, profileId, ...extra };
  (banco[modelo] ??= []).push(l);
  return l;
}

function montarBanco() {
  banco = {};
  proximo = 0;
  banco.user = [
    { id: "u1", email: "ana@exemplo.test", passwordHash: "hash-ana", name: "Ana", theme: "dark", currency: "BRL", avatarUrl: "/api/conta/foto", onboardedAt: new Date("2026-09-01"), comeco: { passo: "porta", apelido: "Aninha", renda: 5000, quer: "sonho", lancou: "extrato", terminouEm: "2026-09-01" } },
    { id: "u2", email: "bia@exemplo.test", passwordHash: "hash-bia", onboardedAt: new Date("2026-09-01"), comeco: null },
    { id: "par", email: "par@exemplo.test", passwordHash: "hash-par", onboardedAt: new Date("2026-10-01"), comeco: null },
  ];
  banco.financialProfile = [
    { id: "pes", userId: "u1", kind: "PESSOAL", name: "Pessoal", theme: "girly", categorias: { LAZER: { nome: "Rolês" } }, empresa: null, limiteCartao: 800, perfilInvestidor: "moderado", casal: null },
    { id: "emp", userId: "u1", kind: "EMPRESA", name: "Ateliê", theme: "padrao", categorias: null, empresa: { tipo: "MEI" }, limiteCartao: null, perfilInvestidor: null, casal: null },
    { id: "cas", userId: "u1", kind: "CASAL", name: "Nós dois", theme: "padrao", categorias: null, empresa: null, limiteCartao: null, perfilInvestidor: null, casal: { nomeA: "Ana", nomeB: "Léo", divisao: "meio", acertos: ["2026-09"], mostrarRenda: true } },
    { id: "bia", userId: "u2", kind: "PESSOAL", name: "Pessoal", theme: "padrao", categorias: { LAZER: { oculta: true } }, empresa: null, limiteCartao: 100, perfilInvestidor: null, casal: null },
  ];
  for (const [userId, profileId] of [["u1", "pes"], ["u1", "emp"], ["u1", "cas"], ["u1", null], ["u2", "bia"], ["par", "cas"]] as const) {
    for (const modelo of TABELAS_COM_PERFIL) {
      if (modelo === "fechamentoDoMes" && profileId === null) continue;
      linhaDe(modelo, userId, profileId, modelo === "decisao" ? { tipo: "compra_desisti" } : {});
    }
    linhaDe("decisao", userId, profileId, { tipo: "reset_marco", chave: "reset|marco|1" });
    linhaDe("decisao", userId, profileId, { tipo: "resposta_errada" });
  }
  banco.fechamentoCasal = [{ id: "fc1", profileId: "cas", ano: 2026, mes: 9 }];
  banco.conviteCasal = [{ id: "cv1", profileId: "cas", userId: "u1", status: "aceito" }];
  banco.membroCasal = [{ id: "mc1", profileId: "cas", userId: "par", letra: "B" }];
  banco.bankConnection = [
    { id: "bc-nu", userId: "u1", itemId: "item-nu", connectorName: "Nubank" },
    { id: "bc-itau", userId: "u1", itemId: "item-itau", connectorName: "Itaú" },
    { id: "bc-novo", userId: "u1", itemId: "item-novo", connectorName: "Inter" },
    { id: "bc-bia", userId: "u2", itemId: "item-bia", connectorName: "Nubank" },
  ];
  linhaDe("importBatch", "u1", "pes", { docType: "openfinance", fileName: "Nubank · 10/10/2026" });
  linhaDe("importBatch", "u1", "emp", { docType: "openfinance", fileName: "Itaú · 10/10/2026" });
  linhaDe("importBatch", "u2", "bia", { docType: "openfinance", fileName: "Nubank · 10/10/2026" });
  banco.importFile = [{ id: "if1", userId: "u1" }, { id: "if2", userId: "u2" }];
  banco.importDiagnostic = [{ id: "id1", userId: "u1" }, { id: "id2", userId: "u2" }];
  // O que é da conta e nunca sai.
  banco.allowedEmail = [{ id: "ae1", email: "ana@exemplo.test", active: true }];
  banco.produtoLiberado = [{ id: "pl1", email: "ana@exemplo.test", produto: "money_reset" }];
  banco.assinaturaApple = [{ id: "aa1", userId: "u1" }];
  banco.pedidoAntesDeCancelar = [{ id: "pc1", userId: "u1" }];
  banco.pushSubscription = [{ id: "ps1", userId: "u1" }];
  banco.fotoDaConta = [{ id: "fo1", userId: "u1" }];
  banco.usageEvent = [];
}

const ana = { userId: "u1", role: "CLIENT" as const, profileId: "pes", profileTheme: "girly", profileKind: "PESSOAL" as const };
const anaNoCasal = { ...ana, profileId: "cas", profileKind: "CASAL" as const };
const par = { userId: "par", role: "CLIENT" as const, profileId: "cas", profileTheme: "padrao", profileKind: "CASAL" as const, par: { letra: "B", mostrarRenda: false, donoId: "u1" } as never, donoId: "u1" };

const de = (modelo: string, userId: string, profileId: string | null) => (banco[modelo] ?? []).filter((l) => l.userId === userId && (l.profileId ?? null) === profileId);
const perfil = (id: string) => banco.financialProfile.find((p) => p.id === id)!;
const usuario = (id: string) => banco.user.find((u) => u.id === id)!;

beforeEach(() => {
  montarBanco();
  modelos.clear();
});

describe("limpar o perfil aberto", () => {
  it("apaga todo o dinheiro do perfil", async () => {
    const r = await limparDados(ana, { escopo: "perfil", zerarMoneyReset: true });
    for (const modelo of TABELAS_COM_PERFIL) {
      const sobrou = de(modelo, "u1", "pes").filter((l) => l.tipo !== "resposta_errada");
      expect(sobrou, modelo).toEqual([]);
    }
    expect(r.contagens.lancamentos).toBe(1);
    expect(r.contagens.importacoes).toBe(2); // o lote comum e o do Nubank
    expect(r.contagens.decisoes).toBe(2); // a compra e o Money Reset
    expect(r.perfis).toBe(1);
  });

  it("não toca nos outros perfis dela nem na outra conta", async () => {
    await limparDados(ana, { escopo: "perfil", zerarMoneyReset: true });
    for (const modelo of TABELAS_COM_PERFIL) {
      expect(de(modelo, "u1", "emp").length, `${modelo} da Empresa`).toBeGreaterThan(0);
      expect(de(modelo, "u1", "cas").length, `${modelo} do Nós dois`).toBeGreaterThan(0);
      expect(de(modelo, "u1", null).length + (modelo === "fechamentoDoMes" ? 1 : 0), `${modelo} sem perfil`).toBeGreaterThan(0);
      expect(de(modelo, "u2", "bia").length, `${modelo} da Bia`).toBeGreaterThan(0);
      expect(de(modelo, "par", "cas").length, `${modelo} do par`).toBeGreaterThan(0);
    }
    expect(perfil("emp").empresa).toEqual({ tipo: "MEI" });
    expect(perfil("bia").limiteCartao).toBe(100);
    expect(banco.importFile.length).toBe(2);
    expect(banco.importDiagnostic.length).toBe(2);
  });

  it("mantém a conta: login, assinatura, compras, aparência, foto, nome e o próprio perfil", async () => {
    await limparDados(ana, { escopo: "perfil", zerarMoneyReset: true });
    const u = usuario("u1");
    expect(u.passwordHash).toBe("hash-ana");
    expect(u.email).toBe("ana@exemplo.test");
    expect(u.name).toBe("Ana");
    expect(u.theme).toBe("dark");
    expect(u.avatarUrl).toBe("/api/conta/foto");
    for (const t of ["allowedEmail", "produtoLiberado", "assinaturaApple", "pedidoAntesDeCancelar", "pushSubscription", "fotoDaConta"]) expect(banco[t].length, t).toBe(1);
    const p = perfil("pes");
    expect(p).toMatchObject({ name: "Pessoal", kind: "PESSOAL", theme: "girly" });
    // O que era dinheiro no perfil volta ao de fábrica.
    expect(p).toMatchObject({ categorias: null, empresa: null, limiteCartao: null, perfilInvestidor: null });
  });

  it("guarda o aviso de resposta errada (é da equipe) e, se ela quiser, o Money Reset", async () => {
    await limparDados(ana, { escopo: "perfil", zerarMoneyReset: false });
    const tipos = de("decisao", "u1", "pes").map((d) => d.tipo).sort();
    expect(tipos).toEqual(["reset_marco", "resposta_errada"]);
  });

  it("volta ao começo, na porta do primeiro lançamento, guardando só como ela quer ser chamada", async () => {
    await limparDados(ana, { escopo: "perfil", zerarMoneyReset: true });
    const u = usuario("u1");
    expect(u.onboardedAt).toBeNull();
    expect(u.comeco).toMatchObject({ passo: "porta", apelido: "Aninha", quer: "sonho", renda: null, lancou: null, terminouEm: null });
  });

  it("desliga só o banco que mora no perfil limpo", async () => {
    const r = await limparDados(ana, { escopo: "perfil", zerarMoneyReset: true });
    expect(banco.bankConnection.map((c) => c.id).sort()).toEqual(["bc-bia", "bc-itau", "bc-novo"]);
    expect(r.itensPluggy).toEqual(["item-nu"]);
    expect(r.contagens.conexoesBancarias).toBe(1);
  });

  it("registra que limpou (sem conteúdo) e é idempotente", async () => {
    await limparDados(ana, { escopo: "perfil", zerarMoneyReset: true });
    const segunda = await limparDados(ana, { escopo: "perfil", zerarMoneyReset: true });
    expect(Object.values(segunda.contagens).every((n) => n === 0)).toBe(true);
    expect(banco.usageEvent.map((e) => [e.userId, e.name, e.path])).toEqual([
      ["u1", "dados_limpos", "/configuracoes/limpar/perfil"],
      ["u1", "dados_limpos", "/configuracoes/limpar/perfil"],
    ]);
  });

  it("limite: a quarta limpeza na mesma hora não cabe", async () => {
    expect(await cabeMaisUmaLimpeza("u1")).toBe(true);
    for (let i = 0; i < 3; i++) await limparDados(ana, { escopo: "perfil", zerarMoneyReset: true });
    expect(await cabeMaisUmaLimpeza("u1")).toBe(false);
    expect(await cabeMaisUmaLimpeza("u2")).toBe(true);
  });
});

describe("limpar todos os perfis", () => {
  it("apaga o dinheiro de todos os perfis dela, inclusive o histórico sem perfil", async () => {
    const r = await limparDados(ana, { escopo: "todos", zerarMoneyReset: true });
    for (const modelo of TABELAS_COM_PERFIL) {
      for (const p of ["pes", "emp", "cas", null]) {
        expect(de(modelo, "u1", p).filter((l) => l.tipo !== "resposta_errada"), `${modelo} ${p}`).toEqual([]);
      }
    }
    expect(r.perfis).toBe(3);
    expect(banco.bankConnection.map((c) => c.id)).toEqual(["bc-bia"]);
    expect(banco.importFile.map((f) => f.id)).toEqual(["if2"]);
    expect(banco.importDiagnostic.map((f) => f.id)).toEqual(["id2"]);
    expect(perfil("emp").empresa).toBeNull();
  });

  it("não toca na outra conta nem no lado do par", async () => {
    await limparDados(ana, { escopo: "todos", zerarMoneyReset: true });
    for (const modelo of TABELAS_COM_PERFIL) {
      expect(de(modelo, "u2", "bia").length, `${modelo} da Bia`).toBeGreaterThan(0);
      expect(de(modelo, "par", "cas").length, `${modelo} do par`).toBeGreaterThan(0);
    }
    expect(usuario("u2").onboardedAt).not.toBeNull();
    expect(usuario("par").onboardedAt).not.toBeNull();
  });
});

describe("Nós dois", () => {
  it("a titular limpa o casal: sai o dela e o fechamento a dois; fica o par, o vínculo e o combinado", async () => {
    await limparDados(anaNoCasal, { escopo: "perfil", zerarMoneyReset: true });
    expect(de("monthlyEntry", "u1", "cas")).toEqual([]);
    expect(de("monthlyEntry", "par", "cas").length).toBe(1);
    expect(banco.fechamentoCasal).toEqual([]);
    expect(banco.conviteCasal.length).toBe(1);
    expect(banco.membroCasal.length).toBe(1);
    expect(perfil("cas").casal).toEqual({ nomeA: "Ana", nomeB: "Léo", divisao: "meio", acertos: [], mostrarRenda: true });
  });

  it("meta e categoria do casal que um lançamento do par usa ficam (e nada do par muda)", async () => {
    const meta = de("goal", "u1", "cas")[0];
    const cat = de("customCategory", "u1", "cas")[0];
    const lancDoPar = de("monthlyEntry", "par", "cas")[0];
    lancDoPar.goalId = meta.id;
    lancDoPar.customCategoryId = cat.id;
    const antes = JSON.stringify(lancDoPar);
    await limparDados(anaNoCasal, { escopo: "perfil", zerarMoneyReset: true });
    expect(de("goal", "u1", "cas").map((g) => g.id)).toEqual([meta.id]);
    expect(de("customCategory", "u1", "cas").map((c) => c.id)).toEqual([cat.id]);
    expect(JSON.stringify(de("monthlyEntry", "par", "cas")[0])).toBe(antes);
  });

  it("o par limpa: sai só o que é dele no casal; o da titular, o fechamento e o combinado ficam", async () => {
    const r = await limparDados(par, { escopo: "perfil", zerarMoneyReset: true });
    for (const modelo of TABELAS_COM_PERFIL) {
      expect(de(modelo, "par", "cas").filter((l) => l.tipo !== "resposta_errada"), modelo).toEqual([]);
      expect(de(modelo, "u1", "cas").length, `${modelo} da titular`).toBeGreaterThan(0);
    }
    expect(banco.fechamentoCasal.length).toBe(1);
    expect(perfil("cas").casal).toMatchObject({ acertos: ["2026-09"] });
    // O par não passa pelo começo: a conta dele não muda.
    expect(usuario("par").onboardedAt).not.toBeNull();
    expect(usuario("par").comeco).toBeNull();
    expect(r.contagens.fechamentosDoCasal).toBe(0);
  });

  it("o par com 'todos' também não alcança os perfis da titular", async () => {
    await limparDados(par, { escopo: "todos", zerarMoneyReset: true });
    for (const modelo of TABELAS_COM_PERFIL) {
      for (const p of ["pes", "emp", "cas", null]) expect(de(modelo, "u1", p).length, `${modelo} ${p}`).toBeGreaterThan(modelo === "fechamentoDoMes" && p === null ? -1 : 0);
    }
    expect(banco.bankConnection.filter((c) => c.userId === "u1").length).toBe(3);
  });
});

/**
 * Tabela nova com perfil precisa decidir: sai na limpeza, ou fica de propósito (com o motivo).
 * Mesmo remédio do delete-account-cobertura: quem cria a tabela descobre aqui, não pela cliente
 * que limpou e continuou vendo o dado velho.
 */
describe("a limpeza cobre todas as tabelas com perfil", () => {
  const FICAM: Record<string, string> = {
    ConviteCasal: "o convite do par é o vínculo do Nós dois, não dinheiro",
    MembroCasal: "o par continua no casal depois que a titular limpa",
  };

  it("toda tabela com profileId é apagada ou está na lista do que fica", () => {
    const raiz = join(__dirname, "..", "..", "..", "..");
    const schema = readFileSync(join(raiz, "prisma", "schema.prisma"), "utf-8");
    const repo = readFileSync(join(raiz, "src", "lib", "repositories", "limpar-dados.repo.ts"), "utf-8");
    const comPerfil = schema
      .split(/\nmodel /)
      .slice(1)
      .map((b) => ({ nome: b.split(/\s/)[0], corpo: b.split("\n}")[0] }))
      .filter((m) => m.nome !== "FinancialProfile" && /^\s*profileId\s+String/m.test(m.corpo))
      .map((m) => m.nome);
    expect(comPerfil.length).toBeGreaterThan(20);
    const faltando = comPerfil.filter((m) => !FICAM[m] && !repo.includes(`prisma.${m[0].toLowerCase()}${m.slice(1)}.deleteMany`));
    expect(faltando, `Tabelas com perfil que a limpeza esquece: ${faltando.join(", ")}`).toEqual([]);
  });
});
