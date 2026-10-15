import { describe, expect, it } from "vitest";
import { cabeNaPilha, cartaoDaPilha, listaDoDecidir, quantosNoDecidir, type DadosDaPilha } from "../pilha";
import type { FocoItem } from "../foco";

/**
 * Revisão com a conta real (15/10/2026): o Resumo dizia "Mais 1 no Decidir" e o Decidir, "Tudo
 * resolvido". O número do Resumo e a pilha do Decidir saem agora da MESMA lista.
 */

const money = (v: number) => `R$ ${Math.round(v)}`;
const item = (id: string, detalhe: FocoItem["detalhe"], nivel: 1 | 2 | 3 = 2): FocoItem => ({ id, nivel, titulo: "", texto: "", href: "", acao: "", detalhe });

const estouro = item("estouro-LAZER", { tipo: "estouro", categoria: "LAZER", label: "Lazer", gasto: 700, planejado: 600, sobra: 0, dias: 16, decorrido: 0.5 }, 1);
const metaQueExiste = item("meta-europa", { tipo: "meta", metaId: "europa", nome: "Europa", porMes: 900, quando: "novembro de 2027", vencida: false, ultimoMes: false });
const metaQueSumiu = item("meta-apagada", { tipo: "meta", metaId: "apagada", nome: "Carro", porMes: 500, quando: "maio de 2027", vencida: false, ultimoMes: false });
const semDetalhe = item("antigo", undefined);
const reserva = item("reserva", { tipo: "reserva", meses: 0.6, minimo: 6 }, 3);
const aporte = item("aporte", { tipo: "aporte", falta: 300, guardado: 200, planejado: 500 });
const raiox = item("raiox", { tipo: "raiox", n: 3, anual: 1200 }, 3);

const dados: DadosDaPilha = {
  money,
  remanejo: { categorias: [{ key: "LAZER", label: "Lazer", planejado: 600, gasto: 700 }, { key: "OUTROS", label: "Outros", planejado: 500, gasto: 0 }], essenciais: [], livre: 800, diasRestantes: 16 },
  metas: [{ id: "europa", nome: "Europa", atual: 1000, alvo: 20000, prazoCurto: "nov/2027", porMes: 900, ritmo: 200, chega: null, vencida: false }],
  reserva: { atual: 1000, alvo: 18000, fimDoMes: 200 },
  hrefMes: "/mensal/2026/10",
};
const ids = dados.metas.map((m) => m.id);

describe("a lista única do Decidir", () => {
  it("o aviso que o Decidir não desenha não conta no Resumo (o caso da conta real)", () => {
    const foco = { atencao: [metaQueSumiu], depois: [raiox] };
    expect(quantosNoDecidir(foco, ids)).toBe(0);
    const lista = listaDoDecidir(foco, ids);
    expect(lista.pilha).toEqual([]);
    expect(lista.depois.map((i) => i.id)).toEqual(["raiox"]);
  });

  it("o número do Resumo é exatamente o tamanho da pilha que o Decidir desenha", () => {
    const foco = { atencao: [estouro, metaQueSumiu, metaQueExiste], depois: [semDetalhe, reserva, aporte, raiox] };
    const lista = listaDoDecidir(foco, ids);
    const cartoes = lista.pilha.map((i) => cartaoDaPilha(i, dados));
    expect(cartoes.every((c) => c !== null)).toBe(true);
    expect(quantosNoDecidir(foco, ids)).toBe(cartoes.length);
    // O que não desenha sai, e o próximo que desenha sobe para o lugar dele (no máximo 3).
    expect(lista.pilha.map((i) => i.id)).toEqual(["estouro-LAZER", "meta-europa", "reserva"]);
    expect(lista.depois.map((i) => i.id)).toEqual(["aporte", "raiox"]);
  });

  it("o Raio-X sempre espera: sozinho, o Resumo não chama para o Decidir", () => {
    expect(quantosNoDecidir({ atencao: [], depois: [raiox] }, ids)).toBe(0);
  });

  it("cabeNaPilha diz sim exatamente quando cartaoDaPilha desenha", () => {
    const set = new Set(ids);
    for (const i of [estouro, metaQueExiste, metaQueSumiu, semDetalhe, reserva, aporte, raiox]) {
      expect(cabeNaPilha(i, set), i.id).toBe(cartaoDaPilha(i, dados) !== null);
    }
  });
});
