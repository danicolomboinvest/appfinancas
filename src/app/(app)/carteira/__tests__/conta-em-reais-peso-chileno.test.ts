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
import { formularioDoNovoAtivo, type Achado } from "../novo-ativo-dados";

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

describe("Novo ativo rápido (busca) para quem usa o app em peso chileno (30/10/2026)", () => {
  const base = { investido: 0, valorHoje: 0, qtd: 0, precoMedio: 0, cotacao: null, rendimento: null, naoSei: false, fundo: null, meta: "nenhuma", qtdTitulos: 0, modoHoje: "valor" as const, taxaTxt: "", taxaNaoSei: true, quando: null };

  it("10 ações a R$ 30 entram em reais e viram pesos pelo câmbio do dia, não '$ 300' pesos", async () => {
    const x: Achado = { k: "bolsa", nome: "Petrobras", sub: "", ticker: "PETR4", classe: "ACAO" };
    const fd = formularioDoNovoAtivo({ ...base, x, qtd: 10, precoMedio: 30, valorHoje: 400, cotacao: 40, moedaDoApp: "CLP" });
    expect(fd.get("assetCurrency")).toBe("BRL");
    expect(fd.get("assetNativo")).toBe("1");
    await createAssetAction({}, fd);
    // Investido R$ 300 e hoje 10 × R$ 40 (cotação em reais): o lado em R$ fica, a conta em pesos pelo câmbio 170.
    expect(salvo()).toMatchObject({ currency: "BRL", quantity: 10, nativeInvestedValue: 300, nativeCurrentValue: 400, exchangeRate: 170, investedValue: 51000, currentValue: 68000 });
  });

  it("Tesouro e CDB digitados em reais também convertem", async () => {
    const tesouro: Achado = { k: "tesouro", nome: "Tesouro Selic 2029", sub: "", titulo: null };
    await createAssetAction({}, formularioDoNovoAtivo({ ...base, x: tesouro, investido: 1000, valorHoje: 1100, moedaDoApp: "CLP" }));
    expect(salvo()).toMatchObject({ currency: "BRL", nativeInvestedValue: 1000, nativeCurrentValue: 1100, exchangeRate: 170, investedValue: 170000, currentValue: 187000 });
    const cdb: Achado = { k: "rf", nome: "CDB Inter", sub: "" };
    await createAssetAction({}, formularioDoNovoAtivo({ ...base, x: cdb, investido: 500, valorHoje: 520, rendimento: { indexador: "cdi", percentual: 100 }, moedaDoApp: "CLP" }));
    expect(salvo()).toMatchObject({ currency: "BRL", nativeCurrentValue: 520, currentValue: 88400 });
  });

  it("o exterior continua em dólar, e quem usa o app em reais não muda nada", async () => {
    const voo: Achado = { k: "ext", nome: "VOO", sub: "", ticker: "VOO" };
    const fdExt = formularioDoNovoAtivo({ ...base, x: voo, qtd: 1, precoMedio: 400, cotacao: 500, moedaDoApp: "CLP" });
    expect(fdExt.get("assetCurrency")).toBe("USD");
    expect(fdExt.get("assetNativo")).toBeNull();

    moedaDoApp = "BRL";
    const x: Achado = { k: "bolsa", nome: "Petrobras", sub: "", ticker: "PETR4", classe: "ACAO" };
    const fd = formularioDoNovoAtivo({ ...base, x, qtd: 10, precoMedio: 30, valorHoje: 400, cotacao: 40, moedaDoApp: "BRL" });
    expect(fd.get("assetCurrency")).toBeNull();
    expect(fd.get("assetNativo")).toBeNull();
    await createAssetAction({}, fd);
    expect(salvo()).toMatchObject({ currency: "BRL", quantity: 10, investedValue: 300, currentValue: 400 });
    expect(salvo().nativeCurrentValue).toBeNull();
    // Sem a moeda (quem chama de antes): igual a reais.
    expect(formularioDoNovoAtivo({ ...base, x, qtd: 10, precoMedio: 30, valorHoje: 400, cotacao: 40 }).get("assetNativo")).toBeNull();
  });
});
