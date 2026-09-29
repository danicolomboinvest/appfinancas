import { describe, expect, it } from "vitest";
import { acharCompraDoEstorno, classificarAntigo } from "../revisao-antigos";

const e = (category: "INCOME" | "EXPENSE", description: string, amount = 100) => ({ category, description, amount });

describe("classificarAntigo", () => {
  it("acha aplicação, fatura (só pra quem importa fatura), conta própria, resgate e estorno", () => {
    expect(classificarAntigo(e("EXPENSE", "Aplicação RDB"), null, false)).toBe("aplicacao");
    expect(classificarAntigo(e("EXPENSE", "Pagamento de fatura"), null, true)).toBe("fatura");
    expect(classificarAntigo(e("EXPENSE", "Pagamento de fatura"), null, false)).toBeNull();
    expect(classificarAntigo(e("EXPENSE", "Pix enviado - ANA LIMA"), "Ana Lima", false)).toBe("conta_propria_saida");
    expect(classificarAntigo(e("INCOME", "Resgate RDB"), null, false)).toBe("resgate");
    expect(classificarAntigo(e("INCOME", "Estorno compra"), null, false)).toBe("estorno");
    expect(classificarAntigo(e("INCOME", "Salário"), null, false)).toBeNull();
    expect(classificarAntigo(e("EXPENSE", "Mercado"), null, true)).toBeNull();
  });
  it("estorno já gravado (negativo) não volta pra revisão", () => {
    expect(classificarAntigo(e("EXPENSE", "Estorno compra", -50), null, false)).toBeNull();
  });
});

describe("acharCompraDoEstorno", () => {
  const compra = (description: string, amount: number, parentCategory: string | null, customCategoryId: string | null = null) => ({ description, amount, parentCategory, customCategoryId });

  it("acha a compra da mesma loja e prefere o mesmo valor", () => {
    const compras = [compra("NETSHOES*PEDIDO 1", 80, "VESTUARIO"), compra("Netshoes", 250, "LAZER"), compra("iFood", 250, "ALIMENTACAO")];
    expect(acharCompraDoEstorno({ description: "ESTORNO NETSHOES", amount: 250 }, compras)?.parentCategory).toBe("LAZER");
  });

  it("estorno parcial: valor diferente, fica a compra mais recente da loja", () => {
    const compras = [compra("Cinemark Shopping", 120, "LAZER"), compra("Cinemark", 60, "OUTROS")];
    expect(acharCompraDoEstorno({ description: "Estorno Cinemark", amount: 40 }, compras)?.parentCategory).toBe("LAZER");
  });

  it("categoria personalizada vem junto", () => {
    const compras = [compra("Decathlon", 300, null, "cat-esporte")];
    expect(acharCompraDoEstorno({ description: "Reembolso Decathlon", amount: 300 }, compras)?.customCategoryId).toBe("cat-esporte");
  });

  it("palavra genérica não vira loja: sem nome, não acha nada", () => {
    const compras = [compra("Compra loja", 100, "LAZER"), compra("Mercado Pago", 100, "OUTROS")];
    expect(acharCompraDoEstorno({ description: "ESTORNO COMPRA LOJA", amount: 100 }, compras)).toBeNull();
  });
});
