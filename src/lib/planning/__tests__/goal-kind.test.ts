import { describe, expect, it } from "vitest";
import { detectGoalKind, resolveGoalKind } from "../goal-kind";

describe("detectGoalKind", () => {
  it("entende as várias formas de dizer a mesma coisa", () => {
    for (const n of ["Viagem Europa 2027", "Viajar com a família", "Férias no Chile", "Mochilão", "Lua de mel"])
      expect(detectGoalKind(n)).toBe("VIAGEM");
    for (const n of ["Casa própria", "Entrada do apê", "Comprar apartamento", "Reforma da cozinha", "Terreno"])
      expect(detectGoalKind(n)).toBe("CASA");
    for (const n of ["Trocar de carro", "Moto nova", "Veículo zero km"]) expect(detectGoalKind(n)).toBe("CARRO");
    for (const n of ["Aposentadoria", "Independência financeira", "Renda passiva"])
      expect(detectGoalKind(n)).toBe("APOSENTADORIA");
  });

  it("não confunde CASAMENTO com casa", () => {
    // O caso que uma busca por pedaço de texto erraria — e casamento é meta comum.
    expect(detectGoalKind("Casamento")).toBeNull();
    expect(detectGoalKind("Festa de casamento")).toBeNull();
  });

  it("ignora acento e caixa", () => {
    expect(detectGoalKind("APÊ NOVO")).toBe("CASA");
    expect(detectGoalKind("férias")).toBe("VIAGEM");
  });

  it("com dois termos, vence o que vem primeiro", () => {
    expect(detectGoalKind("Viagem de carro pro litoral")).toBe("VIAGEM");
    expect(detectGoalKind("Carro pra viajar")).toBe("CARRO");
  });

  it("devolve null quando o nome não diz nada", () => {
    expect(detectGoalKind("Objetivo 1")).toBeNull();
    expect(detectGoalKind("")).toBeNull();
    expect(detectGoalKind("Reserva pro Pedro")).toBeNull();
  });
});

describe("resolveGoalKind", () => {
  it("a escolha manual da pessoa sempre manda", () => {
    // Ela marcou "Carro" num item chamado "Viagem": respeita o botão, não o palpite.
    expect(resolveGoalKind("CARRO", "Viagem Europa")).toBe("CARRO");
  });

  it("só adivinha quando ficou em Genérico", () => {
    expect(resolveGoalKind("GENERICO", "Entrada do apê")).toBe("CASA");
    expect(resolveGoalKind("GENERICO", "Objetivo 1")).toBe("GENERICO");
  });
});
