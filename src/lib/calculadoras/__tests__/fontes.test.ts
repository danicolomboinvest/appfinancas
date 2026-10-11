import { describe, expect, it } from "vitest";
import { acharAluguel, acharMetaDeCarro, titulosDaCarteira, valoresDoTitulo } from "../fontes";

describe("de onde vêm os números das calculadoras", () => {
  it("aluguel: a conta cadastrada vem antes do lançamento, e diz de onde veio", () => {
    expect(acharAluguel([{ nome: "Aluguel", valor: 2200 }], [{ descricao: "Aluguel", subcategoria: null, valor: 2100, ano: 2026, mes: 10 }])).toEqual({ valor: 2200, origem: "Das suas contas · Aluguel" });
    expect(acharAluguel([], [{ descricao: "Aluguel", subcategoria: null, valor: 2100, ano: 2026, mes: 9 }, { descricao: null, subcategoria: "Aluguel", valor: 2150, ano: 2026, mes: 10 }])).toEqual({ valor: 2150, origem: "Do seu orçamento · Moradia" });
  });
  it("sem aluguel no app, não inventa", () => {
    expect(acharAluguel([{ nome: "Luz", valor: 130 }, { nome: "Aluguel", valor: null }], [])).toBeNull();
  });
  it("só IPCA+ e prefixado entram no 'Vender antes do prazo', com o ano do nome", () => {
    const t = titulosDaCarteira([
      { id: "1", name: "Tesouro Selic 2029", assetClass: "TESOURO_DIRETO", fixedIncomeIndex: "POS_FIXADO", investedValue: 4150, currentValue: 4200 },
      { id: "2", name: "Tesouro IPCA+ 2035", assetClass: "TESOURO_DIRETO", fixedIncomeIndex: "IPCA", investedValue: 6100, currentValue: 6180 },
      { id: "3", name: "PETR4", assetClass: "ACAO", fixedIncomeIndex: null, investedValue: 1000, currentValue: 900 },
    ]);
    expect(t).toEqual([{ id: "2", nome: "Tesouro IPCA+ 2035", investido: 6100, atual: 6180, ipca: true, vencimento: 2035, taxaCompra: null }]);
    const v = valoresDoTitulo(t[0], 2026)!;
    expect(v.yearsRemaining).toBe(9);
    expect(v.investedAmount).toBe(6180);
    // Sem a taxa da compra no ativo, continua o exemplo.
    expect(v.originalRate).toBe(0.06);
  });
  it("a taxa da compra vem do ativo (fração, lida pelo indexador)", () => {
    const [ipca, pre] = titulosDaCarteira([
      { id: "a", name: "Tesouro IPCA+ 2035", assetClass: "TESOURO_DIRETO", fixedIncomeIndex: "IPCA", investedValue: 6100, currentValue: 6180, taxaCompra: 0.075 },
      { id: "b", name: "CDB prefixado 2028", assetClass: "RENDA_FIXA", fixedIncomeIndex: "PREFIXADO", investedValue: 5000, currentValue: 5200, taxaCompra: 0.128 },
    ]);
    // IPCA + 7,5%: só o juro real entra na conta; a de hoje começa um ponto acima.
    expect(valoresDoTitulo(ipca, 2026)).toMatchObject({ originalRate: 0.075, newRate: 0.085 });
    // 12,8% ao ano: a de hoje começa dois pontos acima.
    expect(valoresDoTitulo(pre, 2026)).toMatchObject({ originalRate: 0.128, newRate: 0.148 });
  });
  it("taxa fora da faixa de uma taxa ao ano fica no exemplo", () => {
    const [t] = titulosDaCarteira([{ id: "a", name: "Tesouro IPCA+ 2035", assetClass: "TESOURO_DIRETO", fixedIncomeIndex: "IPCA", investedValue: 1, currentValue: 1, taxaCompra: 1.05 }]);
    expect(t.taxaCompra).toBeNull();
  });
  it("meta de carro pelo ícone ou pelo nome", () => {
    expect(acharMetaDeCarro([{ icon: "GENERICO", name: "Trocar de carro" }])?.name).toBe("Trocar de carro");
    expect(acharMetaDeCarro([{ icon: "VIAGEM", name: "Europa" }])).toBeNull();
  });
});
