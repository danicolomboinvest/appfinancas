import { describe, expect, it } from "vitest";
import { compraNaFrase } from "../compra-guiada";
import { ondeEstouExagerando, seloDoExagero } from "../respostas";

const money = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

describe("Posso comprar: a compra na frase, com o artigo certo", () => {
  it.each([
    ["celular", "Preço do celular", "Esse celular é"],
    ["viagem", "Preço da viagem", "Essa viagem é"],
    ["vestuario", "Preço da roupa", "Essa roupa é"],
    ["eletronico", "Preço do eletrônico", "Esse eletrônico é"],
    ["beleza", "Preço", "Isso é"],
    ["casa", "Preço", "Isso é"],
    ["educacao", "Preço", "Isso é"],
    ["outro", "Preço", "Isso é"],
  ])("%s", (id, preco, sinceridade) => {
    expect(compraNaFrase(id)).toEqual({ preco, sinceridade });
  });
  it("nunca 'do viagem' nem 'Esse beleza'", () => {
    for (const id of ["viagem", "beleza", "casa", "educacao"]) {
      const f = compraNaFrase(id);
      expect(`${f.preco} ${f.sinceridade}`).not.toMatch(/do viagem|Esse beleza|do casa|do educação/);
    }
  });
});

describe("Onde estou exagerando: o selo diz quanto passou do PLANO", () => {
  it("passou do plano: o quanto passou dele (vira 'passou R$ 67' na tela)", () => {
    expect(seloDoExagero(money, { gasto: 417, planejado: 350, excesso: 270 })).toEqual({ texto: "+R$ 67", tom: "ruim" });
  });
  it("só acima do ritmo: sem 'passou'", () => {
    const s = seloDoExagero(money, { gasto: 200, planejado: 350, excesso: 50 });
    expect(s.texto).toBe("R$ 50 acima");
    expect(s.texto.startsWith("+")).toBe(false);
  });
  it("na resposta inteira, o caso da Saúde (R$ 417 de R$ 350 no dia 14)", () => {
    const r = ondeEstouExagerando({
      money,
      decorrido: 13 / 31,
      categorias: [{ key: "SAUDE", label: "Saúde", planejado: 350, gasto: 417 } as never],
      fora: 0,
      maiores: [],
      recorrentesAno: null,
    });
    const lista = r.visual?.blocos.find((b) => b.tipo === "lista");
    const item = lista && "itens" in lista ? (lista.itens as { selo?: { texto: string } }[])[0] : undefined;
    expect(item?.selo?.texto).toBe("+R$ 67");
  });
});
