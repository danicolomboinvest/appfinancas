import { describe, expect, it } from "vitest";
import { ENERGIA_DO_EMPURRAO, alturaDaBarra, energiaDepois, ondaPodeAbrirMicrofone } from "../onda-do-microfone";

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

describe("onda sem o segundo microfone", () => {
  it("calada, a onda só respira baixinho", () => {
    for (let t = 0; t < 2000; t += 37) for (let i = 0; i < 28; i++) {
      const h = alturaDaBarra(i, t, 0);
      expect(h).toBeGreaterThanOrEqual(0.08);
      expect(h).toBeLessThan(0.15);
    }
  });
  it("falando, as barras sobem e mudam com o tempo", () => {
    const agora = Array.from({ length: 28 }, (_, i) => alturaDaBarra(i, 1000, ENERGIA_DO_EMPURRAO));
    const depois = Array.from({ length: 28 }, (_, i) => alturaDaBarra(i, 1080, ENERGIA_DO_EMPURRAO));
    expect(Math.max(...agora)).toBeGreaterThan(0.6);
    expect(agora).not.toEqual(depois);
    for (const h of agora) expect(h).toBeLessThanOrEqual(1);
  });
  it("a energia cai sozinha: metade em 260 ms, quase nada em 1,5 s", () => {
    expect(energiaDepois(1, 260)).toBeCloseTo(0.5, 5);
    expect(energiaDepois(1, 1500)).toBeLessThan(0.02);
    expect(energiaDepois(1, -5)).toBe(1);
  });
});
