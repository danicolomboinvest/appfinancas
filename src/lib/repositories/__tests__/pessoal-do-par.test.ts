import { describe, expect, it, vi } from "vitest";

/** O par do Casal simples usa o app inteiro no Pessoal dele: o que já tem, ou um novo. */

type Perfil = { id: string; userId: string; kind: string; isDefault: boolean; createdAt: Date };
const db = vi.hoisted(() => ({ perfis: [] as Perfil[], seq: 0, cats: [] as string[] }));

vi.mock("@/lib/db/prisma", () => {
  const casa = (p: Perfil, w: Record<string, unknown>) => Object.entries(w).every(([k, v]) => (p as unknown as Record<string, unknown>)[k] === v);
  return {
    prisma: {
      financialProfile: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => db.perfis.filter((p) => casa(p, where)).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null,
        create: async ({ data }: { data: Perfil }) => {
          const p = { ...data, id: `novo${++db.seq}`, createdAt: new Date() };
          db.perfis.push(p);
          return { id: p.id };
        },
        updateMany: async () => ({ count: 1 }),
      },
      // As categorias que já nascem no Pessoal novo (que-ja-nascem.ts): aqui só contam.
      customCategory: {
        findMany: async ({ where }: { where: { name?: { in: string[] } } }) => (where.name ? db.cats.map((name, i) => ({ id: `c${i}`, name })) : []),
        createMany: async ({ data }: { data: { name: string }[] }) => {
          db.cats.push(...data.map((d) => d.name));
          return { count: data.length };
        },
      },
    },
  };
});

const { garantirPessoalDoPar } = await import("@/lib/repositories/casa.repo");

describe("Pessoal do par", () => {
  it("quem entrou só pelo convite ganha um Pessoal, que já abre como o perfil dele", async () => {
    db.perfis = [];
    db.cats = [];
    const r = await garantirPessoalDoPar("lucas");
    expect(r.criado).toBe(true);
    expect(db.perfis).toEqual([expect.objectContaining({ userId: "lucas", kind: "PESSOAL", isDefault: true })]);
    // O Pessoal novo já nasce com as categorias de sempre.
    expect(db.cats).toEqual(["Beleza", "Roupas", "Presentes", "Pet", "Assinaturas", "Academia", "Doação"]);
  });

  it("quem já comprou o SPI continua no Pessoal que tinha (nada é criado)", async () => {
    db.perfis = [
      { id: "empresa", userId: "lucas", kind: "EMPRESA", isDefault: true, createdAt: new Date("2026-01-01") },
      { id: "pessoal", userId: "lucas", kind: "PESSOAL", isDefault: false, createdAt: new Date("2026-02-01") },
    ];
    expect(await garantirPessoalDoPar("lucas")).toEqual({ id: "pessoal", criado: false });
    expect(db.perfis).toHaveLength(2);
  });

  it("com outro perfil já aberto, o Pessoal novo não rouba o lugar dele", async () => {
    db.perfis = [{ id: "empresa", userId: "lucas", kind: "EMPRESA", isDefault: true, createdAt: new Date("2026-01-01") }];
    await garantirPessoalDoPar("lucas");
    expect(db.perfis.filter((p) => p.isDefault)).toHaveLength(1);
  });
});
