import { describe, expect, it } from "vitest";
import { marcaDaDescricao } from "@/lib/marcas/marca";
import { EXEMPLOS, marcasQueMaisLevam } from "../marcas-do-reset";

const l = (description: string, amount: number, month: number, parentCategory = "LAZER") => ({ description, amount, year: 2026, month, parentCategory });

describe("as marcas no Money Reset", () => {
  it("todo logo de exemplo acha a marca no catálogo", () => {
    for (const lista of Object.values(EXEMPLOS)) for (const nome of lista) expect(marcaDaDescricao(nome), nome).not.toBeNull();
  });

  it("soma por marca, divide pelos meses com lançamento e ordena pelo que mais leva", () => {
    const r = marcasQueMaisLevam(
      [
        l("NETFLIX.COM", 55.9, 7),
        l("NETFLIX.COM", 55.9, 8),
        l("IFOOD *RESTAURANTE A", 40, 7, "ALIMENTACAO"),
        l("IFOOD *BURGER", 60, 7, "ALIMENTACAO"),
        l("IFOOD *RESTAURANTE B", 50, 8, "ALIMENTACAO"),
      ],
      2,
    );
    expect(r.map((x) => x.slug)).toEqual(["ifood", "netflix"]);
    expect(r[0].mensal).toBe(75);
    expect(r[0].vezes).toBe(1.5);
    expect(r[0].parentCategory).toBe("ALIMENTACAO");
    expect(r[1].mensal).toBeCloseTo(55.9);
  });

  it("banco, Pix e pagamento de fatura não são para onde o dinheiro foi", () => {
    const r = marcasQueMaisLevam([l("Pagamento de fatura Nubank", 900, 7), l("PIX ENVIADO", 300, 7), l("Transferência Itaú", 200, 7), l("Spotify", 21.9, 7)], 1);
    expect(r.map((x) => x.slug)).toEqual(["spotify"]);
  });

  it("sem mês com dado, nada (nunca um número inventado)", () => {
    expect(marcasQueMaisLevam([l("Netflix", 55.9, 7)], 0)).toEqual([]);
  });
});
