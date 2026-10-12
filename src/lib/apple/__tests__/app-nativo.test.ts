import { describe, expect, it } from "vitest";
import { ehAppNativo, FOTO_SO_NO_NAVEGADOR } from "../app-nativo";

describe("envio de imagem só no navegador enquanto o app da loja não pede câmera e fotos", () => {
  it("app nativo (Capacitor): esconde o envio", () => {
    expect(ehAppNativo({ Capacitor: { isNativePlatform: () => true } })).toBe(true);
  });
  it("Safari, Chrome e o PWA: continua tudo normal", () => {
    expect(ehAppNativo({})).toBe(false);
    expect(ehAppNativo({ Capacitor: { isNativePlatform: () => false } })).toBe(false);
    expect(ehAppNativo({ Capacitor: {} })).toBe(false);
    expect(ehAppNativo(null)).toBe(false);
    expect(ehAppNativo(undefined)).toBe(false);
  });
  it("erro ao perguntar ao Capacitor conta como navegador, nunca derruba a tela", () => {
    expect(ehAppNativo({ Capacitor: { isNativePlatform: () => { throw new Error("x"); } } })).toBe(false);
  });
  it("o aviso no lugar do botão", () => {
    expect(FOTO_SO_NO_NAVEGADOR).toBe("Para trocar a foto, abra o SPI pelo navegador");
  });
});
