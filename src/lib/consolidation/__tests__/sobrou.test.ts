import { describe, expect, it } from "vitest";
import { lerSobrou, sobrouDoMes, sobrouDoResumo } from "../sobrou";

describe("sobrou = entrou − gastou − guardou (regra 3.7)", () => {
  it("os números da Ana", () => {
    // Outubro até o dia 7.
    expect(sobrouDoMes({ entrou: 7700, gastou: 4059, guardou: 900 })).toBe(2741);
    // Setembro fechado.
    expect(sobrouDoMes({ entrou: 7700, gastou: 6600, guardou: 900 })).toBe(200);
    // Julho: gastou mais do que entrou e não guardou.
    expect(sobrouDoMes({ entrou: 7900, gastou: 8100, guardou: 0 })).toBe(-200);
  });

  it("o resumo do mês dá o mesmo número", () => {
    expect(sobrouDoResumo({ totalIncome: 7700, totalExpense: 4059, totalInvestment: 900 })).toBe(2741);
  });

  it("guardar entra na conta: quem guardou mais do que sobrou dos gastos fica no 'faltou'", () => {
    expect(sobrouDoMes({ entrou: 5000, gastou: 3000, guardou: 2500 })).toBe(-500);
  });

  it("centavos não viram lixo de ponto flutuante", () => {
    expect(sobrouDoMes({ entrou: 0.3, gastou: 0.1, guardou: 0.1 })).toBe(0.1);
  });

  it("na tela: sobrou, empatou ou faltou, sempre com o valor sem sinal", () => {
    expect(lerSobrou(2741)).toEqual({ situacao: "sobrou", rotulo: "Sobrou", valor: 2741 });
    expect(lerSobrou(0)).toEqual({ situacao: "empatou", rotulo: "Empatou", valor: 0 });
    expect(lerSobrou(-0.004)).toEqual({ situacao: "empatou", rotulo: "Empatou", valor: 0 });
    expect(lerSobrou(-500)).toEqual({ situacao: "faltou", rotulo: "Faltou", valor: 500 });
  });
});
