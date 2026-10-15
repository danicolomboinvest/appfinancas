import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Novo ativo pela busca (14/10/2026): o que ela digita é o que fica salvo. Passa pelo
 * createAssetAction de verdade; só o banco e as fontes de cotação são de mentira.
 */
const createAsset = vi.fn<(ctx: unknown, data: Record<string, unknown>) => Promise<{ id: string }>>(async () => ({ id: "a1" }));
const recalcularUmAtivo = vi.fn(async () => {});
const fetchTickerPrice = vi.fn<(t: string) => Promise<number | null>>(async () => null);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/components/money/MoneyProvider", () => ({ useCurrency: () => "BRL" }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "p1" })) }));
vi.mock("@/lib/repositories/user.repo", () => ({ getOwnUser: vi.fn(async () => ({ currency: "BRL" })) }));
vi.mock("@/lib/repositories/asset.repo", () => ({ createAsset: (ctx: unknown, d: Record<string, unknown>) => createAsset(ctx, d), updateOwnAsset: vi.fn(), deleteOwnAsset: vi.fn() }));
vi.mock("@/lib/repositories/dividend.repo", () => ({ refreshDividendsForTicker: vi.fn() }));
vi.mock("@/lib/analysis/price-scraper", () => ({ fetchTickerPrice: (t: string) => fetchTickerPrice(t) }));
vi.mock("@/lib/analysis/us-price", () => ({ fetchUsPrice: vi.fn(async () => null) }));
vi.mock("@/lib/fx/rates", () => ({ getExchangeRate: vi.fn(async () => ({ rate: 5 })) }));
vi.mock("@/lib/portfolio/atualizar-renda-fixa", () => ({ recalcularUmAtivo: (...a: unknown[]) => recalcularUmAtivo(...(a as [])) }));

import { createAssetAction } from "../actions";
import { buscarLocal, formularioDoNovoAtivo, lerCotas, nomeDoFundo, type Achado } from "../novo-ativo-dados";
import { digitar } from "@/components/ui/__tests__/digitar-no-campo";

const base = { investido: 0, valorHoje: 0, qtd: 0, precoMedio: 0, cotacao: null, rendimento: null, naoSei: false, fundo: null, meta: "nenhuma", qtdTitulos: 0, modoHoje: "valor" as const, taxaTxt: "", taxaNaoSei: true, quando: null };
const salvo = () => createAsset.mock.calls.at(-1)![1];

beforeEach(() => {
  createAsset.mockClear();
  fetchTickerPrice.mockReset();
  fetchTickerPrice.mockResolvedValue(null);
});

describe("cotas", () => {
  it('"1.000" são mil cotas, "2,5" e "0.005" têm decimal', () => {
    expect(lerCotas("1.000")).toBe(1000);
    expect(lerCotas("12.500")).toBe(12500);
    expect(lerCotas("2,5")).toBe(2.5);
    expect(lerCotas("0.005")).toBe(0.005);
    expect(lerCotas("")).toBe(0);
    expect(lerCotas("abc")).toBe(0);
  });

  it("1.000 cotas de MXRF11 a R$ 9,62 salvam 1000 cotas e R$ 9.620 investidos", async () => {
    const x: Achado = { k: "bolsa", nome: "MXRF11", sub: "", ticker: "MXRF11", classe: "FII" };
    const qtd = lerCotas("1.000");
    const precoMedio = digitar("962") ?? 0;
    const r = await createAssetAction({}, formularioDoNovoAtivo({ ...base, x, qtd, precoMedio, valorHoje: qtd * precoMedio }));
    expect(r).toEqual({});
    expect(salvo()).toMatchObject({ quantity: 1000, investedValue: 9620, currentValue: 9620, assetClass: "FII" });
  });
});

describe("centavos", () => {
  it("CDB: 1234,56 investidos e 1300,10 hoje salvam 1234.56 e 1300.10", async () => {
    const x: Achado = { k: "rf", nome: "CDB Banco Inter", sub: "" };
    const investido = digitar("1234,56") ?? 0;
    const valorHoje = digitar("130010") ?? 0;
    await createAssetAction({}, formularioDoNovoAtivo({ ...base, x, investido, valorHoje, rendimento: { indexador: "cdi", percentual: 105 } }));
    expect(salvo()).toMatchObject({ investedValue: 1234.56, currentValue: 1300.1, fixedIncomeIndex: "POS_FIXADO", taxaCompra: 1.05, name: "CDB Banco Inter 105% do CDI" });
  });

  it("fundo: 0,99 vira 0.99 (não 99)", async () => {
    const x: Achado = { k: "fundo", nome: "Fundo verde", sub: "" };
    const v = digitar("0,99") ?? 0;
    await createAssetAction({}, formularioDoNovoAtivo({ ...base, x, investido: v, valorHoje: v, fundo: "mm" }));
    expect(salvo()).toMatchObject({ investedValue: 0.99, currentValue: 0.99, assetClass: "FUNDO", tipoEscolhido: "multimercado" });
  });

  it("exterior: preço médio US$ 50,25 × 10 cotas, com o dólar a R$ 5", async () => {
    const x: Achado = { k: "ext", nome: "VOO", sub: "", ticker: "VOO" };
    await createAssetAction({}, formularioDoNovoAtivo({ ...base, x, qtd: 10, precoMedio: digitar("5025") ?? 0, cotacao: 60 }));
    expect(salvo()).toMatchObject({ currency: "USD", nativeInvestedValue: 502.5, nativeCurrentValue: 600, investedValue: 2512.5, currentValue: 3000, quantity: 10 });
  });
});

describe("Tesouro sem a lista do dia", () => {
  it('"ipca" acha o Tesouro IPCA+ mesmo sem títulos gravados', () => {
    const r = buscarLocal("ipca", []);
    expect(r.filter((a) => a.k === "tesouro").map((a) => a.nome)).toEqual(["Tesouro IPCA+", "Tesouro IPCA+ com juros"]);
  });

  it('"tesouro" mostra os tipos; "pre" acha o prefixado', () => {
    expect(buscarLocal("tesouro", []).filter((a) => a.k === "tesouro").length).toBeGreaterThanOrEqual(5);
    expect(buscarLocal("pre", []).map((a) => a.nome)).toContain("Tesouro Prefixado");
  });

  it("com a lista do dia, ficam só os títulos de verdade", () => {
    const t = { nome: "Tesouro IPCA+ 2035", tipo: "Tesouro IPCA+", preco: 2000, taxa: 7.1, fonte: "Tesouro", quando: "hoje", velho: false };
    expect(buscarLocal("ipca", [t]).filter((a) => a.k === "tesouro").map((a) => a.nome)).toEqual(["Tesouro IPCA+ 2035"]);
  });

  it("o Tesouro IPCA+ genérico salva como IPCA, com a taxa da compra", async () => {
    const x = buscarLocal("ipca", [])[0];
    await createAssetAction({}, formularioDoNovoAtivo({ ...base, x, investido: 1000, valorHoje: 1050.5, taxaTxt: "6,5", taxaNaoSei: false, quando: { ano: 2026, mes: 1 } }));
    expect(salvo()).toMatchObject({ name: "Tesouro IPCA+", assetClass: "TESOURO_DIRETO", fixedIncomeIndex: "IPCA", taxaCompra: 0.065, investedValue: 1000, currentValue: 1050.5 });
  });

  it("o dia da compra vai junto (sem o dia, dia 1) e a renda fixa recalcula na hora", async () => {
    const x = buscarLocal("cdb", [])[0];
    const r = { indexador: "cdi" as const, percentual: 110 };
    await createAssetAction({}, formularioDoNovoAtivo({ ...base, x, investido: 1000, valorHoje: 1060, rendimento: r, quando: { ano: 2026, mes: 4, dia: 15 }, estimado: true }));
    expect(salvo()).toMatchObject({ assetClass: "RENDA_FIXA", taxaCompra: 1.1, acquisitionDate: new Date("2026-04-15T00:00:00Z"), valorInformado: null, valorInformadoEm: null });
    expect(recalcularUmAtivo).toHaveBeenCalled();
    await createAssetAction({}, formularioDoNovoAtivo({ ...base, x, investido: 1000, valorHoje: 1061.37, rendimento: r, quando: { ano: 2026, mes: 4 } }));
    expect(salvo()).toMatchObject({ acquisitionDate: new Date("2026-04-01T00:00:00Z"), valorInformado: 1061.37 });
  });
});

it('"É um fundo" guarda o nome com a primeira letra maiúscula', () => {
  expect(nomeDoFundo("  fundo verde ")).toBe("Fundo verde");
  expect(nomeDoFundo("ágora")).toBe("Ágora");
});
