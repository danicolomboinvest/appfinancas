import { describe, expect, it } from "vitest";
import { classify, normalizeMerchant, padraoAprendivel, padroesDaCorrecao, type LearnedRule } from "../classify";

// Cobertura extra (set/2026). Descrições FICTÍCIAS no formato dos bancos.
// Os antigos `it.fails` (bugs conhecidos) foram corrigidos em classify.ts e viraram `it`.

describe("classify: regras embutidas, bordas", () => {
  it("plural e acento casam a mesma palavra", () => {
    expect(classify("FARMACIAS EXEMPLO")?.subcategory).toBe("Farmácia");
    expect(classify("SUPERMERCADOS EXEMPLO")?.subcategory).toBe("Supermercado");
    expect(classify("PÃO DE AÇÚCAR 123")?.subcategory).toBe("Supermercado");
    expect(classify("Pão de Acucar Loja 12")?.subcategory).toBe("Supermercado");
  });

  it("delivery vem antes do aplicativo de transporte", () => {
    expect(classify("UBER EATS PEDIDO")?.subcategory).toBe("Delivery");
    expect(classify("UBERTRIP 1234")?.subcategory).toBe("Aplicativo");
  });

  it("descrição vazia ou só com número vai pra revisão", () => {
    expect(classify("")).toBeNull();
    expect(classify("123456")).toBeNull();
    expect(classify("   ")).toBeNull();
  });

  it("Pix com CNPJ no meio: corta no CNPJ e não lê o banco do outro lado", () => {
    expect(classify("Transferência enviada pelo Pix - ESCOLA EXEMPLO LTDA - 12.345.678/0001-90 - BANCO EXEMPLO INTERNET (0001) Agência: 1 Conta: 2")).toEqual({
      parentCategory: "EDUCACAO",
      subcategory: "Mensalidade",
    });
  });

  it("aplicação do Nubank não é gasto do dia a dia", () => {
    expect(classify("Aplicação RDB")).toEqual({ parentCategory: "OUTROS", subcategory: "Investimento" });
  });

  // KW_IMPOSTO inteiro levava a subcategoria "Imposto de renda", mas a lista de
  // Impostos tem IPTU, IPVA, DARF e Taxas públicas separados (categories.ts:128).
  it("IPVA e IPTU caem na subcategoria certa, não em 'Imposto de renda'", () => {
    expect(classify("IPVA 2026 SEFAZ")?.subcategory).toBe("IPVA");
    expect(classify("IPTU PREFEITURA EXEMPLO")?.subcategory).toBe("IPTU");
  });

  // Sobrenome/palavra comum que é nome de empresa: o Pix pra uma PESSOA vira categoria sem
  // passar pela revisão ("Azul" e "Gol" são companhias aéreas; "Show", "Energia" também pegam).
  it("Pix pra pessoa com sobrenome 'Azul' não vira Viagens", () => {
    expect(classify("PIX ENVIADO - ANA AZUL")).toBeNull();
  });

  it("'SHOW DE BOLA LANCHES' é lanchonete, não Cinema/Shows", () => {
    expect(classify("SHOW DE BOLA LANCHES")?.subcategory).not.toBe("Cinema/Shows");
  });

  it("bebida energética não é conta de luz", () => {
    expect(classify("BEBIDA ENERGIA EXEMPLO")?.subcategory).not.toBe("Luz");
  });
});

describe("regras aprendidas: bordas", () => {
  it("padrão vazio ou genérico no banco é ignorado", () => {
    const rules: LearnedRule[] = [
      { pattern: "", parentCategory: "LAZER" },
      { pattern: "no", parentCategory: "LAZER" },
    ];
    expect(classify("Compra no débito - LOJA X", rules)).toBeNull();
  });

  it("3 letras já é nome (KFC), mas 2 não", () => {
    expect(padraoAprendivel("kfc")).toBe(true);
    expect(padraoAprendivel("ab")).toBe(false);
    expect(padraoAprendivel("pix enviado ab")).toBe(false);
  });

  it("regra aprendida ganha da embutida no perfil pessoal", () => {
    const rules: LearnedRule[] = [{ pattern: "posto exemplo", parentCategory: "ALIMENTACAO", subcategory: "Restaurante" }];
    expect(classify("POSTO EXEMPLO 123", rules)).toEqual({ parentCategory: "ALIMENTACAO", subcategory: "Restaurante" });
  });

  it("normalizeMerchant tira parcela, data e meio de pagamento", () => {
    expect(normalizeMerchant("PARCELA LOJA EXEMPLO 03/10")).toBe("loja exemplo");
    expect(normalizeMerchant("Pix - Débito - Crédito - Cartão")).toBe("");
  });

  it("padroesDaCorrecao ignora descrição que vira só número", () => {
    expect(
      padroesDaCorrecao([{ description: "123 456", category: "EXPENSE", parentCategory: "OUTROS", customCategoryId: null, importada: true }], "LAZER"),
    ).toEqual([]);
  });
});
