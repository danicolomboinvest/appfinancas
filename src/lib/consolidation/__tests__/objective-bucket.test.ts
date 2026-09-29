import { describe, expect, it } from "vitest";
import { objectiveBucket } from "../portfolio";

/**
 * O CDB de R$ 20.000 marcado "Meta" sem meta (ou da meta que ela apagou) sumia de todos os
 * cards do "Por objetivo". Agora ele conta como "sem objetivo".
 */
describe("objectiveBucket", () => {
  const metas = new Set(["carro"]);

  it("meta que existe continua sendo da meta", () => {
    expect(objectiveBucket({ objective: "META", goalId: "carro" }, metas)).toBe("META");
  });

  it("meta sem meta escolhida vai pra sem objetivo", () => {
    expect(objectiveBucket({ objective: "META", goalId: null }, metas)).toBe("OUTRO");
  });

  it("meta apagada (ou de outro perfil) vai pra sem objetivo", () => {
    expect(objectiveBucket({ objective: "META", goalId: "casa-apagada" }, metas)).toBe("OUTRO");
  });

  it("reserva, liberdade e outro ficam onde estão", () => {
    expect(objectiveBucket({ objective: "RESERVA_EMERGENCIA", goalId: null }, metas)).toBe("RESERVA_EMERGENCIA");
    expect(objectiveBucket({ objective: "LIBERDADE_FINANCEIRA", goalId: null }, metas)).toBe("LIBERDADE_FINANCEIRA");
    expect(objectiveBucket({ objective: "OUTRO", goalId: null }, metas)).toBe("OUTRO");
  });
});
