import { describe, expect, it } from "vitest";
import { taxaDoFormulario, taxaParaOCampo, textoDaTaxaCompra } from "../taxa-compra";

describe("taxa de compra da renda fixa (Asset.taxaCompra)", () => {
  it("guarda em fração: 7,5 vira 0.075 e 105 vira 1.05", () => {
    expect(taxaDoFormulario("7,5")).toBe(0.075);
    expect(taxaDoFormulario("105")).toBe(1.05);
    expect(taxaDoFormulario("12%")).toBe(0.12);
  });
  it("vazio apaga (null); ausente ou inválido não mexe (undefined)", () => {
    expect(taxaDoFormulario("")).toBeNull();
    expect(taxaDoFormulario(undefined)).toBeUndefined();
    expect(taxaDoFormulario("abc")).toBeUndefined();
    expect(taxaDoFormulario("-3")).toBeUndefined();
    expect(taxaDoFormulario("5000")).toBeUndefined();
  });
  it("lê com o indexador: IPCA + 7,5% ao ano, 105% do CDI, 12% ao ano", () => {
    expect(textoDaTaxaCompra(0.075, "IPCA")).toBe("IPCA + 7,5% ao ano");
    expect(textoDaTaxaCompra(1.05, "POS_FIXADO")).toBe("105% do CDI");
    expect(textoDaTaxaCompra(0.12, "PREFIXADO")).toBe("12% ao ano");
    expect(taxaParaOCampo(0.075)).toBe("7,5");
    expect(taxaParaOCampo(null)).toBe("");
  });
});
