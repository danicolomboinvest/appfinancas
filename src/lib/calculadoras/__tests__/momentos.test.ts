import { describe, expect, it } from "vitest";
import { MOMENTOS, fileirasDoMomento } from "../momentos";
import { valorCurto } from "../vereditos";

const ids = (id: Parameters<typeof fileirasDoMomento>[0]) =>
  fileirasDoMomento(id).map((f) => (f.largo ? [f.cartao.id] : f.cartoes.map((c) => c.id)));

describe("Qual é o seu momento?", () => {
  it("Tudo: financiar largo, depois duas duplas, consórcio e aposentadoria largos", () => {
    expect(ids("tudo")).toEqual([["financiar"], ["carro", "vale"], ["amortizar", "marcacao"], ["consorcio"], ["aposentadoria"]]);
  });

  it("nenhum filtro deixa meio cartão sozinho numa linha", () => {
    for (const m of MOMENTOS) {
      for (const f of fileirasDoMomento(m.id)) {
        if (!f.largo) expect(f.cartoes).toHaveLength(2);
      }
    }
  });

  it("quem sobra sozinho vira largo", () => {
    // "Vou comprar algo": vale + carro em dupla, financiar largo, consórcio sobra e vira largo.
    expect(ids("compra")).toEqual([["vale", "carro"], ["financiar"], ["consorcio"]]);
    expect(ids("divida")).toEqual([["amortizar", "mapear"]]);
  });

  it("Mapear minhas dívidas leva para a área Dívidas, e só no filtro Tenho dívida", () => {
    const mapear = fileirasDoMomento("divida").flatMap((f) => (f.largo ? [f.cartao] : f.cartoes)).find((c) => c.id === "mapear");
    expect(mapear?.href).toBe("/dividas");
    expect(ids("tudo").flat()).not.toContain("mapear");
  });

  it("todo filtro mostra ao menos uma calculadora", () => {
    for (const m of MOMENTOS) expect(fileirasDoMomento(m.id).length).toBeGreaterThan(0);
  });
});

describe("valor curto das colunas", () => {
  const inteiro = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
  it("milhões, milhares e o resto", () => {
    expect(valorCurto(2160971, "R$", inteiro)).toBe("R$ 2,16 mi");
    expect(valorCurto(78000, "R$", inteiro)).toBe("R$ 78 mil");
    expect(valorCurto(4290, "R$", inteiro)).toBe("R$ 4.290");
    expect(valorCurto(-21194, "R$", inteiro)).toBe("−R$ 21 mil");
  });
});
