import { describe, expect, it } from "vitest";
import { detectarVencimento } from "../vencimento";

// Textos FICTÍCIOS, no formato que o extrator de PDF devolve (rótulo e valor muitas vezes em
// linhas separadas).
describe("detectarVencimento", () => {
  it("rótulo e data em linhas separadas (Bradesco, Santander, Riachuelo)", () => {
    expect(detectarVencimento(["Resumo da fatura", "Vencimento", "10/10/2026", "Lançamentos"].join("\n"))).toBe("2026-10-10");
  });

  it("rótulo com dois-pontos na mesma linha", () => {
    expect(detectarVencimento("Data de vencimento: 05/11/2026\nTotal R$ 100,00")).toBe("2026-11-05");
    expect(detectarVencimento("Vence em 07/01/27")).toBe("2027-01-07");
  });

  it("fatura do Nubank: 'FATURA 14 SET 2026' no topo", () => {
    expect(detectarVencimento("FATURA 14 SET 2026 EMISSÃO E ENVIO 07 SET 2026\nTRANSAÇÕES DE 07 AGO A 07 SET")).toBe("2026-09-14");
  });

  it("mês por extenso", () => {
    expect(detectarVencimento("Vencimento: 15 de março de 2027")).toBe("2027-03-15");
  });

  it("vale o primeiro vencimento do arquivo, não o do parcelamento lá embaixo", () => {
    const texto = ["Vencimento", "10/10/2026", "...", "Parcelamento da fatura: vencimento 10/11/2026"].join("\n");
    expect(detectarVencimento(texto)).toBe("2026-10-10");
  });

  it("não inventa: sem a palavra vencimento, nada", () => {
    expect(detectarVencimento("12/09/2026 IFOOD 45,90\n13/09/2026 UBER 18,50")).toBeNull();
    expect(detectarVencimento("EMISSÃO E ENVIO 07 SET 2026")).toBeNull();
  });

  it("data impossível não vira sugestão", () => {
    expect(detectarVencimento("Vencimento 31/02/2026")).toBeNull();
    expect(detectarVencimento("Vencimento 10/13/2026")).toBeNull();
  });
});
