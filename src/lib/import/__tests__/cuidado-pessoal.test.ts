import { describe, expect, it } from "vitest";
import { classify, classifyDictionaryOnly } from "../classify";
import { categoriaDaLinha } from "../motor";
import { categoriaParecida } from "../cuidado-pessoal";

// Roupa, calçado e beleza vão pra "Cuidado pessoal" (12/10/2026). As descrições têm o formato que
// as faturas trazem; nomes de pessoa são FICTÍCIOS.
const cuidado = (d: string) => classifyDictionaryOnly(d)?.cuidadoPessoal === true;

describe("dicionário: lojas de roupa, calçado e beleza", () => {
  it.each([
    "Levi's (3/3)",
    "LEVIS STORE MORUMBI",
    "Zara",
    "ZARA BRASIL - PARCELA 2/3",
    "INDITEX BRASIL LTDA",
    "LOJAS RENNER FL 123",
    "RENNER - PARCELA 1/4",
    "CEA - PARCELA 2/5",
    "C&A",
    "C & A MODAS LTDA",
    "RIACHUELO SPA",
    "SHEIN *SHEIN.COM",
    "BRS*SHEINCOM",
    "HERING STORE",
    "AREZZO ORDER 123",
    "SEPHORA STORE SAO PAULO",
    "HNA*OBOTICARIO - PARCELA 1/2",
    "O BOTICARIO SHOPPING",
    "NAT*NATURA PAGAMENTOS",
    "AVON COSMETICOS",
    "GRANADO PHARMACIAS",
    "QUEM DISSE BERENICE",
    "L'OCCITANE",
    "BELEZA NA WEB (2/2)",
    "SALAO DA ANA",
    "Pix enviado Salão Bela Vista",
    "BARBEARIA DO ZE",
    "ESMALTERIA NACIONAL",
    "MANICURE",
    "Torriton Beauty & Hair",
    "W ESTETICA ME",
    "SONEDA PERFUMARIA",
    "CENTAURO CE12 - PARCELA 1/3",
    "MLP*NETSHOES NS",
  ])("%s", (d) => {
    expect(classifyDictionaryOnly(d)).toEqual({ parentCategory: "OUTROS", subcategory: "Cuidado pessoal", cuidadoPessoal: true });
  });
});

describe("dicionário: o que NÃO é cuidado pessoal", () => {
  it.each([
    // Nome de gente igual a loja: em Pix, é a pessoa.
    "Pix enviado ZARA FERREIRA",
    "Transferência enviada pelo Pix - JOAO RENNER - •••.123.456-••",
    "PIX ENVIADO LEVI SANTOS",
    "PIX ENVIADO MARISA COSTA",
    "PIX ENVIADO MELISSA ALVES",
    // "c a" solto são iniciais, não a C&A.
    "PIX ENVIADO MARIA C A SOUZA",
    // Pedaço de palavra.
    "NATURAL DA TERRA",
    "SAVONA PIZZARIA",
    "FARMACIA DO TREVO",
    "BARRA SHOPPING ESTACIONAMENTO",
    // Salão de festas não é salão de beleza.
    "SALAO DE FESTAS COND",
    // Marketplace de tudo continua pergunta.
    "AMAZON MARKETPLACE",
    "SHOPEE *SHPSTECNOLOGIA",
    "EBN *TIKTOK SHOP",
    "LOJAS AMERICANAS",
  ])("%s", (d) => {
    expect(cuidado(d)).toBe(false);
  });

  it("tarifa, farmácia e luz continuam no lugar delas", () => {
    expect(classifyDictionaryOnly("SEGURO RENNER")?.subcategory).toBe("Tarifas bancárias");
    expect(classifyDictionaryOnly("ANUIDADE CARTAO RENNER")?.subcategory).toBe("Tarifas bancárias");
    expect(classifyDictionaryOnly("DROGARIA E PERFUMARIA SAO JOSE")?.subcategory).toBe("Farmácia");
    expect(classifyDictionaryOnly("CEA EQUATORIAL ENERGIA")?.subcategory).toBe("Luz");
    expect(classifyDictionaryOnly("CURSO DE MAQUIAGEM")?.parentCategory).toBe("EDUCACAO");
  });

  it("perfil Empresa não usa a lista", () => {
    expect(classifyDictionaryOnly("LOJAS RENNER FL 123", "EMPRESA")).toBeNull();
    expect(classifyDictionaryOnly("SALAO DA ANA", "EMPRESA")).toBeNull();
  });
});

describe("motor: a regra dela vence o dicionário", () => {
  it("Zara que ela ensinou como Lazer continua Lazer", () => {
    const r = categoriaDaLinha({ descricao: "ZARA BRASIL", regras: [{ pattern: "zara brasil", parentCategory: "LAZER" }], gasto: true });
    expect(r.motivo).toBe("regra_sua");
    expect(r.categoria?.cuidadoPessoal).toBeUndefined();
  });

  it("a regra dela com a categoria criada por ela manda", () => {
    const r = classify("Levi's (3/3)", [{ pattern: "levi", parentCategory: "OUTROS", customCategoryId: "cat-dela" }]);
    expect(r).toEqual({ parentCategory: "OUTROS", subcategory: undefined, customCategoryId: "cat-dela" });
  });

  it("sem regra, entra separado com motivo dicionário (não pergunta)", () => {
    const r = categoriaDaLinha({ descricao: "LOJAS RIACHUELO 45", regras: [], gasto: true });
    expect(r).toMatchObject({ motivo: "dicionario", confianca: "alta", categoria: { cuidadoPessoal: true } });
  });

  it("a comunidade dizendo Outros na Natura mantém o Cuidado pessoal", () => {
    const r = categoriaDaLinha({ descricao: "NAT*NATURA PAGAMENTOS", regras: [], gasto: true });
    expect(r.categoria).toMatchObject({ parentCategory: "OUTROS", cuidadoPessoal: true });
  });
});

describe("categoriaParecida: a categoria que ela já tem", () => {
  const c = (name: string, id = name) => ({ id, name });
  it("acha pelo nome, sem acento nem caixa", () => {
    expect(categoriaParecida([c("Pet"), c("cuidados pessoais")])?.name).toBe("cuidados pessoais");
    expect(categoriaParecida([c("Beleza e estética")])?.name).toBe("Beleza e estética");
    expect(categoriaParecida([c("Roupas")])?.name).toBe("Roupas");
    expect(categoriaParecida([c("Vestuário")])?.name).toBe("Vestuário");
    expect(categoriaParecida([c("Moda")])?.name).toBe("Moda");
    expect(categoriaParecida([c("Estética")])?.name).toBe("Estética");
  });
  it("prefere Cuidado pessoal a Beleza, e Beleza a Roupas", () => {
    expect(categoriaParecida([c("Roupas"), c("Beleza"), c("Cuidado pessoal")])?.name).toBe("Cuidado pessoal");
    expect(categoriaParecida([c("Roupas"), c("Beleza")])?.name).toBe("Beleza");
  });
  it("não confunde pedaço de palavra", () => {
    expect(categoriaParecida([c("Pessoal"), c("Modais"), c("Cuidado com o carro"), c("Roupeiro")])).toBeNull();
  });
});
