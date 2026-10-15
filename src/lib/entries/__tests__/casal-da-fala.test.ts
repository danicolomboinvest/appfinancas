import { describe, expect, it } from "vitest";
import { parseVoiceEntry } from "@/lib/entries/voice-expense-parser";
import { casalDaFala } from "@/lib/entries/casal-da-fala";

/** A voz no Casal simples (15/10/2026): a frase marca as mesmas três perguntas do Digitar. */

const ouvir = (frase: string, par = "Lucas") => parseVoiceEntry(frase, {}, { nomeDoPar: par });

describe("o casal na frase", () => {
  it("o exemplo da Dani: Lucas pagou 200 no mercado, metade cada", () => {
    const r = ouvir("Lucas pagou 200 no mercado, metade cada");
    expect(r.casal).toEqual({ deQuem: "casa", pagouOPar: true, divide: "meio" });
    expect(r.amount).toBe(200);
    expect(r.description).toBe("Mercado");
    expect(r.category).toBe("EXPENSE");
  });

  it("eu paguei, da casa, meio a meio, pela renda", () => {
    expect(ouvir("eu paguei 120 de luz da casa").casal).toEqual({ deQuem: "casa", pagouOPar: false });
    expect(ouvir("eu paguei 120 de luz da casa").description).toBe("Luz");
    expect(ouvir("gastei 300 no açougue meio a meio").casal).toEqual({ deQuem: "casa", divide: "meio" });
    expect(ouvir("gastei 300 no açougue pela renda").casal).toEqual({ deQuem: "casa", divide: "renda" });
  });

  it("só meu, dele, dela e do nome", () => {
    expect(ouvir("gastei 80 no cabelo, só meu").casal).toEqual({ deQuem: "meu" });
    expect(ouvir("gastei 80 no cabelo, só meu").description).toBe("Cabelo");
    expect(ouvir("paguei 90 no presente dele").casal).toEqual({ deQuem: "par" });
    expect(ouvir("paguei 90 no presente dele").description).toBe("Presente");
    expect(ouvir("paguei 90 na farmácia dela", "Ana").casal).toEqual({ deQuem: "par" });
    expect(ouvir("paguei 50 no tênis do Lucas").casal).toEqual({ deQuem: "par" });
  });

  it("o par pagou o que é meu", () => {
    const r = ouvir("Lucas pagou 150 na minha roupa, só meu");
    expect(r.casal).toEqual({ deQuem: "meu", pagouOPar: true });
  });

  it("nome com acento e frase com maiúscula", () => {
    expect(ouvir("A Lúcia pagou 40 no pão", "Lúcia").casal).toEqual({ pagouOPar: true });
    expect(ouvir("A Lúcia pagou 40 no pão", "Lúcia").description).toBe("Pão");
  });

  it("fora de uma casa, ou sem nada de casal na frase, nada muda", () => {
    expect(parseVoiceEntry("Lucas pagou 200 no mercado, metade cada").casal).toBeUndefined();
    expect(ouvir("gastei 45 no mercado").casal).toBeUndefined();
    expect(casalDaFala("gastei 45 no mercado", "Lucas")).toEqual({ casal: null, texto: "gastei 45 no mercado" });
    expect(ouvir("recebi 4 mil de salário, da casa").casal).toBeUndefined();
  });
});
