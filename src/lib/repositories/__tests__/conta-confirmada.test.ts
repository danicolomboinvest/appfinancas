import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Quem assinou pela Apple entra sem confirmar o e-mail, nas três portas (06/10/2026).
 *
 * Em 05/10 o layout do app deixava passar e o /comecar não: o layout mandava para o /comecar
 * (primeira entrada), o /comecar devolvia para o app (e-mail sem confirmar), e assim sem parar.
 * Metade de quem assinou no iPhone pagou e nunca conseguiu entrar.
 */

const liberacao = vi.fn<() => Promise<{ source: string } | null>>(async () => null);
const assinaturas = vi.fn<() => Promise<number>>(async () => 0);
const usuario = vi.fn<() => Promise<unknown>>(async () => null);

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    allowedEmail: { findUnique: () => liberacao() },
    assinaturaApple: { count: () => assinaturas() },
    user: { findUnique: () => usuario() },
  },
}));

const { contaConfirmada, hasPremiumAccess } = await import("../allowedEmail.repo");

// Conta criada depois da regra da confirmação (30/09/2026), sem ter clicado no link.
const novaSemConfirmar = { id: "u1", email: "ana@exemplo.com", emailVerifiedAt: null, createdAt: new Date("2026-10-05T23:55:00Z") };

describe("contaConfirmada", () => {
  beforeEach(() => {
    liberacao.mockResolvedValue(null);
    assinaturas.mockResolvedValue(0);
  });

  it("e-mail confirmado entra", async () => {
    expect(await contaConfirmada({ ...novaSemConfirmar, emailVerifiedAt: new Date() })).toBe(true);
  });

  it("assinou pela Apple a partir desta conta: entra sem confirmar", async () => {
    liberacao.mockResolvedValue({ source: "APPLE" });
    assinaturas.mockResolvedValue(1);
    expect(await contaConfirmada(novaSemConfirmar)).toBe(true);
  });

  it("e-mail com compra do Hubla continua pedindo a confirmação, mesmo com assinatura Apple", async () => {
    liberacao.mockResolvedValue({ source: "HUBLA" });
    assinaturas.mockResolvedValue(1);
    expect(await contaConfirmada(novaSemConfirmar)).toBe(false);
  });

  it("liberação da Apple sem assinatura valendo nesta conta não basta", async () => {
    liberacao.mockResolvedValue({ source: "APPLE" });
    assinaturas.mockResolvedValue(0);
    expect(await contaConfirmada(novaSemConfirmar)).toBe(false);
  });

  it("a área de investimentos abre para quem assinou pela Apple", async () => {
    usuario.mockResolvedValue({ ...novaSemConfirmar, role: "CLIENT" });
    assinaturas.mockResolvedValue(1);
    // isEmailAllowed também lê a liberação: devolve uma da Apple, ativa e dentro do prazo.
    liberacao.mockResolvedValue({ source: "APPLE", active: true, expiresAt: new Date("2027-10-06T00:00:00Z") } as never);
    expect(await hasPremiumAccess("u1")).toBe(true);
  });
});

describe("as três portas usam a mesma regra", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it.each([
    ["layout do app", "src/app/(app)/layout.tsx"],
    ["/comecar", "src/app/(onboarding)/comecar/page.tsx"],
  ])("%s pergunta contaConfirmada, não emailConfirmado", (_nome, arquivo) => {
    const fonte = ler(arquivo);
    expect(fonte).toContain("contaConfirmada(user)");
    expect(fonte).not.toMatch(/emailConfirmado\(/);
  });

  it("a área de investimentos (hasPremiumAccess) também", () => {
    const fonte = ler("src/lib/repositories/allowedEmail.repo.ts");
    const corpo = fonte.slice(fonte.indexOf("export async function hasPremiumAccess"));
    expect(corpo.slice(0, corpo.indexOf("\n}\n"))).toContain("contaConfirmada(user)");
  });
});
