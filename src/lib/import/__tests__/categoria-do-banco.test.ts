import { describe, expect, it } from "vitest";
import { categoriaDoBancoParaOApp } from "../categoria-do-banco";

describe("categoria que o banco escreve na fatura", () => {
  it("vira a categoria do app", () => {
    expect(categoriaDoBancoParaOApp("alimentação")).toBe("ALIMENTACAO");
    expect(categoriaDoBancoParaOApp("supermercado")).toBe("ALIMENTACAO");
    expect(categoriaDoBancoParaOApp("saúde")).toBe("SAUDE");
    expect(categoriaDoBancoParaOApp("veículos")).toBe("TRANSPORTE");
    expect(categoriaDoBancoParaOApp("educação")).toBe("EDUCACAO");
    expect(categoriaDoBancoParaOApp("residência")).toBe("MORADIA");
  });

  it("texto cortado pelo PDF ainda é reconhecido", () => {
    expect(categoriaDoBancoParaOApp("turismo e entretenim")).toBe("LAZER");
  });

  it("categoria genérica do banco não decide nada: o app segue com o palpite dele", () => {
    for (const c of ["outros", "diversos", "serviços", "vestuário", "eletrônicos", "", null, undefined]) {
      expect(categoriaDoBancoParaOApp(c)).toBeNull();
    }
  });
});
