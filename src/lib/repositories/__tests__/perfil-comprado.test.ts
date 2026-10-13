import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O perfil comprado aparece sozinho (13/10/2026). Uma cliente comprou o perfil Empresa, só ganhou
 * a liberação e escreveu "não aparece nada nesse segundo". Aqui, com o banco em memória: cria uma
 * vez, não duplica nem com duas abas juntas, não cria sem compra, não troca o perfil em uso, o
 * aviso sai uma vez e o reembolso não apaga a Empresa.
 */
type Perfil = { id: string; userId: string; name: string; kind: string; isDefault: boolean; position: number; createdAt: Date; icon: string; theme: string };
type Estado = {
  perfis: Perfil[];
  logs: { userId: string; key: string }[];
  liberados: { email: string; produto: string; ativo: boolean }[];
  apple: { userId: string; productId: string }[];
  membros: { userId: string; donoDoPerfil: string }[];
  seq: number;
};
const db = vi.hoisted(() => ({ s: null as unknown as Estado }));

function repetida() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

vi.mock("@/lib/db/prisma", () => {
  type Where = Record<string, unknown>;
  const fake = {
    user: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === "u1" ? { email: "Cliente@X.com" } : null) },
    produtoLiberado: {
      findMany: async ({ where }: { where: { email: string; produto: { in: string[] }; ativo: boolean } }) =>
        db.s.liberados.filter((l) => l.email === where.email && where.produto.in.includes(l.produto) && l.ativo === where.ativo).map((l) => ({ produto: l.produto })),
    },
    assinaturaApple: {
      findMany: async ({ where }: { where: { userId: string; productId: { in: string[] } } }) =>
        db.s.apple.filter((a) => a.userId === where.userId && where.productId.in.includes(a.productId)).map((a) => ({ productId: a.productId })),
    },
    notificationLog: {
      findMany: async ({ where }: { where: { userId: string; key: { startsWith: string } } }) =>
        db.s.logs.filter((l) => l.userId === where.userId && l.key.startsWith(where.key.startsWith)).map((l) => ({ key: l.key })),
      create: async ({ data }: { data: { userId: string; key: string } }) => {
        await Promise.resolve();
        if (db.s.logs.some((l) => l.userId === data.userId && l.key === data.key)) throw repetida();
        db.s.logs.push({ ...data });
        return data;
      },
      createMany: async ({ data }: { data: { userId: string; key: string }[] }) => {
        for (const d of data) if (!db.s.logs.some((l) => l.userId === d.userId && l.key === d.key)) db.s.logs.push({ ...d });
        return { count: data.length };
      },
    },
    financialProfile: {
      findMany: async ({ where }: { where: Where }) => db.s.perfis.filter((p) => p.userId === where.userId),
      findFirst: async ({ where, orderBy }: { where: Where; orderBy?: Record<string, string> }) => {
        const lista = db.s.perfis.filter((p) => p.userId === where.userId && (!where.kind || p.kind === where.kind));
        if (orderBy?.position === "desc") lista.sort((a, b) => b.position - a.position);
        return lista[0] ?? null;
      },
      create: async ({ data }: { data: Omit<Perfil, "id" | "isDefault" | "createdAt"> }) => {
        await Promise.resolve();
        const p: Perfil = { ...data, id: `perfil${++db.s.seq}`, isDefault: false, createdAt: new Date() };
        db.s.perfis.push(p);
        return p;
      },
    },
    membroCasal: {
      count: async ({ where }: { where: { OR: [{ userId: string }, { profile: { userId: string } }] } }) =>
        db.s.membros.filter((m) => m.userId === where.OR[0].userId || m.donoDoPerfil === where.OR[1].profile.userId).length,
    },
    $executeRaw: async () => 0,
  };
  // Uma transação por vez (o Postgres segura a segunda no índice único até a primeira terminar),
  // e o que deu erro volta atrás.
  let fila: Promise<unknown> = Promise.resolve();
  const $transaction = (fn: (tx: typeof fake) => Promise<unknown>) => {
    const vez = fila.then(async () => {
      const antes = structuredClone(db.s);
      try {
        return await fn(fake);
      } catch (e) {
        db.s = antes;
        throw e;
      }
    });
    fila = vez.catch(() => undefined);
    return vez;
  };
  return { prisma: { ...fake, $transaction } };
});

const { perfilCompradoNaEntrada, garantirEmpresaComprada, marcarAvisoDoPerfilCompradoVisto } = await import("@/lib/repositories/perfil-comprado.repo");

const pessoal = (): Perfil => ({ id: "pessoal", userId: "u1", name: "Pessoal", kind: "PESSOAL", isDefault: true, position: 0, createdAt: new Date("2026-01-01"), icon: "wallet", theme: "padrao" });
const empresas = () => db.s.perfis.filter((p) => p.kind === "EMPRESA");
const entrar = () => perfilCompradoNaEntrada("u1", "Cliente@X.com", { naCasa: false });

beforeEach(() => {
  db.s = { perfis: [pessoal()], logs: [], liberados: [{ email: "cliente@x.com", produto: "perfil_empresa", ativo: true }], apple: [], membros: [], seq: 0 };
});

describe("perfil Empresa comprado", () => {
  it("cria a Empresa uma vez, com o nome da tela, e avisa", async () => {
    const r = await entrar();
    expect(r.criouEmpresa).toBe(true);
    expect(empresas()).toHaveLength(1);
    expect(empresas()[0]).toMatchObject({ name: "Empresa", icon: "briefcase", position: 1 });
    expect(r.aviso).toEqual({ tipo: "empresa", perfilId: empresas()[0].id });
    const de_novo = await entrar();
    expect(de_novo.criouEmpresa).toBe(false);
    expect(empresas()).toHaveLength(1);
  });

  it("não troca o perfil em uso", async () => {
    await entrar();
    expect(db.s.perfis.find((p) => p.id === "pessoal")!.isDefault).toBe(true);
    expect(empresas()[0].isDefault).toBe(false);
  });

  it("duas abas ao mesmo tempo (e o webhook junto): uma Empresa só", async () => {
    await Promise.all([entrar(), entrar(), garantirEmpresaComprada("u1")]);
    expect(empresas()).toHaveLength(1);
  });

  it("sem compra não cria nada nem avisa", async () => {
    db.s.liberados = [];
    expect(await entrar()).toEqual({ aviso: null, criouEmpresa: false });
    expect(await garantirEmpresaComprada("u1")).toBe("sem-compra");
    expect(empresas()).toHaveLength(0);
    expect(db.s.logs).toHaveLength(0);
  });

  it("compra desligada (reembolso) não conta como compra", async () => {
    db.s.liberados[0].ativo = false;
    await entrar();
    expect(empresas()).toHaveLength(0);
  });

  it("compra pela Apple também cria", async () => {
    db.s.liberados = [];
    db.s.apple = [{ userId: "u1", productId: "com.danicolombo.spifinance.empresa.anual" }];
    await entrar();
    expect(empresas()).toHaveLength(1);
  });

  it("quem já tinha Empresa não ganha outra nem vê o aviso", async () => {
    db.s.perfis.push({ ...pessoal(), id: "minha", name: "Ateliê", kind: "EMPRESA", isDefault: false, position: 1 });
    const r = await entrar();
    expect(r.aviso).toBeNull();
    expect(empresas()).toHaveLength(1);
  });

  it("a Empresa que ela apagou não volta", async () => {
    await entrar();
    db.s.perfis = db.s.perfis.filter((p) => p.kind !== "EMPRESA");
    await entrar();
    expect(await garantirEmpresaComprada("u1")).toBe("ja-tratada");
    expect(empresas()).toHaveLength(0);
  });

  it("conta ainda sem nenhum perfil fica para a próxima entrada (a Empresa não vira o perfil que abre)", async () => {
    db.s.perfis = [];
    expect(await garantirEmpresaComprada("u1")).toBe("sem-perfil");
    expect(db.s.logs).toHaveLength(0);
    db.s.perfis = [pessoal()];
    expect(await garantirEmpresaComprada("u1")).toBe("criada");
  });

  it("o aviso sai uma vez: depois de visto, não volta", async () => {
    expect((await entrar()).aviso?.tipo).toBe("empresa");
    await marcarAvisoDoPerfilCompradoVisto("u1", "empresa");
    expect((await entrar()).aviso).toBeNull();
  });

  it("reembolso depois de criada: a Empresa fica, o aviso some", async () => {
    await entrar();
    db.s.liberados[0].ativo = false;
    expect((await entrar()).aviso).toBeNull();
    expect(empresas()).toHaveLength(1);
  });

  it("a cliente que comprou antes da mudança (só Pessoal) ganha ao entrar", async () => {
    // Liberação antiga, nenhuma marca: o caso da conta que escreveu para o suporte.
    const r = await entrar();
    expect(r.criouEmpresa).toBe(true);
    expect(db.s.perfis.map((p) => p.kind).sort()).toEqual(["EMPRESA", "PESSOAL"]);
  });
});

describe("Casal comprado", () => {
  beforeEach(() => {
    db.s.liberados = [{ email: "cliente@x.com", produto: "conta_parceiro", ativo: true }];
  });

  it("não cria perfil: só avisa, apontando para o convite", async () => {
    const r = await entrar();
    expect(r).toEqual({ aviso: { tipo: "casal" }, criouEmpresa: false });
    expect(db.s.perfis).toHaveLength(1);
  });

  it("quem já tem casa ou par não vê o aviso", async () => {
    expect((await perfilCompradoNaEntrada("u1", "cliente@x.com", { naCasa: true })).aviso).toBeNull();
    db.s.membros = [{ userId: "par", donoDoPerfil: "u1" }];
    expect((await entrar()).aviso).toBeNull();
  });

  it("o aviso do Casal também sai uma vez", async () => {
    await marcarAvisoDoPerfilCompradoVisto("u1", "casal");
    expect((await entrar()).aviso).toBeNull();
  });

  it("comprou os dois: a Empresa avisa primeiro, o Casal depois", async () => {
    db.s.liberados.push({ email: "cliente@x.com", produto: "perfil_empresa", ativo: true });
    expect((await entrar()).aviso?.tipo).toBe("empresa");
    await marcarAvisoDoPerfilCompradoVisto("u1", "empresa");
    expect((await entrar()).aviso?.tipo).toBe("casal");
  });
});
