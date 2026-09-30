import { describe, expect, it } from "vitest";
import { LIMITES_CONFIRMACAO, cabeMaisUmEnvio, esperaAteProximoEnvio } from "../limite-de-envio";

const agora = new Date("2026-10-01T12:00:00Z");
const ha = (ms: number) => new Date(agora.getTime() - ms);
const MIN = 60 * 1000;
const HORA = 60 * MIN;

describe("limite de envio (1 por minuto, 5 por dia)", () => {
  it("o primeiro envio sempre cabe", () => {
    expect(cabeMaisUmEnvio([], agora, LIMITES_CONFIRMACAO)).toBe(true);
    expect(esperaAteProximoEnvio([], agora, LIMITES_CONFIRMACAO)).toBe(0);
  });

  it("segundo pedido dentro do mesmo minuto não sai, e diz quanto falta", () => {
    expect(cabeMaisUmEnvio([ha(20 * 1000)], agora, LIMITES_CONFIRMACAO)).toBe(false);
    expect(esperaAteProximoEnvio([ha(20 * 1000)], agora, LIMITES_CONFIRMACAO)).toBe(40 * 1000);
  });

  it("passado o minuto, sai de novo", () => {
    expect(cabeMaisUmEnvio([ha(61 * 1000)], agora, LIMITES_CONFIRMACAO)).toBe(true);
  });

  it("no sexto pedido do dia para, até o mais antigo sair da janela de 24h", () => {
    const cinco = [ha(10 * HORA), ha(8 * HORA), ha(6 * HORA), ha(4 * HORA), ha(2 * HORA)];
    expect(cabeMaisUmEnvio(cinco, agora, LIMITES_CONFIRMACAO)).toBe(false);
    expect(esperaAteProximoEnvio(cinco, agora, LIMITES_CONFIRMACAO)).toBe(14 * HORA);
  });

  it("envio de mais de 24h atrás não conta", () => {
    const velhos = [ha(30 * HORA), ha(29 * HORA), ha(28 * HORA), ha(27 * HORA), ha(26 * HORA)];
    expect(cabeMaisUmEnvio(velhos, agora, LIMITES_CONFIRMACAO)).toBe(true);
  });
});
