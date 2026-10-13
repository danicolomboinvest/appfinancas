import { describe, expect, it, vi } from "vitest";

const findMany = vi.fn(async (...args: unknown[]) => (args.length ? [] : []));
vi.mock("@/lib/auth/session", () => ({ doDono: (c: { userId: string; profileId: string }) => ({ userId: c.userId, profileId: c.profileId }) }));
vi.mock("@/lib/repositories/parametro-legal.repo", () => ({ parametrosDoMei: async () => ({}) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { monthlyEntry: { findMany: (a: unknown) => findMany(a) } } }));

import { lancamentosDaEmpresa, linhasDaEmpresaNosMeses } from "../empresa.repo";

const ctx = { userId: "ana", profileId: "empresa-ana" } as Parameters<typeof linhasDaEmpresaNosMeses>[0];

describe("a lista e as somas do período leem só o perfil aberto", () => {
  it("a lista editável filtra por usuário E perfil, nos meses do período", async () => {
    await linhasDaEmpresaNosMeses(ctx, [{ ano: 2025, mes: 12 }, { ano: 2026, mes: 1 }]);
    const where = (findMany.mock.calls.at(-1)![0] as { where: Record<string, unknown> }).where;
    expect(where.userId).toBe("ana");
    expect(where.profileId).toBe("empresa-ana");
    expect(where.OR).toEqual([{ year: 2025, month: 12 }, { year: 2026, month: 1 }]);
  });

  it("período sem meses não vai ao banco", async () => {
    findMany.mockClear();
    expect(await linhasDaEmpresaNosMeses(ctx, [])).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("o período mais antigo que a janela também lê só o perfil aberto", async () => {
    await lancamentosDaEmpresa(ctx, { ano: 2024, mes: 3 });
    const where = (findMany.mock.calls.at(-1)![0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ userId: "ana", profileId: "empresa-ana" });
  });
});
