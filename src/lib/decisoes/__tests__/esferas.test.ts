import { describe, expect, it } from "vitest";
import { lerFiltro, perguntasDoFiltro, pilulaDaPergunta, PERGUNTAS_DO_DECIDIR, tituloDaEsfera, type DadosDasPilulas } from "../esferas";
import { estouGastandoDemais, melhoreiDoMesPassado, porqueAcabouMaisRapido } from "../respostas";

const money = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const agosto = { label: "agosto", renda: 7700, gastos: 7000, guardado: 700, porCategoria: {} };
const setembro = { label: "setembro", renda: 7700, gastos: 6600, guardado: 900, porCategoria: {} };

/** A Ana canônica (ana-canonica.md): os números que as pílulas têm que mostrar. */
const ana: DadosDasPilulas = {
  money,
  tema: "girly",
  livreMes: 3241,
  porDia: 3241 / 25,
  ateDomingo: 648,
  guardar: { porMes: 2312, cobre: false },
  metaAtrasada: { chegaCurto: "mai/2032" },
  metasNoRitmo: false,
  reserva: { meses: 0.6, minimo: 3 },
  passou: { label: "Saúde", valor: 67 },
  raioxAnual: 992,
  respostas: {
    demais: estouGastandoDemais({ money, gastoDoMes: 4059, planejado: 7300, decorrido: 6 / 31, renda: 7700, categorias: [] }),
    acabou: porqueAcabouMaisRapido({ money, atual: setembro, anterior: agosto, maiores: [] }),
    melhorei: melhoreiDoMesPassado({ money, atual: setembro, anterior: agosto }),
  },
};

describe("esferas do Decidir (rodada 57)", () => {
  it("são 10 perguntas, as 4 da tela principal na ordem aprovada, e cada uma abre a sua tela", () => {
    expect(PERGUNTAS_DO_DECIDIR).toHaveLength(10);
    expect(PERGUNTAS_DO_DECIDIR.slice(0, 4).map((p) => p.titulo)).toEqual(["Posso comprar algo?", "Como guardar mais?", "Quando chego na minha meta?", "Quanto posso gastar na semana?"]);
    expect(new Set(PERGUNTAS_DO_DECIDIR.map((p) => p.href)).size).toBe(10);
    for (const p of PERGUNTAS_DO_DECIDIR) expect(p.href).toMatch(/^\/decidir\//);
  });

  it("as 4 pílulas da tela principal batem com o motor da Ana", () => {
    const txt = (k: Parameters<typeof pilulaDaPergunta>[0]) => pilulaDaPergunta(k, ana)?.texto;
    expect(txt("compra")).toBe("R$ 3.241 livres");
    expect(txt("meta")).toBe("mai/2032");
    expect(pilulaDaPergunta("meta", ana)?.atencao).toBe(true);
    expect(txt("semana")).toBe("R$ 130 por dia");
    expect(pilulaDaPergunta("semana", { ...ana, tema: "titanio" })?.texto).toBe("R$ 648 até domingo");
    expect(txt("guardar")).toBe("R$ 2.312 por mês");
  });

  it("as outras seis: reserva, exagero, raio-x e as do mês, com o ponto âmbar quando pede atenção", () => {
    expect(pilulaDaPergunta("reserva", ana)).toEqual({ texto: "menos de 1 mês", atencao: true });
    expect(pilulaDaPergunta("exagero", ana)).toEqual({ texto: "Saúde R$ 67 acima", atencao: true });
    expect(pilulaDaPergunta("exagero", { ...ana, passou: null })).toEqual({ texto: "nada passou", atencao: false });
    expect(pilulaDaPergunta("raiox", ana)).toEqual({ texto: "R$ 992 por ano", atencao: false });
    expect(pilulaDaPergunta("acabou", ana)).toEqual({ texto: "R$ 400 a menos", atencao: false });
    expect(pilulaDaPergunta("melhorei", ana)?.texto).toBe("12% guardado");
    expect(pilulaDaPergunta("demais", ana)?.texto).toBeTruthy();
  });

  it("sem dado, sem pílula (nunca inventa número)", () => {
    const vazio: DadosDasPilulas = { ...ana, livreMes: null, porDia: null, ateDomingo: null, guardar: null, metaAtrasada: null, reserva: null, raioxAnual: null, respostas: {} };
    for (const k of ["compra", "guardar", "meta", "semana", "reserva", "raiox", "demais", "acabou", "melhorei"] as const) expect(pilulaDaPergunta(k, vazio), k).toBeNull();
  });

  it("filtros: Vou comprar, Quero guardar e Meu mês; e o título curto do Padrão", () => {
    expect(perguntasDoFiltro("tudo")).toHaveLength(10);
    expect(perguntasDoFiltro("compra").map((p) => p.chave)).toEqual(["compra", "semana", "raiox"]);
    expect(perguntasDoFiltro("guardar").map((p) => p.chave)).toEqual(["guardar", "meta", "reserva", "raiox"]);
    expect(perguntasDoFiltro("mes").map((p) => p.chave)).toEqual(["semana", "demais", "exagero", "acabou", "melhorei"]);
    expect(lerFiltro("guardar")).toBe("guardar");
    expect(lerFiltro("qualquer")).toBe("tudo");
    const raiox = PERGUNTAS_DO_DECIDIR.find((p) => p.chave === "raiox")!;
    expect(tituloDaEsfera(raiox, "padrao")).toBe("O que posso cortar?");
    expect(tituloDaEsfera(raiox, "girly")).toBe("Que pequenos gastos posso cortar?");
  });
});
