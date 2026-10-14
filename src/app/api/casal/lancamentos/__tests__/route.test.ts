import { describe, expect, it, vi } from "vitest";

const findMany = vi.fn(async () => [
  { year: 2026, month: 10, entryDate: new Date("2026-10-05T12:00:00Z"), category: "EXPENSE", parentCategory: "ALIMENTACAO", description: "Mercado", subcategory: "Mercado", amount: 600, pessoa: null, doCasal: null, soMeu: false },
]);
vi.mock("@/lib/auth/auth.config", () => ({ auth: async () => ({ user: { id: "lucas" } }) }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: async () => ({ userId: "lucas", profileId: "pessoal-lucas", profileKind: "PESSOAL", role: "CLIENT" }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { monthlyEntry: { findMany: (a: unknown) => findMany(a) }, financialProfile: { findUnique: async () => null } } }));
vi.mock("@/lib/repositories/casal-login.repo", () => ({
  ultimoVinculoComoPar: async () => ({
    id: "m1", profileId: "casal-ana", letra: "B", saiuEm: new Date(), bloqueadoEm: null, modelo: "simples", perfilParId: "pessoal-lucas",
    profile: { userId: "ana", casal: null, user: { name: "Ana", email: "ana@x" } },
  }),
}));

const { GET } = await import("../route");

describe("GET /api/casal/lancamentos", () => {
  it("quem saiu de uma casa simples leva a cópia do Pessoal dele (e só dele)", async () => {
    const r = await GET();
    expect(r.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "lucas", profileId: "pessoal-lucas" } }));
    expect(await r.text()).toContain("Mercado");
  });
});
