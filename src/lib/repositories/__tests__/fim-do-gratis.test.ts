import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fim do grátis (30/09/2026), do jeito que a Dani decidiu:
 *  - quem comprou usa tudo; conta nova só com compra (o cadastro barra, ver cadastro-e-confirmacao);
 *  - quem criou conta no tempo do grátis, sem compra, continua com a parte grátis;
 *  - reembolso e cancelamento perdem tudo, inclusive quem era do tempo do grátis;
 *  - convite VIP usa tudo e o webhook do Hubla nunca desliga.
 */

const updateMany = vi.fn();
const findMany = vi.fn();
vi.mock("@/lib/db/prisma", () => ({
  prisma: { allowedEmail: { updateMany: (a: unknown) => updateMany(a), findMany: (a: unknown) => findMany(a) } },
}));

const { usoDoApp, FIM_DO_GRATIS, revokeFromHubla, contasQueUsamOApp, NOTA_DO_CONVITE_VIP } = await import("../allowedEmail.repo");

const antes = new Date(FIM_DO_GRATIS.getTime() - 60_000);
const depois = new Date(FIM_DO_GRATIS.getTime() + 60_000);

beforeEach(() => {
  updateMany.mockReset().mockResolvedValue({ count: 1 });
  findMany.mockReset();
});

describe("usoDoApp", () => {
  it("compra valendo usa tudo, criada quando for", () => {
    expect(usoDoApp("ativo", antes)).toBe("completo");
    expect(usoDoApp("ativo", depois)).toBe("completo");
  });
  it("sem compra, criada no tempo do grátis: continua com a parte grátis", () => {
    expect(usoDoApp("sem-compra", antes)).toBe("gratis");
  });
  it("sem compra, criada depois do fim: bloqueada", () => {
    expect(usoDoApp("sem-compra", depois)).toBe("bloqueado");
  });
  it("reembolso ou cancelamento perde tudo, mesmo quem é do tempo do grátis", () => {
    expect(usoDoApp("encerrado", antes)).toBe("bloqueado");
    expect(usoDoApp("vencido", antes)).toBe("bloqueado");
  });
});

describe("contasQueUsamOApp (quem ainda recebe resumo e alertas)", () => {
  it("fica quem comprou e quem sobrou do grátis; sai reembolso e conta nova sem compra", async () => {
    findMany.mockResolvedValue([
      { email: "comprou@x.com", active: true, expiresAt: null },
      { email: "reembolso@x.com", active: false, expiresAt: null },
    ]);
    const r = await contasQueUsamOApp([
      { email: "Comprou@X.com", createdAt: depois },
      { email: "reembolso@x.com", createdAt: antes },
      { email: "gratis@x.com", createdAt: antes },
      { email: "nova@x.com", createdAt: depois },
    ]);
    expect([...r].sort()).toEqual(["comprou@x.com", "gratis@x.com"]);
  });
});

describe("revokeFromHubla", () => {
  it("nunca desliga convite VIP, e a trava não deixa escapar liberação sem nota", async () => {
    await revokeFromHubla(" Pessoa@X.com ");
    const { where } = updateMany.mock.calls[0][0];
    expect(where.email).toBe("pessoa@x.com");
    expect(where.AND).toEqual([{ OR: [{ note: null }, { NOT: { note: { startsWith: NOTA_DO_CONVITE_VIP } } }] }]);
  });
});
