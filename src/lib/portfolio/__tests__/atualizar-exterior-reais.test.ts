import { beforeEach, describe, expect, it, vi } from "vitest";

/** A conta em reais de quem usa o app em peso chileno acompanha o câmbio todo dia (20/10/2026). */
const findMany = vi.fn(async (..._a: unknown[]) => [] as unknown[]);
const update = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { asset: { findMany: (...a: unknown[]) => findMany(...a), update: (...a: unknown[]) => update(...a) } } }));
vi.mock("@/lib/fx/rates", () => ({ getExchangeRate: vi.fn(async (de: string, para: string) => (de === "BRL" && para === "CLP" ? { rate: 180 } : de === "USD" && para === "CLP" ? { rate: 1000 } : null)) }));
vi.mock("@/lib/analysis/price-scraper", () => ({ fetchTickerPrice: vi.fn(async () => 40) }));
vi.mock("@/lib/analysis/us-price", () => ({ fetchUsPrice: vi.fn(async () => 500) }));

const { atualizarAtivosDoExterior } = await import("../atualizar-exterior");

beforeEach(() => {
  findMany.mockReset();
  update.mockClear();
});

describe("câmbio da noite", () => {
  it("busca também os ativos em reais que guardam o lado em R$", async () => {
    findMany.mockResolvedValue([]);
    await atualizarAtivosDoExterior({ userId: "u1" });
    const where = (findMany.mock.calls[0][0] as { where: { OR: unknown[] } }).where;
    expect(where.OR).toContainEqual({ nativeCurrentValue: { not: null } });
  });

  it("Tesouro em R$ 1.000 refaz a conta em pesos com o câmbio do dia", async () => {
    findMany.mockResolvedValue([{ id: "a1", ticker: null, quantity: null, currency: "BRL", nativeCurrentValue: 1000, user: { currency: "CLP" } }]);
    const r = await atualizarAtivosDoExterior({ userId: "u1" });
    expect(r.updated).toBe(1);
    expect(update.mock.calls[0][0]).toMatchObject({ where: { id: "a1" }, data: { nativeCurrentValue: 1000, currentValue: 180000, exchangeRate: 180 } });
  });

  it("PETR4 em reais: a cotação da B3 (R$ 40) × quantidade vira o lado em R$ e depois pesos", async () => {
    findMany.mockResolvedValue([{ id: "a2", ticker: "PETR4", quantity: 10, currency: "BRL", nativeCurrentValue: 350, user: { currency: "CLP" } }]);
    await atualizarAtivosDoExterior({ userId: "u1" });
    expect(update.mock.calls[0][0]).toMatchObject({ data: { nativeCurrentValue: 400, currentValue: 72000, exchangeRate: 180 } });
  });

  it("dólar segue igual: VOO US$ 500 × 2 cotas × dólar de 1.000 pesos", async () => {
    findMany.mockResolvedValue([{ id: "a3", ticker: "VOO", quantity: 2, currency: "USD", nativeCurrentValue: 900, user: { currency: "CLP" } }]);
    await atualizarAtivosDoExterior({ userId: "u1" });
    expect(update.mock.calls[0][0]).toMatchObject({ data: { nativeCurrentValue: 1000, currentValue: 1000000, exchangeRate: 1000 } });
  });
});
