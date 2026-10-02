import { describe, expect, it } from "vitest";
import { ondaPodeAbrirMicrofone } from "../onda-do-microfone";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

describe("onda do microfone", () => {
  it("no iPhone nunca abre o segundo microfone, nem no Chrome de lá", () => {
    expect(ondaPodeAbrirMicrofone(IPHONE_SAFARI)).toBe(false);
    expect(ondaPodeAbrirMicrofone(IPHONE_CHROME)).toBe(false);
  });

  it("no Safari do Mac também não", () => {
    expect(ondaPodeAbrirMicrofone(MAC_SAFARI)).toBe(false);
  });

  it("no Chrome (Android e computador) a onda continua", () => {
    expect(ondaPodeAbrirMicrofone(ANDROID_CHROME)).toBe(true);
    expect(ondaPodeAbrirMicrofone(MAC_CHROME)).toBe(true);
  });
});
