import { describe, expect, it, vi } from "vitest";
import { parseUsdText } from "../us-price";

describe("cotação americana", () => {
  it("não pergunta ao Yahoo, que proíbe uso em app pago", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => { urls.push(String(u)); return new Response("<div class='_card cotacao'>US$ 716,86</div>"); }));
    const { fetchUsPrice } = await import("../us-price");
    expect(await fetchUsPrice("VOO")).toBe(716.86);
    expect(urls.every((u) => u.includes("investidor10.com.br"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("lê o US$ do investidor10 e ignora o R$ do lado", () => {
    expect(parseUsdText(" Valor atual US$ 716,86 R$ 3.598,64 ")).toBe(716.86);
    expect(parseUsdText("Cotação US$ 1.334,88")).toBe(1334.88);
    expect(parseUsdText("R$ 38,10")).toBeNull();
  });
});
