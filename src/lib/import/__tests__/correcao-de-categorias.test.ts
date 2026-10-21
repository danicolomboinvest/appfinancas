import { describe, expect, it } from "vitest";
import { planejarCorrecao, type LancamentoParaCorrigir } from "../correcao-de-categorias";

const l = (id: string, description: string, parentCategory: LancamentoParaCorrigir["parentCategory"], extra: Partial<LancamentoParaCorrigir> = {}): LancamentoParaCorrigir => ({
  id,
  userId: "u1",
  description,
  parentCategory,
  subcategory: null,
  customCategoryId: null,
  importBatchId: "lote",
  ...extra,
});

describe("correção dos lançamentos antigos de 99 Food e Cacau Show", () => {
  it("99 Food em Transporte vira Delivery; Cacau Show em Lazer vira Lanche/Café", () => {
    const { mudancas } = planejarCorrecao([l("a", "99 FOOD *RESTAURANTE", "TRANSPORTE"), l("b", "PAG*99FOOD", "TRANSPORTE"), l("c", "CACAU SHOW SHOPPING", "LAZER", { subcategory: "Cinema/Shows" })], []);
    expect(mudancas.map((m) => [m.id, m.para.parentCategory, m.para.subcategory])).toEqual([
      ["a", "ALIMENTACAO", "Delivery"],
      ["b", "ALIMENTACAO", "Delivery"],
      ["c", "ALIMENTACAO", "Lanche/Café"],
    ]);
    expect(mudancas[2].de).toEqual({ parentCategory: "LAZER", subcategory: "Cinema/Shows" });
  });

  it("não mexe na corrida da 99, no que já está certo nem em outra loja", () => {
    const { mudancas } = planejarCorrecao([l("a", "99 RIDE", "TRANSPORTE"), l("b", "99 FOOD", "ALIMENTACAO"), l("c", "CINEMARK", "LAZER")], []);
    expect(mudancas).toEqual([]);
  });

  it("respeita o que foi ela que decidiu: categoria própria, lançamento escrito à mão e regra que ela ensinou", () => {
    const { mudancas, pulados } = planejarCorrecao(
      [
        l("a", "CACAU SHOW", "LAZER", { customCategoryId: "presentes" }),
        l("b", "Cacau Show", "LAZER", { importBatchId: null }),
        l("c", "CACAU SHOW", "LAZER", { userId: "u2" }),
        l("d", "CACAU SHOW", "LAZER", { userId: "u3" }),
      ],
      [{ userId: "u2", pattern: "cacau show", parentCategory: "LAZER" }],
    );
    expect(mudancas.map((m) => m.id)).toEqual(["d"]);
    expect(pulados).toEqual({ escrito_a_mao: 1, categoria_dela: 1, ela_ensinou: 1 });
  });
});
