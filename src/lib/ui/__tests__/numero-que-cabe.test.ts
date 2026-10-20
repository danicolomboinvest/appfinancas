import { describe, expect, it } from "vitest";
import { classeDoSaldoNoCartao, classeDoVisor } from "../numero-que-cabe";

describe("números grandes que cabem (pesos argentinos, 20/10/2026)", () => {
  it("visor do Digitar: valor de todo dia fica grande; em pesos diminui", () => {
    expect(classeDoVisor("R$ 45,90")).toBe("text-[2.5rem]");
    expect(classeDoVisor("R$ 2.500.000,00")).toContain("max-[359px]:text-[2.125rem]");
    expect(classeDoVisor("ARS 2.500.000,00")).toContain("text-[2.125rem] max-[359px]:text-[1.75rem]");
    expect(classeDoVisor("ARS 125.000.000,00")).toContain("text-[2.125rem]");
    expect(classeDoVisor("ARS 99.999.999,99 ")).toContain("text-[1.75rem]");
  });
  it("saldo no cartão de Dívidas: conta só o número, não o ARS na frente", () => {
    expect(classeDoSaldoNoCartao("R$ 1.800")).toBe("text-[clamp(1.375rem,6.5cqw,1.625rem)]");
    expect(classeDoSaldoNoCartao("ARS 504.000")).toBe("text-[clamp(1.375rem,6.5cqw,1.625rem)]");
    expect(classeDoSaldoNoCartao("ARS 1.680.000")).toContain("max-[359px]:text-[1.0625rem]");
    expect(classeDoSaldoNoCartao("ARS 12.500.000")).toContain("text-[1.25rem]");
    expect(classeDoSaldoNoCartao("ARS 1.250.000.000")).toContain("text-[1.0625rem]");
  });
});
