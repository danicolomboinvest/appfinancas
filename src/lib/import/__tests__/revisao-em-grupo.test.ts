import { describe, expect, it } from "vitest";
import { chaveDeIguais, iguaisPraAplicar, proximaPendente, type LinhaDaRevisao } from "../revisao-em-grupo";

const linha = (key: number, description: string, extra: Partial<LinhaDaRevisao> = {}): LinhaDaRevisao => ({
  key,
  description,
  category: "EXPENSE",
  parentCategory: null,
  customCategoryId: null,
  autoClassified: false,
  profileId: null,
  ...extra,
});

describe("chaveDeIguais", () => {
  it("junta o mesmo lugar escrito com número e data diferentes", () => {
    expect(chaveDeIguais("IFOOD *IFD1234 12/05")).toBe(chaveDeIguais("IFOOD *IFD9876 13/05"));
  });

  it("não junta pela palavra do meio de pagamento", () => {
    expect(chaveDeIguais("Compra no débito")).toBeNull();
    expect(chaveDeIguais("PIX ENVIADO")).toBeNull();
  });
});

describe("iguaisPraAplicar", () => {
  it("5 Pix pra mesma pessoa: um toque resolve os outros 4", () => {
    const items = [1, 2, 3, 4, 5].map((k) => linha(k, "Pix enviado Maria Souza"));
    expect(iguaisPraAplicar(items, 1)).toEqual([2, 3, 4, 5]);
  });

  it("não mexe no que ela já escolheu à mão", () => {
    const items = [linha(1, "PADARIA SOL"), linha(2, "PADARIA SOL", { parentCategory: "LAZER", autoClassified: false })];
    expect(iguaisPraAplicar(items, 1)).toEqual([]);
  });

  it("troca também o que o app tinha posto sozinho", () => {
    const items = [
      linha(1, "IFOOD *IFD123", { parentCategory: "ALIMENTACAO", autoClassified: true }),
      linha(2, "IFOOD *IFD987", { parentCategory: "ALIMENTACAO", autoClassified: true }),
    ];
    expect(iguaisPraAplicar(items, 1)).toEqual([2]);
  });

  it("deixa de fora renda, linha que não entra, pergunta pendente e outro perfil", () => {
    const items = [
      linha(1, "Pix Maria Souza"),
      linha(2, "Pix Maria Souza", { category: "INCOME" }),
      linha(3, "Pix Maria Souza", { ignorar: true }),
      linha(4, "Pix Maria Souza", { duvida: "conta_propria" }),
      linha(5, "Pix Maria Souza", { profileId: "empresa" }),
      linha(6, "Pix Joana Lima"),
    ];
    expect(iguaisPraAplicar(items, 1)).toEqual([]);
  });

  it("linha genérica demais não arrasta nada", () => {
    const items = [linha(1, "Compra no débito"), linha(2, "Compra no débito")];
    expect(iguaisPraAplicar(items, 1)).toEqual([]);
  });
});

describe("proximaPendente", () => {
  it("pula os que ganharam categoria junto", () => {
    const pendentes = new Set([10, 40]);
    expect(proximaPendente([10, 20, 30, 40], 0, (k) => pendentes.has(k))).toBe(3);
  });

  it("fim da fila", () => {
    expect(proximaPendente([10, 20], 1, () => true)).toBeNull();
    expect(proximaPendente([10, 20], 0, () => false)).toBeNull();
  });
});
