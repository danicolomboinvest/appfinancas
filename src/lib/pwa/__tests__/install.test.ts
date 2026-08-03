import { describe, expect, it } from "vitest";
import { detectPlatformFromUserAgent } from "../install";

/** User agents reais dos aparelhos que as clientas usam. */
const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15",
  iphoneEdge:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/126.0 Mobile/15E148 Safari/605.1.15",
  ipadOS:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

describe("detectPlatformFromUserAgent", () => {
  it("iPhone no Safari → tutorial do botão Compartilhar", () => {
    expect(detectPlatformFromUserAgent(UA.iphoneSafari)).toBe("ios-safari");
  });

  it("iPhone em Chrome/Firefox/Edge → tutorial do menu, que é outro caminho", () => {
    expect(detectPlatformFromUserAgent(UA.iphoneChrome)).toBe("ios-outro");
    expect(detectPlatformFromUserAgent(UA.iphoneFirefox)).toBe("ios-outro");
    expect(detectPlatformFromUserAgent(UA.iphoneEdge)).toBe("ios-outro");
  });

  it("Android → instalação nativa (Chrome e Samsung Internet)", () => {
    expect(detectPlatformFromUserAgent(UA.androidChrome)).toBe("android");
    expect(detectPlatformFromUserAgent(UA.androidSamsung)).toBe("android");
  });

  it("iPad moderno se anuncia como Mac: só a tela de toque o entrega", () => {
    // Sem toque = Mac de verdade; com toque = iPad (e aí vale o tutorial do iOS).
    expect(detectPlatformFromUserAgent(UA.ipadOS, 0)).toBe("desktop");
    expect(detectPlatformFromUserAgent(UA.ipadOS, 5)).toBe("ios-safari");
  });

  it("computador → desktop (não mostra convite de celular)", () => {
    expect(detectPlatformFromUserAgent(UA.macChrome)).toBe("desktop");
    expect(detectPlatformFromUserAgent(UA.windowsChrome)).toBe("desktop");
  });

  it("user agent vazio ou estranho não quebra: cai em desktop", () => {
    expect(detectPlatformFromUserAgent("")).toBe("desktop");
    expect(detectPlatformFromUserAgent("qualquer coisa")).toBe("desktop");
  });
});
