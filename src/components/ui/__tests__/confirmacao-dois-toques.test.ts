import { describe, expect, it } from "vitest";
import { INTERVALO_MINIMO_MS, PARADO, proximoEstado } from "../confirmacao-dois-toques";

describe("apagar em dois toques", () => {
  it("o 1º toque só arma o botão, não apaga nada", () => {
    const r = proximoEstado(PARADO, { tipo: "toque", agora: 1000 });
    expect(r.apagar).toBe(false);
    expect(r.estado).toEqual({ fase: "confirmando", armadoEm: 1000 });
  });

  it("o 2º toque, com calma, apaga e volta o botão ao normal", () => {
    const armado = proximoEstado(PARADO, { tipo: "toque", agora: 1000 }).estado;
    const r = proximoEstado(armado, { tipo: "toque", agora: 1000 + INTERVALO_MINIMO_MS + 500 });
    expect(r.apagar).toBe(true);
    expect(r.estado).toEqual(PARADO);
  });

  it("duplo toque acidental (dedo que quica) não apaga", () => {
    const armado = proximoEstado(PARADO, { tipo: "toque", agora: 1000 }).estado;
    const r = proximoEstado(armado, { tipo: "toque", agora: 1000 + INTERVALO_MINIMO_MS - 1 });
    expect(r.apagar).toBe(false);
    // Continua esperando a confirmação de verdade.
    expect(r.estado).toEqual(armado);
  });

  it("cancelar desarma sem apagar", () => {
    const armado = proximoEstado(PARADO, { tipo: "toque", agora: 1000 }).estado;
    expect(proximoEstado(armado, { tipo: "cancelar" })).toEqual({ estado: PARADO, apagar: false });
  });

  it("se o tempo pra confirmar acaba, o próximo toque volta a ser só o 1º", () => {
    const armado = proximoEstado(PARADO, { tipo: "toque", agora: 1000 }).estado;
    const expirado = proximoEstado(armado, { tipo: "expirou" });
    expect(expirado).toEqual({ estado: PARADO, apagar: false });
    const depois = proximoEstado(expirado.estado, { tipo: "toque", agora: 20_000 });
    expect(depois.apagar).toBe(false);
    expect(depois.estado.fase).toBe("confirmando");
  });
});
