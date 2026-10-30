import { describe, expect, it } from "vitest";
import { CUSTOM_CATEGORY_ICON_KEYS, CORES_DE_CATEGORIA } from "@/lib/categories";
import { categoriaDaFala } from "@/lib/entries/categoria-da-fala";
import { categoriaDaLinha, categorizarLinha } from "@/lib/import/motor";
import { assuntoDoNome, CATEGORIAS_QUE_JA_NASCEM, idsDasQueJaNascem, sugeridasQueFaltam } from "../que-ja-nascem";

/** As sete que nascem com o perfil, como a pessoa as teria no banco. */
const TODAS = CATEGORIAS_QUE_JA_NASCEM.map((c) => ({ id: `id-${c.assunto}`, name: c.nome }));
const motor = (descricao: string, personalizadas: { id: string; name: string }[], regras: Parameters<typeof categorizarLinha>[0]["regras"] = []) =>
  categorizarLinha({ descricao, regras, gasto: true, personalizadas: new Set(personalizadas.map((c) => c.id)), queJaNascem: idsDasQueJaNascem(personalizadas) });

describe("a lista que já nasce", () => {
  it("usa ícone e cor que existem (uma chave errada deixaria a categoria com o ícone de reserva)", () => {
    for (const c of CATEGORIAS_QUE_JA_NASCEM) {
      expect(CUSTOM_CATEGORY_ICON_KEYS, c.nome).toContain(c.icone);
      expect(CORES_DE_CATEGORIA, c.nome).toContain(c.cor);
    }
  });

  it("Viagem fica de fora: tem área própria no app", () => {
    expect(CATEGORIAS_QUE_JA_NASCEM.some((c) => /viagem/i.test(c.nome))).toBe(false);
  });

  it("reconhece o nome dela sem acento e sem caixa, e os parecidos", () => {
    expect(assuntoDoNome("roupas")).toBe("roupas");
    expect(assuntoDoNome("ROUPA ")).toBe("roupas");
    expect(assuntoDoNome("Vestuário")).toBe("roupas");
    expect(assuntoDoNome("Doações")).toBe("doacao");
    expect(assuntoDoNome("Dízimo")).toBe("doacao");
    expect(assuntoDoNome("Streaming")).toBe("assinaturas");
    expect(assuntoDoNome("Pets")).toBe("pet");
    expect(assuntoDoNome("Dani Invest")).toBeNull();
    expect(assuntoDoNome("")).toBeNull();
  });
});

describe("chips Sugeridas: só o que falta", () => {
  it("sem nenhuma, sugere as sete", () => {
    expect(sugeridasQueFaltam([]).map((c) => c.nome)).toEqual(["Beleza", "Roupas", "Presentes", "Pet", "Assinaturas", "Academia", "Doação"]);
  });

  it("a que ela já tem (com outro nome ou acento) sai da lista", () => {
    const faltam = sugeridasQueFaltam([{ name: "roupa" }, { name: "PETS" }, { name: "Dízimo" }, { name: "Dani Invest" }]);
    expect(faltam.map((c) => c.nome)).toEqual(["Beleza", "Presentes", "Assinaturas", "Academia"]);
  });

  it("com todas, não sobra nada (a linha some)", () => {
    expect(sugeridasQueFaltam(TODAS)).toEqual([]);
  });

  it("duas dela para o mesmo assunto: vale a primeira (a mais antiga)", () => {
    const ids = idsDasQueJaNascem([
      { id: "velha", name: "Roupas" },
      { id: "nova", name: "Vestuário" },
    ]);
    expect(ids.get("roupas")).toBe("velha");
  });
});

describe("importação: a loja vai para a personalizada dela, quando ela a tem", () => {
  it.each([
    ["LOJAS RENNER UBERLANDIA", "roupas"],
    ["ZARA BRASIL SAO PAULO", "roupas"],
    ["SHEIN COM", "roupas"],
    ["PETZ 123", "pet"],
    ["COBASI SHOPPING", "pet"],
    ["NETFLIX.COM", "assinaturas"],
    ["SPOTIFY", "assinaturas"],
    ["SMART FIT", "academia"],
    ["ACADEMIA CORPO EM FORMA", "academia"],
    ["SEPHORA", "beleza"],
    ["O BOTICARIO", "beleza"],
    ["SALAO DA ANA", "beleza"],
    ["MANICURE", "beleza"],
    ["IGREJA BATISTA DIZIMO", "doacao"],
  ])("%s → %s", (descricao, assunto) => {
    const r = motor(descricao, TODAS);
    expect(r?.classificacao.customCategoryId).toBe(`id-${assunto}`);
    expect(r?.classificacao.subcategory).toBeUndefined();
    expect(r?.origem).not.toBe("dela");
  });

  it("sem a personalizada, fica como hoje (a mãe e a subcategoria do dicionário)", () => {
    expect(motor("LOJAS RENNER UBERLANDIA", [])?.classificacao).toMatchObject({ parentCategory: "OUTROS", subcategory: "Cuidado pessoal", cuidadoPessoal: true });
    expect(motor("LOJAS RENNER UBERLANDIA", [])?.classificacao.customCategoryId).toBeUndefined();
    expect(motor("NETFLIX.COM", [{ id: "x", name: "Dani Invest" }])?.classificacao).toMatchObject({ parentCategory: "LAZER", subcategory: "Streaming" });
    expect(motor("PETZ 123", [])?.classificacao).toMatchObject({ parentCategory: "OUTROS", subcategory: "Pet" });
  });

  it("só a Roupas (sem Beleza): a Renner vai para Roupas e a Sephora fica na reserva do dicionário", () => {
    const so = [{ id: "r", name: "Roupas" }];
    expect(motor("LOJAS RENNER UBERLANDIA", so)?.classificacao.customCategoryId).toBe("r");
    const sephora = motor("SEPHORA", so)?.classificacao;
    expect(sephora?.customCategoryId).toBeUndefined();
    expect(sephora?.cuidadoPessoal).toBe(true);
  });

  it("a regra que ela ensinou vence sempre, mesmo contra a personalizada do assunto", () => {
    const regras = [{ pattern: "netflix", parentCategory: "EDUCACAO" as const, customCategoryId: "id-presentes" }];
    const r = motor("NETFLIX.COM", TODAS, regras);
    expect(r?.origem).toBe("dela");
    expect(r?.classificacao.customCategoryId).toBe("id-presentes");
    const mae = motor("NETFLIX.COM", TODAS, [{ pattern: "netflix", parentCategory: "EDUCACAO" as const }]);
    expect(mae?.origem).toBe("dela");
    expect(mae?.classificacao).toEqual({ parentCategory: "EDUCACAO", subcategory: undefined });
  });

  it("pela porta da revisão (categoriaDaLinha), o motivo continua sendo o do dicionário", () => {
    const r = categoriaDaLinha({ descricao: "PETZ 123", regras: [], gasto: true, queJaNascem: idsDasQueJaNascem(TODAS) });
    expect(r).toMatchObject({ motivo: "dicionario", confianca: "alta", categoria: { customCategoryId: "id-pet" } });
  });

  it("na Empresa nada muda: o dicionário de lá não fala de roupa nem de pet", () => {
    const r = categorizarLinha({ descricao: "PETZ 123", regras: [], gasto: true, profileKind: "EMPRESA", queJaNascem: idsDasQueJaNascem(TODAS) });
    expect(r?.classificacao.customCategoryId).toBeUndefined();
  });
});

describe("voz: a mesma personalizada", () => {
  it("'academia', 'ração do cachorro', 'presente da minha mãe', 'netflix', 'zara' vão para a dela", () => {
    expect(categoriaDaFala("academia", { personalizadas: TODAS })?.customCategoryId).toBe("id-academia");
    expect(categoriaDaFala("ração do cachorro", { personalizadas: TODAS })?.customCategoryId).toBe("id-pet");
    expect(categoriaDaFala("presente da minha mãe", { personalizadas: TODAS })?.customCategoryId).toBe("id-presentes");
    expect(categoriaDaFala("netflix", { personalizadas: TODAS })?.customCategoryId).toBe("id-assinaturas");
    expect(categoriaDaFala("zara", { personalizadas: TODAS })?.customCategoryId).toBe("id-roupas");
  });

  it("sem a personalizada, fica como era", () => {
    expect(categoriaDaFala("academia", { personalizadas: [] })).toMatchObject({ parentCategory: "SAUDE", subcategory: "Academia" });
    expect(categoriaDaFala("ração do cachorro", { personalizadas: [] })).toMatchObject({ parentCategory: "OUTROS", subcategory: "Pet" });
  });

  it("a regra dela vence a personalizada do assunto", () => {
    const regras = [{ pattern: "academia", parentCategory: "SAUDE" as const, customCategoryId: "id-beleza" }];
    expect(categoriaDaFala("academia", { personalizadas: TODAS, regras })?.customCategoryId).toBe("id-beleza");
  });
});
