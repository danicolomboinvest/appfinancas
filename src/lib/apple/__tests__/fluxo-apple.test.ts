import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JWSTransactionDecodedPayload } from "@apple/app-store-server-library";

// Banco em memória só com o que o fluxo da Apple usa.
const db = vi.hoisted(() => ({
  assinaturas: new Map<string, { originalTransactionId: string; userId: string; productId: string; expiresAt: Date; revogadaEm: Date | null }>(),
  liberacoes: new Map<string, { source: string; active: boolean; expiresAt: Date | null; lastHublaInvoiceId: string | null }>(),
  users: [] as { id: string; email: string; tokenApple: string | null }[],
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    assinaturaApple: {
      findUnique: async ({ where }: { where: { originalTransactionId: string } }) => {
        const a = db.assinaturas.get(where.originalTransactionId);
        if (!a) return null;
        const user = db.users.find((u) => u.id === a.userId)!;
        return { ...a, user };
      },
      upsert: async ({ where, update, create }: { where: { originalTransactionId: string }; update: object; create: object }) => {
        const a = db.assinaturas.get(where.originalTransactionId);
        db.assinaturas.set(where.originalTransactionId, a ? { ...a, ...update } : (create as never));
      },
      create: async ({ data }: { data: never }) => void db.assinaturas.set((data as { originalTransactionId: string }).originalTransactionId, data),
      update: async ({ where, data }: { where: { originalTransactionId: string }; data: object }) =>
        void db.assinaturas.set(where.originalTransactionId, { ...db.assinaturas.get(where.originalTransactionId)!, ...data }),
    },
    allowedEmail: {
      findUnique: async ({ where }: { where: { email: string } }) => db.liberacoes.get(where.email) ?? null,
      upsert: async ({ where, update, create }: { where: { email: string }; update: object; create: object }) => {
        const l = db.liberacoes.get(where.email);
        db.liberacoes.set(where.email, l ? { ...l, ...update } : { lastHublaInvoiceId: null, ...(create as object) } as never);
      },
      update: async ({ where, data }: { where: { email: string }; data: object }) => void db.liberacoes.set(where.email, { ...db.liberacoes.get(where.email)!, ...data }),
    },
    user: {
      findUnique: async ({ where }: { where: { tokenApple: string } }) => db.users.find((u) => u.tokenApple === where.tokenApple) ?? null,
      updateMany: async ({ where, data }: { where: { id: string }; data: { tokenApple: string } }) => {
        const u = db.users.find((x) => x.id === where.id);
        if (u && !u.tokenApple) u.tokenApple = data.tokenApple;
      },
    },
  },
}));

import { tokenDaConta, PRODUTOS_APPLE } from "../config";
import { aplicarAvisoApple, guardarTokenApple, registrarCompraApple } from "@/lib/repositories/assinaturaApple.repo";

const ana = { id: "u1", email: "ana@exemplo.com" };
const dia = (d: string) => new Date(`2026-${d}T12:00:00Z`).getTime();
const compra = (extra: Partial<JWSTransactionDecodedPayload> = {}): JWSTransactionDecodedPayload => ({
  originalTransactionId: "T1",
  productId: PRODUTOS_APPLE.anual,
  appAccountToken: tokenDaConta(ana.email),
  purchaseDate: dia("09-30"),
  expiresDate: Date.now() + 365 * 864e5,
  ...extra,
});

beforeEach(() => {
  db.assinaturas.clear();
  db.liberacoes.clear();
  db.users.splice(0, db.users.length, { ...ana, tokenApple: null });
});

describe("fluxo da assinatura pela Apple", () => {
  it("compra libera; reembolso corta; o recibo guardado da compra não reabre", async () => {
    expect((await registrarCompraApple(ana, compra())).ok).toBe(true);
    expect(db.liberacoes.get(ana.email)).toMatchObject({ source: "APPLE", active: true });

    expect(await aplicarAvisoApple("REFUND", compra())).toBe("revogou");
    expect(db.liberacoes.get(ana.email)?.active).toBe(false);

    expect(await registrarCompraApple(ana, compra())).toEqual({ ok: false, motivo: "sem-validade" });
    expect(db.liberacoes.get(ana.email)?.active).toBe(false);
  });

  it("aviso de renovação velho, chegando depois do reembolso, não reabre", async () => {
    await registrarCompraApple(ana, compra());
    await aplicarAvisoApple("REFUND", compra());
    expect(await aplicarAvisoApple("DID_RENEW", compra())).toBe("ignorado");
    expect(db.liberacoes.get(ana.email)?.active).toBe(false);
  });

  it("recibo de outra conta não passa", async () => {
    const r = await registrarCompraApple(ana, compra({ appAccountToken: tokenDaConta("outra@exemplo.com") }));
    expect(r).toEqual({ ok: false, motivo: "outra-conta" });
  });

  it("compra aprovada depois (Pedir para comprar): o aviso da Apple libera sozinho pela conta do token", async () => {
    await guardarTokenApple(ana);
    expect(await aplicarAvisoApple("SUBSCRIBED", compra())).toBe("renovou");
    expect(db.liberacoes.get(ana.email)).toMatchObject({ source: "APPLE", active: true });
  });

  it("reembolso que chega antes do registro fica gravado e o recibo depois não libera", async () => {
    await guardarTokenApple(ana);
    expect(await aplicarAvisoApple("REFUND", compra())).toBe("revogou");
    expect((await registrarCompraApple(ana, compra())).ok).toBe(false);
  });

  it("Hubla vencida que vira Apple: reembolso da Apple corta (a fatura velha do Hubla não protege)", async () => {
    db.liberacoes.set(ana.email, { source: "HUBLA", active: true, expiresAt: new Date(dia("09-01")), lastHublaInvoiceId: "inv_velha" });
    await registrarCompraApple(ana, compra());
    await aplicarAvisoApple("REFUND", compra());
    expect(db.liberacoes.get(ana.email)?.active).toBe(false);
  });
});
