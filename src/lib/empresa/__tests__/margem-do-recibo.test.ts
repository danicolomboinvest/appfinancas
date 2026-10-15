import { describe, expect, it } from "vitest";
import { margemDoRecibo, pontoDeEquilibrio, reciboDoMes, reciboDosMeses, type LancamentoDaEmpresa } from "../regras";
import { calcularDRE } from "@/lib/profiles/empresa";

let n = 0;
function l(p: Partial<LancamentoDaEmpresa> & Pick<LancamentoDaEmpresa, "category" | "amount">): LancamentoDaEmpresa {
  return { id: `m${n++}`, year: 2026, month: 9, parentCategory: null, subcategory: null, description: null, entryDate: null, ...p };
}

// Um mês com rendimento do caixa, pró-labore e uma aplicação lançada como gasto.
const mes: LancamentoDaEmpresa[] = [
  l({ category: "INCOME", subcategory: "Vendas", amount: 10000 }),
  l({ category: "INCOME", subcategory: "Rendimento do caixa", amount: 200 }),
  l({ category: "EXPENSE", parentCategory: "ALIMENTACAO", subcategory: "Matéria-prima", amount: 3000 }),
  l({ category: "EXPENSE", parentCategory: "IMPOSTOS", subcategory: "DAS", amount: 600 }),
  l({ category: "EXPENSE", parentCategory: "MORADIA", subcategory: "Aluguel", amount: 1500 }),
  l({ category: "EXPENSE", parentCategory: "OUTROS", subcategory: "Pró-labore", amount: 3000 }),
];

describe("margem da Empresa: uma conta só para o /empresa e o /investir", () => {
  it("é a do recibo: (vendas − imposto − variáveis) ÷ vendas, sem o rendimento do caixa", () => {
    const r = reciboDoMes(mes, { ano: 2026, mes: 9 });
    expect(r.entrou).toBe(10000);
    expect(margemDoRecibo(r)).toBeCloseTo((10000 - 600 - 3000) / 10000);
  });

  it("o ponto de equilíbrio do /empresa usa a mesma margem", () => {
    const r = reciboDoMes(mes, { ano: 2026, mes: 9 });
    expect(pontoDeEquilibrio(r, 3000)).toBe(Math.ceil((r.fixas + 3000) / margemDoRecibo(r)! - 1e-9));
  });

  it("antes, a DRE do /investir contava o rendimento como venda e a margem saía outra", () => {
    const dre = calcularDRE({ receita: 10200, gastoPorCategoria: { ALIMENTACAO: 3000, IMPOSTOS: 600, MORADIA: 1500, OUTROS: 3000 } });
    expect(dre.margemContribuicaoPct).not.toBeCloseTo(margemDoRecibo(reciboDoMes(mes, { ano: 2026, mes: 9 }))!, 3);
  });

  it("vários meses somam o recibo antes de dividir (a margem do ano)", () => {
    const outubro = mes.map((x) => ({ ...x, month: 10, amount: x.subcategory === "Vendas" ? 5000 : x.amount }));
    const soma = reciboDosMeses([...mes, ...outubro], [{ ano: 2026, mes: 9 }, { ano: 2026, mes: 10 }]);
    expect(soma.entrou).toBe(15000);
    expect(margemDoRecibo(soma)).toBeCloseTo((15000 - 1200 - 6000) / 15000);
    expect(margemDoRecibo({ entrou: 0, impostos: 0, variaveis: 0 })).toBeNull();
  });
});
