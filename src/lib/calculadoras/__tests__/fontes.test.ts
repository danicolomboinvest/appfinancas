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
    expect(t).toEqual([{ id: "2", nome: "Tesouro IPCA+ 2035", investido: 6100, atual: 6180, ipca: true, vencimento: 2035 }]);
    const v = valoresDoTitulo(t[0], 2026)!;
    expect(v.yearsRemaining).toBe(9);
    expect(v.investedAmount).toBe(6180);
  });
  it("meta de carro pelo ícone ou pelo nome", () => {
    expect(acharMetaDeCarro([{ icon: "GENERICO", name: "Trocar de carro" }])?.name).toBe("Trocar de carro");
    expect(acharMetaDeCarro([{ icon: "VIAGEM", name: "Europa" }])).toBeNull();
  });
});
