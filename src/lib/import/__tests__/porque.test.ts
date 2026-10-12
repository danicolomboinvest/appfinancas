import { describe, expect, it } from "vitest";
import { foiSeparada, porqueDaLinha } from "../porque";

const base = { category: "EXPENSE", parentCategory: null, customCategoryId: null, autoClassified: false };

describe("o porquê de cada linha separada", () => {
  it("usa o que o motor mandar", () => {
    expect(porqueDaLinha({ ...base, porque: { categoria: "Lazer", motivo: "você já disse antes", confianca: 0.95 } })?.motivo).toBe("você já disse antes");
  });
  it("deduz investimento, resgate, devolução e pagamento da fatura", () => {
    expect(porqueDaLinha({ ...base, category: "INVESTMENT_CONTRIBUTION" })?.motivo).toBe("investimento");
    expect(porqueDaLinha({ ...base, category: "INVESTMENT_CONTRIBUTION", resgate: true })?.motivo).toBe("resgate do que você guardou");
    expect(porqueDaLinha({ ...base, estorno: true, parentCategory: "LAZER" })?.motivo).toBe("devolução");
    expect(porqueDaLinha({ ...base, ignorar: true, nota: "Pagamento da fatura: fica de fora" })?.motivo).toBe("pagamento da fatura");
  });
  it("dúvida e gasto sem categoria não são separados: viram pergunta", () => {
    expect(foiSeparada({ ...base, duvida: "conta_propria" })).toBe(false);
    expect(foiSeparada(base)).toBe(false);
    expect(foiSeparada({ ...base, parentCategory: "ALIMENTACAO", autoClassified: true })).toBe(true);
  });
  it("confiança baixa do motor volta para as perguntas", () => {
    expect(foiSeparada({ ...base, parentCategory: "LAZER", autoClassified: true, porque: { categoria: "Lazer", motivo: "talvez", confianca: 0.4 } })).toBe(false);
  });
  it("lê o motivo e a confiança do motor", () => {
    expect(porqueDaLinha({ ...base, parentCategory: "LAZER", autoClassified: true, motivo: "regra_sua", confianca: "alta" })?.motivo).toBe("você já disse antes");
    expect(porqueDaLinha({ ...base, parentCategory: "LAZER", autoClassified: true, motivo: "comunidade", confianca: "alta" })?.motivo).toBe("outras pessoas classificam assim");
    expect(foiSeparada({ ...base, motivo: "pergunta", confianca: "baixa" })).toBe(false);
    expect(foiSeparada({ ...base, parentCategory: "LAZER", autoClassified: true, motivo: "dicionario", confianca: "baixa" })).toBe(false);
  });
});
