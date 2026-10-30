import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * semearCategoriasQueJaNascem contra um banco de mentira com o mesmo índice único do de verdade
 * (userId, profileId, name): nunca cria em dobro, e a cor vai para as preferências do perfil.
 */
type Cat = { id: string; userId: string; profileId: string; name: string; icon: string };
const db = vi.hoisted(() => ({ cats: [] as Cat[], seq: 0, categorias: null as unknown, updates: 0 }));

vi.mock("@/lib/db/prisma", () => {
  const casa = (c: Cat, w: Record<string, unknown>) =>
    Object.entries(w).every(([k, v]) => {
      const valor = (c as Record<string, unknown>)[k];
      if (v && typeof v === "object" && "in" in (v as object)) return (v as { in: unknown[] }).in.includes(valor);
      return valor === v;
    });
  return {
    prisma: {
      customCategory: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => db.cats.filter((c) => casa(c, where)),
        createMany: async ({ data }: { data: Omit<Cat, "id">[]; skipDuplicates: boolean }) => {
          let count = 0;
          for (const d of data) {
            if (db.cats.some((c) => c.userId === d.userId && c.profileId === d.profileId && c.name === d.name)) continue;
            db.cats.push({ ...d, id: `cat${++db.seq}` });
            count += 1;
          }
          return { count };
        },
      },
      financialProfile: {
        findFirst: async () => ({ categorias: db.categorias }),
        updateMany: async ({ data }: { data: { categorias: unknown } }) => {
          db.updates += 1;
          db.categorias = data.categorias;
          return { count: 1 };
        },
      },
    },
  };
});

const { semearCategoriasQueJaNascem } = await import("../custom-category.repo");
const dono = { userId: "u1", profileId: "p1" };

beforeEach(() => {
  db.cats = [];
  db.seq = 0;
  db.categorias = null;
  db.updates = 0;
});

describe("semearCategoriasQueJaNascem", () => {
  it("no perfil vazio nascem as sete, com ícone e cor", async () => {
    expect(await semearCategoriasQueJaNascem(dono)).toBe(7);
    expect(db.cats.map((c) => c.name)).toEqual(["Beleza", "Roupas", "Presentes", "Pet", "Assinaturas", "Academia", "Doação"]);
    expect(db.cats.find((c) => c.name === "Pet")?.icon).toBe("paw");
    const prefs = db.categorias as { proprias: Record<string, { cor: string }> };
    expect(Object.keys(prefs.proprias)).toHaveLength(7);
    expect(prefs.proprias[db.cats.find((c) => c.name === "Pet")!.id].cor).toBe("var(--color-custom-6)");
  });

  it("chamada de novo, não cria nada nem mexe no perfil", async () => {
    await semearCategoriasQueJaNascem(dono);
    expect(await semearCategoriasQueJaNascem(dono)).toBe(0);
    expect(db.cats).toHaveLength(7);
    expect(db.updates).toBe(1);
  });

  it("o que ela já tem com outro nome, acento ou caixa não nasce em dobro", async () => {
    db.cats.push({ id: "a", ...dono, name: "roupa", icon: "tag" }, { id: "b", ...dono, name: "PETS", icon: "paw" }, { id: "c", ...dono, name: "Dízimo", icon: "doacao" });
    expect(await semearCategoriasQueJaNascem(dono)).toBe(4);
    expect(db.cats.map((c) => c.name)).toEqual(["roupa", "PETS", "Dízimo", "Beleza", "Presentes", "Assinaturas", "Academia"]);
    // A cor só das que nasceram agora; as dela ficam como estavam.
    const prefs = db.categorias as { proprias: Record<string, { cor: string }> };
    expect(Object.keys(prefs.proprias)).toHaveLength(4);
    expect(prefs.proprias.a).toBeUndefined();
  });

  it("as de OUTRO perfil da mesma conta não contam", async () => {
    db.cats.push({ id: "x", userId: "u1", profileId: "p2", name: "Pet", icon: "paw" });
    expect(await semearCategoriasQueJaNascem(dono)).toBe(7);
  });

  it("a cor que ela já escolheu para uma categoria sua não é trocada", async () => {
    db.categorias = { proprias: { outra: { cor: "var(--color-custom-1)", essencial: true } } };
    await semearCategoriasQueJaNascem(dono);
    const prefs = db.categorias as { proprias: Record<string, { cor: string; essencial?: boolean }> };
    expect(prefs.proprias.outra).toEqual({ cor: "var(--color-custom-1)", essencial: true });
  });
});
