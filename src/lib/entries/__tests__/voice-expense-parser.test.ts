import { describe, expect, it } from "vitest";
import { parseVoiceEntry } from "../voice-expense-parser";

describe("parseVoiceEntry", () => {
  it("parses a spoken amount in extenso with a category keyword", () => {
    const result = parseVoiceEntry("gastei quinhentos reais com farmácia");
    expect(result.category).toBe("EXPENSE");
    expect(result.parentCategory).toBe("SAUDE");
    expect(result.amount).toBe(500);
    expect(result.description).toBe("Farmácia");
  });

  it("parses a digit amount with R$ prefix", () => {
    const result = parseVoiceEntry("gastei R$45,90 no mercado");
    expect(result.category).toBe("EXPENSE");
    expect(result.parentCategory).toBe("ALIMENTACAO");
    expect(result.amount).toBeCloseTo(45.9, 6);
  });

  it("recognizes INCOME verbs", () => {
    const result = parseVoiceEntry("recebi 3000 reais de salário");
    expect(result.category).toBe("INCOME");
    expect(result.amount).toBe(3000);
    expect(result.parentCategory).toBeNull();
  });

  it("recognizes INVESTMENT_CONTRIBUTION verbs", () => {
    const result = parseVoiceEntry("investi mil reais em cdb");
    expect(result.category).toBe("INVESTMENT_CONTRIBUTION");
    expect(result.parentCategory).toBe("OUTROS");
    expect(result.amount).toBe(1000);
  });

  it("defaults to EXPENSE when no verb is recognized", () => {
    const result = parseVoiceEntry("cem reais de uber");
    expect(result.category).toBe("EXPENSE");
    expect(result.parentCategory).toBe("TRANSPORTE");
    expect(result.amount).toBe(100);
  });

  it("returns null amount when nothing matches", () => {
    const result = parseVoiceEntry("comprei um presente pra ela");
    expect(result.amount).toBeNull();
  });

  it("returns null parentCategory when no keyword matches", () => {
    const result = parseVoiceEntry("gastei 50 reais com uma coisa qualquer");
    expect(result.parentCategory).toBeNull();
    expect(result.amount).toBe(50);
  });

  it("is accent-insensitive when matching keywords", () => {
    const result = parseVoiceEntry("paguei a conta de água esse mês, 120 reais");
    expect(result.parentCategory).toBe("MORADIA");
    expect(result.amount).toBe(120);
  });

  it("handles compound extenso numbers with mil", () => {
    const result = parseVoiceEntry("recebi mil e duzentos reais");
    expect(result.amount).toBe(1200);
  });

  it("cleans the description even when no category matches", () => {
    const result = parseVoiceEntry("gastei 30 reais com uma coisa qualquer");
    expect(result.description).toBe("Coisa qualquer");
    expect(result.parentCategory).toBeNull();
  });
  // O caso que a Dani gravou: "acabei de receber 4 mil reais" virava um GASTO de R$ 4,00 —
  // dois erros no mesmo áudio (o verbo no infinitivo e o "mil" solto).
  it("understands receber in any conjugation, not just the past tense", () => {
    const result = parseVoiceEntry("acabei de receber 4 mil reais");
    expect(result.category).toBe("INCOME");
    expect(result.amount).toBe(4000);
  });

  it.each([
    ["vou receber o pagamento amanhã", "INCOME"],
    ["me pagaram 500 reais", "INCOME"],
    ["caiu o salário hoje", "INCOME"],
    ["vendi a bicicleta por 300 reais", "INCOME"],
    ["o freela de setembro, 1200", "INCOME"],
    ["guardei 300 reais", "INVESTMENT_CONTRIBUTION"],
    ["comprei ações, 800 reais", "INVESTMENT_CONTRIBUTION"],
    ["comprei um presente de 80 reais", "EXPENSE"],
  ])("classifies %j as %s", (frase, tipo) => {
    expect(parseVoiceEntry(frase).category).toBe(tipo);
  });

  it("lets the first verb in the sentence win, not the first rule in the list", () => {
    // "salário" sozinho é renda, mas quem veio antes foi o "paguei".
    expect(parseVoiceEntry("paguei o salário da diarista, 200 reais").category).toBe("EXPENSE");
    expect(parseVoiceEntry("recebi o salário e paguei o aluguel").category).toBe("INCOME");
  });

  it("reads amounts spoken with mil, including the extenso tail", () => {
    expect(parseVoiceEntry("gastei 4 mil reais").amount).toBe(4000);
    expect(parseVoiceEntry("recebi 4 mil e quinhentos reais").amount).toBe(4500);
    expect(parseVoiceEntry("aportei 2,5 mil reais").amount).toBe(2500);
    expect(parseVoiceEntry("recebi 2 milhões").amount).toBe(2_000_000);
  });

  it("prefers the number glued to the money over a loose one", () => {
    expect(parseVoiceEntry("gastei 2 cafés de 15 reais").amount).toBe(15);
  });

  it("keeps income out of the expense categories", () => {
    const result = parseVoiceEntry("recebi 4 mil de aluguel");
    expect(result.category).toBe("INCOME");
    expect(result.parentCategory).toBeNull();
  });

  it("names the income in the description when the sentence says what it was", () => {
    expect(parseVoiceEntry("recebi 3000 reais de salário").description).toBe("Salário");
  });

  describe("moeda falada (quem mora fora)", () => {
    it("hears euros, dollars and pounds, with the amount anchored on the currency word", () => {
      const eur = parseVoiceEntry("recebi dois mil euros de salário");
      expect(eur).toMatchObject({ category: "INCOME", amount: 2000, currency: "EUR", description: "Salário" });
      expect(parseVoiceEntry("gastei 45 dólares no mercado")).toMatchObject({ amount: 45, currency: "USD" });
      expect(parseVoiceEntry("paguei 1.200 libras de aluguel")).toMatchObject({ amount: 1200, currency: "GBP" });
      expect(parseVoiceEntry("2 cafés de 3 euros")).toMatchObject({ amount: 3, currency: "EUR" });
    });

    it("leaves the currency empty when none was said, and explicit in reais", () => {
      expect(parseVoiceEntry("gastei 50 no mercado").currency).toBeNull();
      expect(parseVoiceEntry("recebi 3000 reais de salário").currency).toBe("BRL");
    });

    it("reads the currency symbols the speech recognizer writes (US$, €, £)", () => {
      expect(parseVoiceEntry("gastei US$ 50 no uber")).toMatchObject({ amount: 50, currency: "USD" });
      expect(parseVoiceEntry("gastei € 2.000")).toMatchObject({ amount: 2000, currency: "EUR" });
      expect(parseVoiceEntry("gastei 2.000 €")).toMatchObject({ amount: 2000, currency: "EUR" });
      expect(parseVoiceEntry("paguei £ 30")).toMatchObject({ amount: 30, currency: "GBP" });
      expect(parseVoiceEntry("gastei R$ 50 no mercado").currency).toBe("BRL");
    });
  });

  describe("milhar com a sobra em dígito (\"4 mil e 500\")", () => {
    it("adds the digit tail to the thousands instead of picking it alone", () => {
      expect(parseVoiceEntry("recebi 4 mil e 500 reais de salário").amount).toBe(4500);
      expect(parseVoiceEntry("paguei 1 mil e 200 reais de aluguel").amount).toBe(1200);
      expect(parseVoiceEntry("recebi 4 mil e 500").amount).toBe(4500);
      expect(parseVoiceEntry("recebi 2 mil e 50 euros").amount).toBe(2050);
    });

    it("keeps the words tail and the plain thousands working", () => {
      expect(parseVoiceEntry("recebi 4 mil e quinhentos reais").amount).toBe(4500);
      expect(parseVoiceEntry("recebi 4 mil reais").amount).toBe(4000);
      expect(parseVoiceEntry("gastei R$ 4.500 no mercado").amount).toBe(4500);
    });
  });
});

describe("voz com shekel (cliente em Israel, 12/10/2026)", () => {
  it("entende shekels, ₪ e número sem moeda", () => {
    const a = parseVoiceEntry("recebi 15 mil shekels de salário");
    expect(a.amount).toBe(15000);
    expect(a.currency).toBe("ILS");
    expect(a.category).toBe("INCOME");
    expect(parseVoiceEntry("₪ 50 no mercado")).toMatchObject({ amount: 50, currency: "ILS" });
    expect(parseVoiceEntry("gastei 80 sheqel no uber")).toMatchObject({ amount: 80, currency: "ILS" });
    expect(parseVoiceEntry("gastei 500 pesos no mercado")).toMatchObject({ amount: 500, currency: "ARS" });
    expect(parseVoiceEntry("AR$ 1200 de taxi")).toMatchObject({ amount: 1200, currency: "ARS" });
    expect(parseVoiceEntry("mercado 120")).toMatchObject({ amount: 120, currency: null });
  });
  it("continua entendendo dólar e euro", () => {
    expect(parseVoiceEntry("gastei 30 dólares no uber")).toMatchObject({ amount: 30, currency: "USD" });
    expect(parseVoiceEntry("paguei 2 mil euros de aluguel")).toMatchObject({ amount: 2000, currency: "EUR" });
  });
});

describe("a voz usa o motor da importação (14/10/2026)", () => {
  it("o caso da Dani: posto é Combustível, com a descrição limpa", () => {
    expect(parseVoiceEntry("gastei 300 reais com posto")).toMatchObject({
      category: "EXPENSE",
      parentCategory: "TRANSPORTE",
      subcategory: "Combustível",
      amount: 300,
      description: "Posto",
    });
  });

  it.each([
    ["paguei 45 no ifood", "ALIMENTACAO", "Delivery", "iFood"],
    ["50 reais de remédio", "SAUDE", "Farmácia", "Remédio"],
    ["paguei 20 no uber", "TRANSPORTE", "Aplicativo", "Uber"],
    ["gastei 120 reais no almoço no Coco Bambu", "ALIMENTACAO", "Restaurante", "Almoço no Coco Bambu"],
    ["gastei 70 reais na janta", "ALIMENTACAO", "Restaurante", "Janta"],
  ])("%j → %s › %s, descrição %j", (frase, mae, sub, descricao) => {
    expect(parseVoiceEntry(frase)).toMatchObject({ parentCategory: mae, subcategory: sub, description: descricao });
  });

  it("roupa vai para a categoria Cuidado pessoal dela, ou Outros › Cuidado pessoal sem ela", () => {
    expect(parseVoiceEntry("comprei uma blusa na zara 199")).toMatchObject({
      parentCategory: "OUTROS",
      subcategory: "Cuidado pessoal",
      customCategoryId: null,
      amount: 199,
    });
    const dela = parseVoiceEntry("comprei uma blusa na zara 199", { personalizadas: [{ id: "cp", name: "Beleza" }] });
    expect(dela).toMatchObject({ parentCategory: null, customCategoryId: "cp", amount: 199 });
  });

  it("não chuta: o que o motor não conhece fica sem categoria", () => {
    expect(parseVoiceEntry("gastei 80 reais com o fulano")).toMatchObject({ parentCategory: null, subcategory: null, customCategoryId: null });
  });

  it("a regra que ela ensinou vence o dicionário", () => {
    const regras = [{ pattern: "coco bambu", parentCategory: "LAZER" as const, subcategory: "Passeios" }];
    expect(parseVoiceEntry("gastei 120 reais no almoço no Coco Bambu", { regras })).toMatchObject({ parentCategory: "LAZER", subcategory: "Passeios" });
    const propria = [{ pattern: "shell", parentCategory: "OUTROS" as const, customCategoryId: "carro" }];
    expect(parseVoiceEntry("gastei 300 reais no shell", { regras: propria, personalizadas: [{ id: "carro", name: "Carro" }] })).toMatchObject({
      parentCategory: null,
      customCategoryId: "carro",
    });
  });

  it("o nome da categoria que ela criou, dito na frase, escolhe essa categoria", () => {
    expect(parseVoiceEntry("gastei 60 no pet", { personalizadas: [{ id: "pet", name: "Pet" }] })).toMatchObject({ customCategoryId: "pet", description: "Pet" });
  });

  it("as moedas continuam, e a descrição fica sem elas", () => {
    expect(parseVoiceEntry("gastei 80 sheqel no uber")).toMatchObject({ amount: 80, currency: "ILS", parentCategory: "TRANSPORTE", description: "Uber" });
    expect(parseVoiceEntry("AR$ 1200 de taxi")).toMatchObject({ amount: 1200, currency: "ARS", parentCategory: "TRANSPORTE", description: "Táxi" });
    expect(parseVoiceEntry("gastei 500 pesos argentinos no mercado")).toMatchObject({ amount: 500, currency: "ARS", parentCategory: "ALIMENTACAO", description: "Mercado" });
    expect(parseVoiceEntry("gastei € 2.000 no hotel")).toMatchObject({ amount: 2000, currency: "EUR", parentCategory: "LAZER", description: "Hotel" });
    expect(parseVoiceEntry("paguei 30 dólares no uber")).toMatchObject({ currency: "USD", description: "Uber" });
  });

  it("frase só com verbo e valor fica sem descrição", () => {
    expect(parseVoiceEntry("gastei 300 reais").description).toBe("");
    expect(parseVoiceEntry("gastei quinhentos reais").description).toBe("");
    expect(parseVoiceEntry("gastei 4 mil e quinhentos reais no aluguel").description).toBe("Aluguel");
  });

  it("o app 99 não some como se fosse valor", () => {
    expect(parseVoiceEntry("paguei 15 no 99")).toMatchObject({ amount: 15, parentCategory: "TRANSPORTE", subcategory: "Aplicativo", description: "99" });
  });
});

describe("valor falado: centavos e jeitos de escrever o número (14/10/2026)", () => {
  it("12 reais e 50 centavos é 12,50, e a descrição não leva os centavos", () => {
    expect(parseVoiceEntry("gastei 12 reais e 50 centavos na padaria")).toMatchObject({ amount: 12.5, description: "Padaria" });
  });
  it("um real e noventa por extenso", () => {
    expect(parseVoiceEntry("gastei um real e noventa")).toMatchObject({ amount: 1.9, description: "" });
  });
  it("12 reais e 50 na padaria", () => {
    expect(parseVoiceEntry("gastei 12 reais e 50 na padaria")).toMatchObject({ amount: 12.5, description: "Padaria" });
  });
  it("não inventa centavos de outra coisa", () => {
    expect(parseVoiceEntry("paguei 30 reais e 2 cafés").amount).toBe(30);
    expect(parseVoiceEntry("gastei 50 reais e 20 de gorjeta").amount).toBe(50);
  });
  it("100.50 é cem e cinquenta, não dez mil", () => {
    expect(parseVoiceEntry("gastei 100.50 no mercado").amount).toBe(100.5);
  });
  it("1.5 mil é mil e quinhentos", () => {
    expect(parseVoiceEntry("gastei 1.5 mil na viagem").amount).toBe(1500);
  });
  it("número escrito do jeito de fora: US$ 1,234.56", () => {
    expect(parseVoiceEntry("gastei US$ 1,234.56 em compras")).toMatchObject({ amount: 1234.56, currency: "USD" });
  });
  it("o jeito do Brasil continua: R$ 1.250,90", () => {
    expect(parseVoiceEntry("paguei R$ 1.250,90 de aluguel").amount).toBe(1250.9);
  });
});
