import { describe, expect, it } from "vitest";
import { resolveQuotedCurrentValue } from "../asset-current-value";

/**
 * O "valor atual" de uma ação/FII ao salvar o formulário. O caso que motivou: editar a
 * quantidade de 10 pra 20 PETR4 com o campo "valor atual" pré-preenchido em R$ 300 deixava o
 * valor em R$ 300 e o investido dobrado — um prejuízo de 50% que não existia.
 */
describe("resolveQuotedCurrentValue", () => {
  it("edição: campo intocado e cotação disponível vira quantidade nova × cotação", () => {
    expect(
      resolveQuotedCurrentValue({ typedCurrent: "300", originalCurrent: "300", originalQuantity: "10", quantity: 20, price: 31 }),
    ).toBe(620);
  });

  it("edição: campo intocado e cotação fora do ar acompanha a quantidade na proporção", () => {
    expect(
      resolveQuotedCurrentValue({ typedCurrent: "300", originalCurrent: "300", originalQuantity: "10", quantity: 20, price: null }),
    ).toBe(600);
  });

  it("edição: valor que ela mudou de propósito é respeitado", () => {
    expect(
      resolveQuotedCurrentValue({ typedCurrent: "650", originalCurrent: "300", originalQuantity: "10", quantity: 20, price: 31 }),
    ).toBe("650");
  });

  it("edição sem mudar a quantidade e sem cotação mantém o valor salvo", () => {
    expect(
      resolveQuotedCurrentValue({ typedCurrent: "300", originalCurrent: "300", originalQuantity: "10", quantity: 10, price: null }),
    ).toBe("300");
  });

  it("criação: em branco busca a cotação; digitado vale o digitado", () => {
    expect(resolveQuotedCurrentValue({ typedCurrent: "", originalCurrent: "", originalQuantity: "", quantity: 10, price: 30.5 })).toBe(305);
    expect(resolveQuotedCurrentValue({ typedCurrent: "280", originalCurrent: "", originalQuantity: "", quantity: 10, price: 30.5 })).toBe("280");
  });

  it("sem quantidade nem cotação devolve o que veio (o fallback pro investido fica com quem chama)", () => {
    expect(resolveQuotedCurrentValue({ typedCurrent: "", originalCurrent: "", originalQuantity: "", quantity: undefined, price: null })).toBe("");
  });
});
