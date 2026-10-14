import { describe, expect, it } from "vitest";
import { parseVoiceEntry } from "../voice-expense-parser";
import { acharNoVocabulario, totalDeTermos } from "../vocabulario-falado";
import { CASOS_DIFICEIS, FRASES, FRASES_CEGAS, NAO_CHUTAR, type FraseEsperada } from "./frases-faladas";

function confere(f: FraseEsperada) {
  const r = parseVoiceEntry(f.frase, f.contexto ?? {});
  expect(r.category).toBe("EXPENSE");
  if (f.custom) expect(r.customCategoryId).toBe(f.custom);
  else expect({ mae: r.parentCategory, sub: r.subcategory, custom: r.customCategoryId }).toEqual({ mae: f.mae, sub: f.sub ?? null, custom: null });
}

describe("vocabulário falado (14/10/2026): mais jeitos de falar um gasto", () => {
  it("conhece centenas de termos", () => {
    expect(totalDeTermos()).toBeGreaterThanOrEqual(500);
    expect(FRASES.length + FRASES_CEGAS.length).toBeGreaterThanOrEqual(80);
    expect(NAO_CHUTAR.length).toBeGreaterThanOrEqual(15);
  });

  it.each(FRASES.map((f) => [f.frase, f]))("%j", (_, f) => confere(f));
  it.each(FRASES_CEGAS.map((f) => [f.frase, f]))("cega: %j", (_, f) => confere(f));
  it.each(CASOS_DIFICEIS.map((f) => [f.frase, f]))("difícil: %j", (_, f) => confere(f));

  it.each(NAO_CHUTAR)("não chuta: %j", (frase) => {
    expect(parseVoiceEntry(frase)).toMatchObject({ parentCategory: null, subcategory: null, customCategoryId: null });
  });
});

describe("casamento tolerante", () => {
  it("plural, diminutivo e sem acento", () => {
    expect(acharNoVocabulario("pasteis")?.termo).toBe("pastel");
    expect(acharNoVocabulario("paes")?.termo).toBe("pao");
    expect(acharNoVocabulario("cervejinha")?.termo).toBe("cerveja");
    expect(acharNoVocabulario("churrasquinho")?.termo).toBe("churrasco");
    expect(acharNoVocabulario("Remédios")?.termo).toBe("remedio");
  });

  it("erro pequeno do reconhecedor em palavra de 5 letras ou mais", () => {
    expect(acharNoVocabulario("farmasia")).toMatchObject({ termo: "farmacia", exato: false });
    expect(acharNoVocabulario("estacionamentu")).toMatchObject({ termo: "estacionamento", exato: false });
  });

  it("sem falso positivo: palavra dentro de palavra, palavra comum e nome de gente", () => {
    expect(acharNoVocabulario("barbeiro")?.subcategory).toBe("Cuidado pessoal");
    expect(acharNoVocabulario("gasolina")?.subcategory).toBe("Combustível");
    expect(acharNoVocabulario("gas")?.subcategory).toBe("Gás");
    for (const p of ["saldo", "muita", "camila", "musica", "emprestado", "barraca", "carlos", "boleto", "feita"]) {
      expect(acharNoVocabulario(p), p).toBeNull();
    }
    // Palavra de menos de 5 letras nunca é "corrigida".
    expect(acharNoVocabulario("bat")).toBeNull();
  });

  it("a expressão mais comprida ganha, e o pet diz para quem foi", () => {
    expect(acharNoVocabulario("pao de acucar")?.subcategory).toBe("Supermercado");
    expect(acharNoVocabulario("cachorro quente")?.subcategory).toBe("Restaurante");
    expect(acharNoVocabulario("vacina do cachorro")?.subcategory).toBe("Pet");
    expect(acharNoVocabulario("gas no fogao")?.subcategory).toBe("Gás");
  });

  it("perfil Empresa não usa o vocabulário da pessoa física", () => {
    expect(parseVoiceEntry("quentinha 18 reais", { profileKind: "EMPRESA" }).parentCategory).toBeNull();
  });
});

describe("a ordem continua: regra dela > categorias dela > comunidade e extrato > vocabulário falado", () => {
  it("a regra dela vence o vocabulário", () => {
    const regras = [{ pattern: "quentinha", parentCategory: "LAZER" as const, subcategory: "Passeios" }];
    expect(parseVoiceEntry("quentinha 18 reais", { regras })).toMatchObject({ parentCategory: "LAZER", subcategory: "Passeios" });
  });
  it("o nome da categoria dela vence o vocabulário", () => {
    expect(parseVoiceEntry("quentinha 20 reais", { personalizadas: [{ id: "q", name: "Quentinha" }] }).customCategoryId).toBe("q");
  });
  it("roupa, pet e filhos vão para a categoria dela desse assunto", () => {
    expect(parseVoiceEntry("veterinário 200", { personalizadas: [{ id: "c", name: "Cachorro" }] }).customCategoryId).toBe("c");
    expect(parseVoiceEntry("babá 300", { personalizadas: [{ id: "k", name: "Crianças" }] }).customCategoryId).toBe("k");
    expect(parseVoiceEntry("blusinha 60", { personalizadas: [{ id: "r", name: "Roupas" }] }).customCategoryId).toBe("r");
  });
});

describe("descrição curta", () => {
  it.each([
    ["gastei 300 reais com posto", "Posto"],
    ["gastei 35 reais no almoço", "Almoço"],
    ["50 reais de ração da Mel", "Ração da Mel"],
    ["uber 23 reais", "Uber"],
    ["fiz o rancho 600 reais", "Rancho"],
    ["troquei o pneu 400 reais", "Pneu"],
    ["paguei 18 reais no noventa e nove", "99"],
  ])("%j → %j", (frase, descricao) => {
    expect(parseVoiceEntry(frase).description).toBe(descricao);
  });

  it("o app 99 por extenso não vira valor, mas noventa e nove reais continua sendo valor", () => {
    expect(parseVoiceEntry("paguei no noventa e nove 15")).toMatchObject({ amount: 15, subcategory: "Aplicativo" });
    expect(parseVoiceEntry("paguei noventa e nove reais de luz")).toMatchObject({ amount: 99, subcategory: "Luz", description: "Luz" });
  });
});
