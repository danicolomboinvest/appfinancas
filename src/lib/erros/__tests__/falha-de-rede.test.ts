import { describe, expect, it } from "vitest";
import { ehFalhaDeRede } from "../erro-do-cliente";
import { joinFinalTranscript } from "@/app/(app)/mensal/VoiceRecorder";

describe("só culpa a internet quando foi a internet", () => {
  it("sem rede ou envio que nem saiu", () => {
    expect(ehFalhaDeRede(new Error("qualquer"), false)).toBe(true);
    expect(ehFalhaDeRede(new TypeError("Failed to fetch"), true)).toBe(true);
    expect(ehFalhaDeRede(new TypeError("Load failed"), true)).toBe(true);
  });
  it("erro do nosso lado não é internet", () => {
    expect(ehFalhaDeRede(new Error("Cannot read properties of undefined"), true)).toBe(false);
    expect(ehFalhaDeRede(new Error("An unexpected response was received from the server."), true)).toBe(false);
  });
});

describe("transcrição no Android", () => {
  const r = (t: string, isFinal: boolean) => Object.assign([{ transcript: t }], { isFinal });
  it("junta os finais", () => {
    expect(joinFinalTranscript([r("recebi 15 mil", true), r("de salário", true)])).toBe("recebi 15 mil de salário");
  });
  it("sem final, usa o último parcial em vez de dizer que não entendeu", () => {
    expect(joinFinalTranscript([r("recebi 15", false), r("recebi 15 mil shekels", false)])).toBe("recebi 15 mil shekels");
  });
});
