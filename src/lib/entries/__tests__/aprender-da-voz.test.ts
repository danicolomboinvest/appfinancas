import { describe, expect, it } from "vitest";
import { regraDaCorrecaoDaVoz } from "../aprender-da-voz";
import { parseVoiceEntry } from "../voice-expense-parser";
import { chaveParaAprender } from "../vocabulario-falado";

describe("aprender com a correção", () => {
  it.each([
    ["Almoço no Coco Bambu", "coco bambu"],
    ["Ração da Mel", "racao"],
    ["Escola do Pedro", "escola"],
    ["Pão de açúcar", "pao de acucar"],
    ["Mensalidade da academia", "mensalidade da academia"],
    ["Gasolina no posto Shell", "posto shell"],
    ["Gás no fogão", "gas"],
    ["O fulano", "fulano"],
  ])("a palavra-chave de %j é %j", (fala, chave) => {
    expect(chaveParaAprender(fala)).toBe(chave);
  });

  it.each(["Compra", "Umas coisas", "Gasto do mês", "Coisinhas na lojinha", ""])("%j não tem palavra-chave", (fala) => {
    expect(chaveParaAprender(fala)).toBeNull();
  });

  it("o parser devolve a palavra-chave do gasto", () => {
    expect(parseVoiceEntry("50 reais de ração da Mel").chaveDaFala).toBe("racao");
    expect(parseVoiceEntry("gastei 50 reais").chaveDaFala).toBeNull();
  });

  it("trocou a sugestão: guarda a regra; aceitou: nada", () => {
    const base = { chave: "racao", sugestao: "OUTROS", parentCategory: "OUTROS" as const, customCategoryId: null, subcategory: "Pet" };
    expect(regraDaCorrecaoDaVoz(base)).toBeNull();
    expect(regraDaCorrecaoDaVoz({ ...base, customCategoryId: "mel" })).toEqual({ pattern: "racao", parentCategory: "OUTROS", customCategoryId: "mel" });
    expect(regraDaCorrecaoDaVoz({ ...base, parentCategory: "LAZER", subcategory: "Passeios" })).toEqual({ pattern: "racao", parentCategory: "LAZER", subcategory: "Passeios" });
  });

  it("não veio sugestão e ela escolheu: guarda", () => {
    expect(regraDaCorrecaoDaVoz({ chave: "fulano", sugestao: "", parentCategory: "LAZER", customCategoryId: null })).toEqual({ pattern: "fulano", parentCategory: "LAZER" });
  });

  it("palavra genérica nunca vira regra, mesmo vinda do aparelho", () => {
    for (const chave of ["compra", "coisa", "gasto", "no", "pix", "bar"]) {
      expect(regraDaCorrecaoDaVoz({ chave, sugestao: "", parentCategory: "LAZER", customCategoryId: null }), chave).toBeNull();
    }
  });

  it("depois de aprender, a próxima fala já vem certa", () => {
    const antes = parseVoiceEntry("50 reais de ração da Mel", { personalizadas: [{ id: "mel", name: "Cachorra Mel" }] });
    expect(antes.customCategoryId).toBe("mel");
    const contexto = { personalizadas: [{ id: "dog", name: "Bob" }] };
    const sugerida = parseVoiceEntry("ração do Bob 120", contexto);
    expect(sugerida).toMatchObject({ customCategoryId: "dog" });
    const regra = regraDaCorrecaoDaVoz({ chave: parseVoiceEntry("quentinha 18").chaveDaFala, sugestao: "ALIMENTACAO", parentCategory: "LAZER", customCategoryId: null, subcategory: "Passeios" });
    expect(regra).toEqual({ pattern: "quentinha", parentCategory: "LAZER", subcategory: "Passeios" });
    expect(parseVoiceEntry("mais uma quentinha 20 reais", { regras: [regra!] })).toMatchObject({ parentCategory: "LAZER", subcategory: "Passeios" });
  });
});
