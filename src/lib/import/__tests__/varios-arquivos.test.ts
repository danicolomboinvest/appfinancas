import { describe, expect, it } from "vitest";
import { faixaDosMeses, levarRespostas, listaDeMesesCurta, resumoDoArquivo } from "../varios-arquivos";

describe("vários arquivos de uma vez", () => {
  it("o resumo de cada arquivo: tipo, banco, vencimento, quantas e os meses", () => {
    expect(resumoDoArquivo("fatura", { banco: "EQI", vencimento: "2026-07-17", compras: 64, mesesDasCompras: ["2026-06", "2026-07"] }, [])).toEqual({ titulo: "Fatura EQI", chips: ["vence 17/07", "64 compras", "junho e julho"] });
    const linhas = [{ date: "2026-08-02", category: "EXPENSE" }, { date: "2026-09-05", category: "INCOME" }, { date: "2026-09-06", category: "EXPENSE", ignorar: true }];
    expect(resumoDoArquivo("extrato", { banco: "Itaú" }, linhas)).toEqual({ titulo: "Extrato Itaú", chips: ["2 lançamentos", "agosto e setembro"] });
    expect(listaDeMesesCurta(["2026-03", "2026-04", "2026-05", "2026-08"])).toBe("março a agosto");
  });
  it("as respostas de um arquivo valem nos próximos do mesmo envio", () => {
    const resp = [{ description: "Compra no débito ESPACOBELLA", category: "EXPENSE", parentCategory: "SAUDE", customCategoryId: null, autoClassified: false }];
    const destino = [
      { description: "ESPACOBELLA", category: "EXPENSE", parentCategory: null, customCategoryId: null, autoClassified: false },
      { description: "Padaria", category: "EXPENSE", parentCategory: null, customCategoryId: null, autoClassified: false },
    ];
    const r = levarRespostas(resp, destino);
    expect(r.levadas).toBe(1);
    expect(r.linhas[0]).toMatchObject({ parentCategory: "SAUDE", motivo: "regra_sua" });
    expect(r.linhas[1].parentCategory).toBeNull();
  });
  it("a faixa dos meses: o que já tem, o que chegou agora e o que falta", () => {
    const f = faixaDosMeses(["2026-01", "2026-02"], ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"], new Date(2026, 9, 12));
    expect(f.meses).toHaveLength(12);
    expect(f.meses.at(-1)).toMatchObject({ ym: "2026-10", estado: "novo" });
    expect(f.faltam).toEqual(["março", "abril"]);
  });
});
