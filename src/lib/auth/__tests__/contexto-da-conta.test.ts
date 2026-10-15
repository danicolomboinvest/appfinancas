import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/auth.config", () => ({ auth: async () => null }));
vi.mock("@/lib/repositories/profile.repo", () => ({
  getOrCreateActiveProfile: async () => ({ id: "pessoal-ana", theme: "padrao", kind: "PESSOAL", categorias: null }),
}));
vi.mock("@/lib/repositories/casal-login.repo", () => ({ perfilDoPar: async () => null }));
const casa = { eu: { userId: "ana", profileId: "pessoal-ana", papel: "titular" }, outro: { userId: "lucas", profileId: "pessoal-lucas", papel: "par" } };
vi.mock("@/lib/repositories/casa.repo", () => ({ casaDoUsuario: async () => casa }));

import { contextoDaConta, contextoDoPerfil } from "../session";

describe("O widget monta o mesmo contexto do app", () => {
  it("a casa do casal simples vem junto (os totais dos dois, o orçamento da titular)", async () => {
    const ctx = await contextoDaConta({ id: "ana", role: "CLIENT" });
    expect(ctx.profileId).toBe("pessoal-ana");
    expect(ctx.casa).toBe(casa);
  });
});

describe("Os crons montam o contexto como a sessão (contextoDoPerfil)", () => {
  it("o perfil que é o Pessoal da casa leva a casa junto", async () => {
    const ctx = await contextoDoPerfil({ id: "ana", role: "CLIENT" }, { id: "pessoal-ana", theme: "padrao", kind: "PESSOAL" });
    expect(ctx).toMatchObject({ userId: "ana", profileId: "pessoal-ana", casa });
  });

  it("outro perfil (a Empresa dela) fica sem a casa: a Empresa é só dela", async () => {
    const ctx = await contextoDoPerfil({ id: "ana", role: "CLIENT" }, { id: "empresa-ana", theme: "padrao", kind: "EMPRESA" });
    expect(ctx.casa).toBeNull();
  });
});
