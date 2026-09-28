import { describe, expect, it } from "vitest";
import { classificarAntigo } from "../revisao-antigos";

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
