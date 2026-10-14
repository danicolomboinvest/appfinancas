import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/auth.config", () => ({ auth: async () => null }));
vi.mock("@/lib/repositories/profile.repo", () => ({
  getOrCreateActiveProfile: async () => ({ id: "pessoal-ana", theme: "padrao", kind: "PESSOAL", categorias: null }),
}));
vi.mock("@/lib/repositories/casal-login.repo", () => ({ perfilDoPar: async () => null }));
const casa = { eu: { userId: "ana", profileId: "pessoal-ana", papel: "titular" }, outro: { userId: "lucas", profileId: "pessoal-lucas", papel: "par" } };
vi.mock("@/lib/repositories/casa.repo", () => ({ casaDoUsuario: async () => casa }));

import { contextoDaConta } from "../session";

describe("O widget monta o mesmo contexto do app", () => {
  it("a casa do casal simples vem junto (os totais dos dois, o orçamento da titular)", async () => {
    const ctx = await contextoDaConta({ id: "ana", role: "CLIENT" });
    expect(ctx.profileId).toBe("pessoal-ana");
    expect(ctx.casa).toBe(casa);
  });
});
