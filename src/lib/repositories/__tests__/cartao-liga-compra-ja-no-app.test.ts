import { describe, expect, it, vi } from "vitest";

/**
 * Fatura do Mercado Pago lida antes de o cartão existir (20/10/2026): a compra ficou sem cartão e,
 * mesmo reenviando a fatura, só o lote novo era ligado. A parcela de R$ 25,61 não entrava no total
 * do cartão (R$ 73,80 no app contra R$ 99,40 da fatura).
 */
const updateMany = vi.fn(async (...args: [{ where: Record<string, unknown>; data: Record<string, unknown> }]) => ({ count: args.length }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { monthlyEntry: { updateMany } } }));

const { ligarComprasJaNoAppAoCartao } = await import("../cartao.repo");

const ctx = { userId: "u1", profileId: "p1" } as never;
const cartao = { id: "c-mp", banco: "mercadopago", apelido: null, diaFechamento: 12, diaVencimento: 17, final: "0975" } as never;

describe("ligar ao cartão a compra que já estava no app", () => {
  it("liga só compra de fatura, sem cartão, do mesmo mês, nome e valor", async () => {
    const n = await ligarComprasJaNoAppAoCartao(ctx, cartao, [
      { profileId: "p1", year: 2026, month: 10, description: "MERCADOLIVRE*MERCADOLIVRE Parcela 2 de 3", amount: 25.61 },
    ]);
    expect(n).toBe(1);
    const { where, data } = updateMany.mock.calls[0][0];
    expect(data).toEqual({ cartaoId: "c-mp", noCartao: true });
    expect(where).toMatchObject({ userId: "u1", profileId: "p1", category: "EXPENSE", cartaoId: null, year: 2026, month: 10, amount: 25.61 });
    expect(where.importBatch).toEqual({ is: { docType: "fatura" } });
  });

  it("compra de outro perfil não é ligada", async () => {
    updateMany.mockClear();
    expect(await ligarComprasJaNoAppAoCartao(ctx, cartao, [{ profileId: "empresa", year: 2026, month: 10, description: "X", amount: 1 }])).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("sem compras, não mexe no banco", async () => {
    updateMany.mockClear();
    expect(await ligarComprasJaNoAppAoCartao(ctx, cartao, [])).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
