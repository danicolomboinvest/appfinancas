import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * garantirCuidadoPessoal contra um banco de mentira com o mesmo índice único do de verdade
 * (userId, profileId, name): duas importações ao mesmo tempo não criam duas categorias.
 */
type Cat = { id: string; userId: string; profileId: string; name: string; icon: string; createdAt: Date };
const db = vi.hoisted(() => ({ cats: [] as Cat[], seq: 0, creates: 0 }));

vi.mock("@/lib/db/prisma", async () => {
  const { Prisma } = await import("@prisma/client");
  const casa = (c: Cat, w: Record<string, unknown>) => Object.entries(w).every(([k, v]) => (c as Record<string, unknown>)[k] === v);
  return {
    prisma: {
      customCategory: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => db.cats.filter((c) => casa(c, where)),
        findFirst: async ({ where }: { where: Record<string, unknown> }) => db.cats.find((c) => casa(c, where)) ?? null,
        create: async ({ data }: { data: Omit<Cat, "id" | "createdAt"> }) => {
          db.creates += 1;
          // Deixa a outra importação chegar aqui antes de gravar (a corrida de verdade).
          await new Promise((r) => setTimeout(r, 5));
          if (db.cats.some((c) => c.userId === data.userId && c.profileId === data.profileId && c.name === data.name))
            throw new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "x", meta: { target: "name" } });
          const nova = { ...data, id: `cat${++db.seq}`, createdAt: new Date() };
          db.cats.push(nova);
          return nova;
        },
      },
    },
  };
});

const { garantirCuidadoPessoal } = await import("../custom-category.repo");
const ctx = { userId: "u1", profileId: "p1", profileKind: "PESSOAL" as const };

beforeEach(() => {
  db.cats = [];
  db.seq = 0;
  db.creates = 0;
});

describe("garantirCuidadoPessoal", () => {
  it("usa a categoria dela com nome parecido, sem criar outra", async () => {
    db.cats.push({ id: "beleza", userId: "u1", profileId: "p1", name: "Beleza", icon: "salao", createdAt: new Date() });
    expect(await garantirCuidadoPessoal(ctx)).toMatchObject({ id: "beleza", name: "Beleza" });
    expect(db.creates).toBe(0);
  });

  it("a categoria parecida de OUTRO perfil não vale", async () => {
    db.cats.push({ id: "outra", userId: "u1", profileId: "p2", name: "Cuidado pessoal", icon: "tag", createdAt: new Date() });
    const achada = await garantirCuidadoPessoal(ctx);
    expect(achada?.id).not.toBe("outra");
    expect(db.cats.filter((c) => c.profileId === "p1")).toHaveLength(1);
  });

  it("sem nenhuma, cria Cuidado pessoal com a sacola, uma vez só", async () => {
    const primeira = await garantirCuidadoPessoal(ctx);
    expect(primeira).toMatchObject({ name: "Cuidado pessoal", icon: "shopping-bag" });
    const segunda = await garantirCuidadoPessoal(ctx);
    expect(segunda?.id).toBe(primeira?.id);
    expect(db.cats).toHaveLength(1);
  });

  it("duas importações ao mesmo tempo dão na mesma categoria", async () => {
    const [a, b] = await Promise.all([garantirCuidadoPessoal(ctx), garantirCuidadoPessoal(ctx)]);
    expect(a?.id).toBe(b?.id);
    expect(db.cats).toHaveLength(1);
  });

  it("perfil Empresa não cria categoria pessoal", async () => {
    expect(await garantirCuidadoPessoal({ ...ctx, profileKind: "EMPRESA" as never })).toBeNull();
    expect(db.creates).toBe(0);
    expect(db.cats).toHaveLength(0);
  });
});
