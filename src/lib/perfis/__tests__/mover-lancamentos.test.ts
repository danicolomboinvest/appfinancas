import { describe, expect, it } from "vitest";
import {
  camposQueSaem,
  categoriaNoDestino,
  categoriasMudamDeSentido,
  chaveDaCompraParcelada,
  comerciantesParaLembrar,
  destinoPelaRegra,
  parcelasDaMesmaCompra,
  type LancamentoParaMover,
} from "../mover-lancamentos";

const gasto = (o: Partial<LancamentoParaMover>): LancamentoParaMover => ({
  category: "EXPENSE",
  parentCategory: null,
  customCategoryId: null,
  subcategory: null,
  description: "LOJA",
  amount: 50,
  ...o,
});

const base = { personalizadasDoDestino: [], regrasDoDestino: [] };

describe("categoria no destino", () => {
  it("Pessoal para Casal: a categoria padrão fica (mesma chave, mesmo sentido)", () => {
    const r = categoriaNoDestino({ ...base, lancamento: gasto({ parentCategory: "ALIMENTACAO", subcategory: "Mercado" }), origemKind: "PESSOAL", destinoKind: "CASAL" });
    expect(r).toEqual({ parentCategory: "ALIMENTACAO", customCategoryId: null, subcategory: "Mercado" });
  });

  it("Pessoal para Empresa: o motor da Empresa decide (Canva vira software, não Outros)", () => {
    const r = categoriaNoDestino({ ...base, lancamento: gasto({ parentCategory: "OUTROS", subcategory: "Assinaturas e apps", description: "CANVA" }), origemKind: "PESSOAL", destinoKind: "EMPRESA" });
    expect(r.parentCategory).toBe("MORADIA");
    expect(r.subcategory).toBe("Software e assinaturas");
  });

  it("Pessoal para Empresa sem palpite: entra sem categoria, para revisar lá", () => {
    const r = categoriaNoDestino({ ...base, lancamento: gasto({ parentCategory: "ALIMENTACAO", description: "ZZZ LOJA DESCONHECIDA" }), origemKind: "PESSOAL", destinoKind: "EMPRESA" });
    expect(r).toEqual({ parentCategory: null, customCategoryId: null, subcategory: null });
  });

  it("a regra que ela ensinou na Empresa manda", () => {
    const r = categoriaNoDestino({
      ...base,
      lancamento: gasto({ parentCategory: "EDUCACAO", description: "KALUNGA SP" }),
      origemKind: "PESSOAL",
      destinoKind: "EMPRESA",
      regrasDoDestino: [{ pattern: "kalunga", parentCategory: "ALIMENTACAO", subcategory: "Insumos" }],
    });
    expect(r).toEqual({ parentCategory: "ALIMENTACAO", customCategoryId: null, subcategory: "Insumos" });
  });

  it("personalizada que existe no destino com o mesmo nome: usa a de lá", () => {
    const r = categoriaNoDestino({
      ...base,
      lancamento: gasto({ customCategoryId: "pet-pessoal" }),
      origemKind: "PESSOAL",
      destinoKind: "CASAL",
      nomeDaPersonalizada: "Pet",
      personalizadasDoDestino: [{ id: "pet-casal", name: "pet " }],
    });
    expect(r).toEqual({ parentCategory: null, customCategoryId: "pet-casal", subcategory: null });
  });

  it("personalizada que não existe no destino: nunca leva o id do outro perfil", () => {
    const r = categoriaNoDestino({ ...base, lancamento: gasto({ customCategoryId: "pet-pessoal", description: "PETZ" }), origemKind: "PESSOAL", destinoKind: "CASAL", nomeDaPersonalizada: "Pet" });
    expect(r.customCategoryId).toBeNull();
  });

  it("personalizada do destino pela regra só vale se existe lá", () => {
    const regra = [{ pattern: "manychat", parentCategory: "OUTROS" as const, customCategoryId: "dani-invest" }];
    const lancamento = gasto({ customCategoryId: "x", description: "MANYCHAT.COM" });
    const sem = categoriaNoDestino({ lancamento, origemKind: "PESSOAL", destinoKind: "EMPRESA", regrasDoDestino: regra, personalizadasDoDestino: [] });
    expect(sem.customCategoryId).toBeNull();
    const com = categoriaNoDestino({ lancamento, origemKind: "PESSOAL", destinoKind: "EMPRESA", regrasDoDestino: regra, personalizadasDoDestino: [{ id: "dani-invest", name: "Dani Invest" }] });
    expect(com.customCategoryId).toBe("dani-invest");
  });

  it("estorno sem palpite vai para Outros (senão a compra não seria abatida)", () => {
    const r = categoriaNoDestino({ ...base, lancamento: gasto({ amount: -30, parentCategory: "LAZER", description: "ZZZ" }), origemKind: "PESSOAL", destinoKind: "EMPRESA" });
    expect(r.parentCategory).toBe("OUTROS");
  });

  it("renda e guardado não têm categoria, só a subcategoria", () => {
    const r = categoriaNoDestino({ ...base, lancamento: { ...gasto({}), category: "INCOME", parentCategory: "OUTROS", subcategory: "Freela" }, origemKind: "PESSOAL", destinoKind: "EMPRESA" });
    expect(r).toEqual({ parentCategory: null, customCategoryId: null, subcategory: "Freela" });
  });

  it("o sentido só muda entrando ou saindo da Empresa", () => {
    expect(categoriasMudamDeSentido("PESSOAL", "CASAL")).toBe(false);
    expect(categoriasMudamDeSentido("PESSOAL", "EMPRESA")).toBe(true);
    expect(categoriasMudamDeSentido("EMPRESA", "PESSOAL")).toBe(true);
    expect(categoriasMudamDeSentido("EMPRESA", "EMPRESA")).toBe(false);
  });
});

describe("o que fica para trás", () => {
  it("meta e campos do Casal sempre saem; os da Empresa só ficam indo para a Empresa", () => {
    expect(camposQueSaem("PESSOAL")).toMatchObject({ goalId: null, pessoa: null, doCasal: null, soMeu: false, cliente: null, recebeEm: null });
    const empresa = camposQueSaem("EMPRESA");
    expect(empresa).toMatchObject({ goalId: null, pessoa: null });
    expect("cliente" in empresa).toBe(false);
  });
});

describe("parcelas da mesma compra", () => {
  it("acha as outras parcelas pela descrição sem o N/T e pelo valor (com a folga dos centavos)", () => {
    const escolhido = { id: "a", description: "MAGALU PARC 03/06", amount: 100 };
    const candidatos = [
      escolhido,
      { id: "b", description: "MAGALU PARC 04/06", amount: 100 },
      { id: "c", description: "MAGALU PARC 4/6", amount: 100.04 },
      { id: "d", description: "MAGALU PARC 01/03", amount: 100 }, // outra compra (3x)
      { id: "e", description: "MAGALU PARC 05/06", amount: 250 }, // outra compra (outro valor)
      { id: "f", description: "AMAZON PARC 04/06", amount: 100 },
    ];
    expect(parcelasDaMesmaCompra([escolhido], candidatos).sort()).toEqual(["b", "c"]);
  });

  it("data na descrição não é parcela", () => {
    expect(chaveDaCompraParcelada("POSTO SHELL 03/09")).toBeNull();
    expect(parcelasDaMesmaCompra([{ id: "a", description: "POSTO SHELL 03/09", amount: 50 }], [{ id: "b", description: "POSTO SHELL 04/09", amount: 50 }])).toEqual([]);
  });

  it("não devolve o que já foi escolhido", () => {
    const a = { id: "a", description: "LOJA PARCELA 1/3", amount: 10 };
    const b = { id: "b", description: "LOJA PARCELA 2/3", amount: 10 };
    expect(parcelasDaMesmaCompra([a, b], [a, b])).toEqual([]);
  });
});

describe("sempre mandar para a Empresa", () => {
  it("lembra por comerciante, sem repetir e sem chave vazia", () => {
    expect(comerciantesParaLembrar(["KALUNGA SP 1234", "Kalunga SP", "PIX ENVIADO", null])).toEqual(["kalunga"]);
  });

  it("a regra pega o mesmo comerciante noutro extrato e a mais específica ganha", () => {
    const regras = [
      { pattern: "uber", destinoProfileId: "empresa" },
      { pattern: "uber eats", destinoProfileId: "casal" },
    ];
    expect(destinoPelaRegra("UBER *TRIP", regras)).toBe("empresa");
    expect(destinoPelaRegra("UBER EATS", regras)).toBe("casal");
    expect(destinoPelaRegra("IFOOD", regras)).toBeNull();
  });
});
