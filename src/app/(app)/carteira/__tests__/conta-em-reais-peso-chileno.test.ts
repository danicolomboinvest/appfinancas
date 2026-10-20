import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Quem usa o app em peso chileno e investe em reais e em dólar (20/10/2026, pedido dela): digita em
 * R$ ou US$ e o app grava o valor na moeda do ativo e a conta em pesos pelo câmbio do dia. Passa
 * pelo createAssetAction de verdade; só o banco e as cotações são de mentira.
 */
const createAsset = vi.fn<(ctx: unknown, data: Record<string, unknown>) => Promise<{ id: string }>>(async () => ({ id: "a1" }));
let moedaDoApp = "CLP";
const taxas: Record<string, number> = { "BRL>CLP": 170, "USD>CLP": 950, "USD>BRL": 5.5 };
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "p1" })) }));
vi.mock("@/lib/repositories/user.repo", () => ({ getOwnUser: vi.fn(async () => ({ currency: moedaDoApp })) }));
vi.mock("@/lib/repositories/asset.repo", () => ({ createAsset: (ctx: unknown, d: Record<string, unknown>) => createAsset(ctx, d), updateOwnAsset: vi.fn(), deleteOwnAsset: vi.fn() }));
vi.mock("@/lib/repositories/dividend.repo", () => ({ refreshDividendsForTicker: vi.fn() }));
vi.mock("@/lib/analysis/price-scraper", () => ({ fetchTickerPrice: vi.fn(async () => 40) }));
vi.mock("@/lib/analysis/us-price", () => ({ fetchUsPrice: vi.fn(async () => 500) }));
vi.mock("@/lib/fx/rates", () => ({ getExchangeRate: vi.fn(async (de: string, para: string) => (taxas[`${de}>${para}`] ? { rate: taxas[`${de}>${para}`] } : null)) }));
vi.mock("@/lib/portfolio/atualizar-renda-fixa", () => ({ recalcularUmAtivo: vi.fn(async () => {}) }));

import { createAssetAction } from "../actions";

function formulario(campos: Record<string, string>) {
  const f = new FormData();
  const base: Record<string, string> = { name: "Tesouro Selic", assetClass: "TESOURO_DIRETO", objective: "OUTRO", currentValue: "1000", investedValue: "800" };
  for (const [k, v] of Object.entries({ ...base, ...campos })) f.set(k, v);
  return f;
}
const salvo = () => createAsset.mock.calls.at(-1)![1];

beforeEach(() => {
  createAsset.mockClear();
  moedaDoApp = "CLP";
});

describe("investimento em reais para quem usa o app em peso chileno", () => {
  it("digita em R$ e o app guarda os reais e a conta em pesos pelo câmbio do dia", async () => {
    const r = await createAssetAction({}, formulario({ assetCurrency: "BRL", assetNativo: "1" }));
    expect(r).toEqual({});
    expect(salvo()).toMatchObject({ currency: "BRL", nativeCurrentValue: 1000, nativeInvestedValue: 800, exchangeRate: 170, currentValue: 170000, investedValue: 136000 });
  });

  it("a conta 'Minha conta' segue como sempre: o que ela digita já é em pesos", async () => {
    await createAssetAction({}, formulario({ assetCurrency: "BRL" }));
    expect(salvo()).toMatchObject({ currency: "BRL", currentValue: 1000, investedValue: 800 });
    expect(salvo().nativeCurrentValue).toBeNull();
  });

  it("em dólar: US$ digitado vira pesos pelo dólar do dia", async () => {
    await createAssetAction({}, formulario({ assetCurrency: "USD", name: "VOO", assetClass: "INTERNACIONAL" }));
    expect(salvo()).toMatchObject({ currency: "USD", nativeCurrentValue: 1000, exchangeRate: 950, currentValue: 950000 });
  });

  it("ação da B3 em reais: quantidade × cotação em R$, convertida para pesos", async () => {
    await createAssetAction({}, formulario({ assetCurrency: "BRL", assetNativo: "1", name: "Petrobras", ticker: "PETR4", assetClass: "ACAO", quantity: "10", currentValue: "", investedValue: "350" }));
    expect(salvo()).toMatchObject({ nativeCurrentValue: 400, currentValue: 68000, exchangeRate: 170 });
  });

  it("sem cotação do câmbio: não grava (nunca reais com o símbolo do peso)", async () => {
    taxas["BRL>CLP"] = 0;
    const r = await createAssetAction({}, formulario({ assetCurrency: "BRL", assetNativo: "1" }));
    taxas["BRL>CLP"] = 170;
    expect(r.error).toMatch(/cota/i);
    expect(createAsset).not.toHaveBeenCalled();
  });

  it("quem usa reais não é afetado: o pedido de conversão é ignorado", async () => {
    moedaDoApp = "BRL";
    await createAssetAction({}, formulario({ assetCurrency: "BRL", assetNativo: "1" }));
    expect(salvo()).toMatchObject({ currency: "BRL", currentValue: 1000 });
    expect(salvo().nativeCurrentValue).toBeNull();
  });
});
