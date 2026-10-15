import { describe, expect, it } from "vitest";
import { contaVaria, diaValido, origemDoArquivo, origemDoLote, origemPadrao, origemValida, origensDoPaguei, rotuloDaOrigem, valoresDeAntes } from "../paguei";
import { categoriaDoPaguei } from "../paguei-categoria";

describe("de onde saiu", () => {
  it("as origens vêm dos extratos e faturas que ela trouxe, com o genérico do que faltar e o dinheiro", () => {
    const o = origensDoPaguei([
      { docType: "extrato", fileName: "nubank-outubro.csv" },
      { docType: "fatura", fileName: "itau_fatura.pdf" },
      { docType: "extrato", fileName: "Nubank_setembro.ofx" },
      { docType: "extrato", fileName: "extrato-outubro.pdf" },
    ]);
    expect(o.map((x) => x.rotulo)).toEqual(["Conta Nubank", "Cartão Itaú", "Dinheiro"]);
  });

  it("sem nenhum arquivo: Pix ou débito, Cartão e Dinheiro", () => {
    expect(origensDoPaguei([]).map((x) => x.chave)).toEqual(["conta", "cartao", "dinheiro"]);
  });

  it("a última usada abre marcada, mesmo que o lote dela tenha saído da lista", () => {
    const o = origensDoPaguei([{ docType: "extrato", fileName: "nubank.csv" }], "cartao:c6");
    expect(o[0]).toMatchObject({ chave: "cartao:c6", rotulo: "Cartão C6" });
    expect(origemPadrao(o, "cartao:c6")).toBe("cartao:c6");
    expect(origemPadrao(o, null)).toBe("cartao:c6");
    expect(origemPadrao(origensDoPaguei([]), "dinheiro")).toBe("dinheiro");
  });

  it("o arquivo que não diz o banco vira o genérico do tipo", () => {
    expect(origemDoLote("extrato", "extrato-outubro.pdf")).toBeNull();
    expect(origemDoArquivo("extrato", "extrato-outubro.pdf")).toBe("conta");
    expect(origemDoArquivo("fatura", "fatura.pdf")).toBe("cartao");
    expect(origemDoArquivo("extrato", "nubank-outubro.csv")).toBe("conta:nubank");
  });

  it("só aceita a chave de um lote ou um genérico", () => {
    expect(origemValida("conta:nubank")).toBe(true);
    expect(origemValida("dinheiro")).toBe(true);
    expect(origemValida("conta:<script>")).toBe(false);
    expect(origemValida(42)).toBe(false);
    expect(rotuloDaOrigem("conta")).toBe("Pix ou débito");
  });
});

describe("o dia", () => {
  it("hoje e para trás, até uns 2 meses; nunca no futuro", () => {
    expect(diaValido("2026-10-15", "2026-10-15")).toBe(true);
    expect(diaValido("2026-10-14", "2026-10-15")).toBe(true);
    expect(diaValido("2026-10-16", "2026-10-15")).toBe(false);
    expect(diaValido("2026-07-01", "2026-10-15")).toBe(false);
    expect(diaValido("2026-02-30", "2026-10-15")).toBe(false);
  });
});

describe("a conta que varia", () => {
  it("é a aproximada ou a sem valor", () => {
    expect(contaVaria({ valor: null })).toBe(true);
    expect(contaVaria({ valor: 130, aproximado: true })).toBe(true);
    expect(contaVaria({ valor: 1800 })).toBe(false);
  });

  it("os valores de antes: os Paguei primeiro, completados pelo extrato, no máximo 3", () => {
    const v = valoresDeAntes(
      [{ mes: "2026-09", valor: 182.4 }],
      [
        { mes: "2026-09", valor: 999 },
        { mes: "2026-08", valor: 175.9 },
        { mes: "2026-07", valor: 160 },
        { mes: "2026-06", valor: 150 },
      ],
    );
    expect(v).toEqual([
      { mes: "2026-09", valor: 182.4 },
      { mes: "2026-08", valor: 175.9 },
      { mes: "2026-07", valor: 160 },
    ]);
  });
});

describe("a categoria do gasto", () => {
  it("a correção dela no último gasto vale primeiro", () => {
    expect(categoriaDoPaguei({ nome: "Aluguel", categoria: null, ultima: { parentCategory: null, customCategoryId: "casa", subcategory: null } })).toEqual({ parentCategory: null, customCategoryId: "casa", subcategory: null });
  });

  it("depois a da conta, o nome e o dicionário; nunca sem categoria", () => {
    expect(categoriaDoPaguei({ nome: "Vivo", categoria: "MORADIA" })).toMatchObject({ parentCategory: "MORADIA" });
    expect(categoriaDoPaguei({ nome: "Luz", categoria: null })).toEqual({ parentCategory: "MORADIA", customCategoryId: null, subcategory: "Luz" });
    expect(categoriaDoPaguei({ nome: "Aluguel", categoria: null })).toMatchObject({ parentCategory: "MORADIA", subcategory: "Aluguel" });
    expect(categoriaDoPaguei({ nome: "Escola do Pedro", categoria: null })).toMatchObject({ parentCategory: "EDUCACAO" });
    expect(categoriaDoPaguei({ nome: "Guia do MEI", categoria: null, profileKind: "EMPRESA" })).toMatchObject({ parentCategory: "IMPOSTOS", subcategory: "DAS (Simples Nacional)" });
    expect(categoriaDoPaguei({ nome: "Mesada", categoria: null })).toMatchObject({ parentCategory: "OUTROS" });
  });
});
