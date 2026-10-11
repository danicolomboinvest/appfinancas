import { describe, expect, it } from "vitest";
import { classeDaEstrategia, classificar, grupoDoAtivo } from "../classificacao";
import { mapAssetToStrategyClass } from "../strategy";

const fundoRF = { assetClass: "FUNDO" as const, fixedIncomeIndex: null, currency: "BRL" };

describe("classificação trocável (rodada 23, adendo)", () => {
  it("automático: Tesouro IPCA+ é IPCA+ no Brasil; VOO em dólar é Exterior; IVVB11 (Internacional na B3) também", () => {
    expect(classificar({ assetClass: "TESOURO_DIRETO", fixedIncomeIndex: "IPCA", currency: "BRL" })).toEqual({ tipo: "ipca", onde: "brasil", escolhida: false });
    expect(classeDaEstrategia({ assetClass: "INTERNACIONAL", fixedIncomeIndex: null, currency: "USD" })).toBe("EXTERIOR");
    expect(classeDaEstrategia({ assetClass: "INTERNACIONAL", fixedIncomeIndex: null, currency: "BRL" })).toBe("EXTERIOR");
  });

  it("trocar um fundo de RF Brasil para RF Exterior move para o Exterior em todo lugar e volta ao desfazer", () => {
    const escolhido = { ...fundoRF, tipoEscolhido: "pos", ondeEscolhido: "brasil" };
    expect(classeDaEstrategia(escolhido)).toBe("RENDA_FIXA_POS_FIXADA");
    expect(grupoDoAtivo(escolhido)).toBe("rendafixa");

    const fora = { ...escolhido, ondeEscolhido: "exterior" };
    expect(classeDaEstrategia(fora)).toBe("EXTERIOR");
    expect(grupoDoAtivo(fora)).toBe("exterior");
    expect(classificar(fora).escolhida).toBe(true);
    expect(mapAssetToStrategyClass(fora)).toBe("EXTERIOR");

    // "Voltar ao automático": sem escolha, o fundo sem classe oficial fica em Outros/Fundos.
    const automatico = { ...fora, tipoEscolhido: null, ondeEscolhido: null };
    expect(classeDaEstrategia(automatico)).toBe("OUTROS");
    expect(grupoDoAtivo(automatico)).toBe("fundos");
    expect(classificar(automatico).escolhida).toBe(false);
  });

  it("multimercado conta na linha Outros da estratégia e no grupo Fundos", () => {
    const mm = { ...fundoRF, tipoEscolhido: "multimercado" };
    expect(classeDaEstrategia(mm)).toBe("OUTROS");
    expect(grupoDoAtivo(mm)).toBe("fundos");
  });

  it("valor desconhecido no banco é ignorado (vale o automático)", () => {
    expect(classificar({ assetClass: "FII", fixedIncomeIndex: null, tipoEscolhido: "xyz", ondeEscolhido: "lua" })).toEqual({ tipo: "fiis", onde: "brasil", escolhida: false });
  });

  it("o mapeamento antigo continua igual para quem não escolheu nada", () => {
    expect(mapAssetToStrategyClass({ assetClass: "RENDA_FIXA", fixedIncomeIndex: null })).toBe("RENDA_FIXA_POS_FIXADA");
    expect(mapAssetToStrategyClass({ assetClass: "TESOURO_DIRETO", fixedIncomeIndex: "PREFIXADO" })).toBe("PREFIXADO");
    expect(mapAssetToStrategyClass({ assetClass: "CRIPTO", fixedIncomeIndex: null })).toBe("OUTROS");
  });
});
