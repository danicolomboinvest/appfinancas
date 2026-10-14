import { describe, expect, it, vi } from "vitest";

const createProfile = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: async () => ({ userId: "ana", profileId: "pessoal", role: "CLIENT" }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/adicionais/acesso", () => ({ temAdicional: async () => true }));
vi.mock("@/lib/perfis/extras-liberados", () => ({ extrasLiberados: async () => ({ casal: true, empresa: true }) }));
vi.mock("@/lib/repositories/profile.repo", () => ({
  createProfile: (...a: unknown[]) => createProfile(...a),
  updateProfile: vi.fn(),
  switchProfile: vi.fn(),
  deleteProfile: vi.fn(),
  // A lista que a tela mostra esconde o Casal que virou casa simples...
  listProfiles: async () => [{ id: "pessoal", name: "Pessoal", kind: "PESSOAL", isDefault: true }],
  // ...mas ele segura o lugar do Nós dois.
  perfisDosLugares: async () => [
    { id: "pessoal", name: "Pessoal", kind: "PESSOAL", isDefault: true },
    { id: "casal", name: "Nós dois", kind: "CASAL", isDefault: false },
  ],
}));

const { criarPerfilAction } = await import("../actions");

describe("criarPerfilAction com casa simples", () => {
  it("quem já está numa casa não cria um segundo Nós dois", async () => {
    const r = await criarPerfilAction({ name: "Nós dois", kind: "CASAL" });
    expect(r.ok).toBe(false);
    expect(createProfile).not.toHaveBeenCalled();
  });
});
