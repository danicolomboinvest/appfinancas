import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Juntar a compra à conta (07/10/2026): só com o código que chegou no e-mail da compra, só
 * compra valendo, nunca o e-mail de outra conta, e com trava para quem tenta adivinhar.
 */

type Token = { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null; createdAt: Date };
const tokens: Token[] = [];
const usuarios = [
  { id: "u1", email: "conta@gmail.com", emailVerifiedAt: null as Date | null },
  { id: "u2", email: "outra@gmail.com", emailVerifiedAt: null as Date | null },
];
const compras: Record<string, { active: boolean; expiresAt: Date | null }> = {
  "compra@gmail.com": { active: true, expiresAt: null },
  "reembolso@gmail.com": { active: false, expiresAt: null },
  "outra@gmail.com": { active: true, expiresAt: null },
};
let ultimoEmail: { to: string; subject: string } | null = null;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async (p: { to: string; subject: string }) => {
    ultimoEmail = p;
    return { ok: true };
  }),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    allowedEmail: { findUnique: vi.fn(async ({ where }: { where: { email: string } }) => compras[where.email] ?? null) },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => usuarios.find((u) => u.id === where.id) ?? null),
      findFirst: vi.fn(async ({ where }: { where: { email: { equals: string }; NOT: { id: string } } }) =>
        usuarios.find((u) => u.email.toLowerCase() === where.email.equals.toLowerCase() && u.id !== where.NOT.id) ?? null,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { email: string; emailVerifiedAt: Date } }) => {
        const u = usuarios.find((x) => x.id === where.id)!;
        Object.assign(u, data);
        return u;
      }),
    },
    passwordResetToken: {
      count: vi.fn(async ({ where }: { where: { userId: string; tokenHash: { startsWith: string }; createdAt: { gte: Date } } }) =>
        tokens.filter((t) => t.userId === where.userId && t.tokenHash.startsWith(where.tokenHash.startsWith) && t.createdAt >= where.createdAt.gte).length,
      ),
      create: vi.fn(async ({ data }: { data: Omit<Token, "id" | "createdAt" | "usedAt"> & { usedAt?: Date } }) => {
        const t = { id: `t${tokens.length}`, createdAt: new Date(), usedAt: data.usedAt ?? null, ...data };
        tokens.push(t);
        return t;
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => tokens.find((t) => t.tokenHash === where.tokenHash) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { usedAt: Date } }) => Object.assign(tokens.find((t) => t.id === where.id)!, data)),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

const { pedirCodigoDaCompra, confirmarCodigoDaCompra } = await import("../juntar-compra");
const codigoDoEmail = () => ultimoEmail!.subject.slice(0, 6);

beforeEach(() => {
  tokens.length = 0;
  usuarios[0].email = "conta@gmail.com";
  usuarios[0].emailVerifiedAt = null;
  ultimoEmail = null;
});

describe("juntar a compra à conta", () => {
  it("manda o código para o e-mail da compra e, com ele, a conta passa a usar esse e-mail", async () => {
    expect(await pedirCodigoDaCompra("u1", " Compra@Gmail.com ")).toEqual({ ok: true, email: "compra@gmail.com" });
    expect(ultimoEmail!.to).toBe("compra@gmail.com");
    expect(await confirmarCodigoDaCompra("u1", "compra@gmail.com", codigoDoEmail())).toEqual({ ok: true, email: "compra@gmail.com" });
    expect(usuarios[0].email).toBe("compra@gmail.com");
    expect(usuarios[0].emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("o código não serve duas vezes", async () => {
    await pedirCodigoDaCompra("u1", "compra@gmail.com");
    const codigo = codigoDoEmail();
    await confirmarCodigoDaCompra("u1", "compra@gmail.com", codigo);
    usuarios[0].email = "conta@gmail.com";
    expect((await confirmarCodigoDaCompra("u1", "compra@gmail.com", codigo)).ok).toBe(false);
  });

  it("recusa compra encerrada, sem compra, e e-mail que já é de outra conta", async () => {
    expect((await pedirCodigoDaCompra("u1", "reembolso@gmail.com")).ok).toBe(false);
    expect((await pedirCodigoDaCompra("u1", "ninguem@gmail.com")).ok).toBe(false);
    expect(await pedirCodigoDaCompra("u1", "outra@gmail.com")).toEqual({ ok: false, erro: "Esse e-mail já tem uma conta no app. Saia desta e entre com ele." });
    expect(ultimoEmail).toBeNull();
  });

  it("código de uma compra não vale para outro e-mail nem para outra conta", async () => {
    await pedirCodigoDaCompra("u1", "compra@gmail.com");
    const codigo = codigoDoEmail();
    expect((await confirmarCodigoDaCompra("u2", "compra@gmail.com", codigo)).ok).toBe(false);
    expect((await confirmarCodigoDaCompra("u1", "outro@gmail.com", codigo)).ok).toBe(false);
  });

  it("trava depois de 5 códigos errados", async () => {
    await pedirCodigoDaCompra("u1", "compra@gmail.com");
    const certo = codigoDoEmail();
    const errado = certo === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await confirmarCodigoDaCompra("u1", "compra@gmail.com", errado);
    expect(await confirmarCodigoDaCompra("u1", "compra@gmail.com", certo)).toEqual({ ok: false, erro: "Muitas tentativas. Peça um código novo daqui a pouco." });
  });

  it("no máximo 4 códigos por hora", async () => {
    for (let i = 0; i < 4; i++) expect((await pedirCodigoDaCompra("u1", "compra@gmail.com")).ok).toBe(true);
    expect((await pedirCodigoDaCompra("u1", "compra@gmail.com")).ok).toBe(false);
  });
});
