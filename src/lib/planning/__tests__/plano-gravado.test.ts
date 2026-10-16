import { describe, expect, it } from "vitest";
import { planoDaMeta, type EntradaDoPlano, type LancamentoDoPlano } from "../plano-da-meta";
import { aplicarEscolhas, chaveDoAvisoDoTeto, planoDoRegistro, tetosAlcancados, textoDoAvisoDoTeto, type PlanoGravado } from "../plano-gravado";

const HOJE = new Date(2026, 9, 16, 12);
const OUT_2027 = new Date(2027, 9, 1, 12);
const mes = (valor: number, descricao: string, categoria: string, subcategoria: string | null, m: number): LancamentoDoPlano => ({ ano: 2026, mes: m, valor, categoria, subcategoria, descricao });
const tres = (valor: number, descricao: string, categoria: string, subcategoria: string | null, vezes = 1) => [7, 8, 9].flatMap((m) => Array.from({ length: vezes }, () => mes(valor, descricao, categoria, subcategoria, m)));

/** iFood R$ 400 (8 pedidos de R$ 50), Uber R$ 240 (16 de R$ 15), Lazer R$ 150 (3 de R$ 50), e o Max para cancelar. */
function entrada(extra: Partial<EntradaDoPlano> = {}): EntradaDoPlano {
  return {
    hoje: HOJE,
    perfil: { tipo: "PESSOAL", moeda: "BRL" },
    meta: { alvo: 5000, guardado: 0, prazo: OUT_2027 },
    rendaMedia: 4000,
    rendaMeses: 12,
    gastoTipico: { media: 4000, meses: 3 },
    aportesCombinados: 0,
    lancamentos: [...tres(1500, "Aluguel", "MORADIA", "Aluguel"), ...tres(50, "IFOOD *PIZZA", "ALIMENTACAO", "Delivery", 8), ...tres(15, "UBER *TRIP", "TRANSPORTE", "Aplicativo", 16), ...tres(50, "BAR", "LAZER", "Bar/Balada", 3)],
    assinaturas: [{ nome: "Max", mensal: 29.9, estado: "para_cancelar", marcas: ["r:max"], mesesCobrados: 3, marca: "hbomax" }],
    ...extra,
  };
}

describe("usar o plano: o servidor confere as escolhas", () => {
  const e = entrada();
  const p = planoDaMeta(e);

  it("o plano de partida", () => {
    expect(p.mostra && p.coisinhas.map((c) => [c.id, c.hoje, c.para])).toEqual([
      ["assinatura:max", 29.9, 0],
      ["lazer", 150, 80],
      ["delivery:ifood", 400, 200],
      ["corrida", 240, 120],
    ]);
    expect(p.mostra && p.pede).toBe(440);
  });

  it("fecha: grava os tetos escolhidos na régua e a meta continua com o por mês dela", () => {
    const r = aplicarEscolhas(p, e.meta, { itens: [{ id: "delivery:ifood", valor: 100 }, { id: "corrida", valor: 60 }, { id: "assinatura:max", valor: 999 }], saida: "nenhuma" }, HOJE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plano.itens.map((i) => [i.id, i.teto, i.economia, i.raiox])).toEqual([
      ["delivery:ifood", 100, 300, null],
      ["corrida", 60, 180, null],
      ["assinatura:max", 0, 29.9, "max"],
    ]);
    expect(r.plano.achado).toBe(509.9);
    expect(r.meta).toEqual({ alvo: 5000, prazo: OUT_2027, porMes: 440 });
    expect(r.plano.saida).toBe("nenhuma");
  });

  it("não fecha: sem caminho escolhido, não grava; com mais prazo ou meta menor, grava a meta nova", () => {
    const itens = [{ id: "delivery:ifood", valor: 200 }];
    expect(aplicarEscolhas(p, e.meta, { itens, saida: "nenhuma" }, HOJE)).toEqual({ ok: false, erro: "Não fechou: escolha mais prazo ou meta menor." });
    const prazo = aplicarEscolhas(p, e.meta, { itens, saida: "prazo" }, HOJE);
    expect(prazo.ok && prazo.meta.prazo! > OUT_2027 && prazo.meta.porMes <= 200).toBe(true);
    const menor = aplicarEscolhas(p, e.meta, { itens, saida: "menor" }, HOJE);
    expect(menor.ok && menor.meta.alvo < 5000 && menor.meta.porMes <= 200 && menor.meta.prazo === OUT_2027).toBe(true);
    // Guardar o que dá só existe quando não há prazo possível.
    expect(aplicarEscolhas(p, e.meta, { itens, saida: "daa" }, HOJE).ok).toBe(false);
  });

  it("recusa valor fora da régua, coisinha que não existe e coisinha repetida", () => {
    expect(aplicarEscolhas(p, e.meta, { itens: [{ id: "delivery:ifood", valor: 105 }], saida: "nenhuma" }, HOJE).ok).toBe(false);
    expect(aplicarEscolhas(p, e.meta, { itens: [{ id: "delivery:rappi", valor: 0 }], saida: "nenhuma" }, HOJE).ok).toBe(false);
    expect(aplicarEscolhas(p, e.meta, { itens: [{ id: "corrida", valor: 0 }, { id: "corrida", valor: 0 }], saida: "nenhuma" }, HOJE).ok).toBe(false);
  });

  it("a régua no limite: R$ 0 corta tudo; o valor de hoje não entra no plano", () => {
    const r = aplicarEscolhas(p, e.meta, { itens: [{ id: "delivery:ifood", valor: 0 }, { id: "lazer", valor: 80 }, { id: "corrida", valor: 240 }], saida: "nenhuma" }, HOJE);
    expect(r.ok && r.plano.itens.map((i) => [i.id, i.teto, i.economia])).toEqual([
      ["delivery:ifood", 0, 400],
      ["lazer", 80, 70],
    ]);
    expect(aplicarEscolhas(p, e.meta, { itens: [{ id: "corrida", valor: 240 }], saida: "prazo" }, HOJE).ok).toBe(false);
  });

  it("já cabe, sem prazo e poucos dados não gravam plano", () => {
    const cabe = entrada({ gastoTipico: { media: 1000, meses: 3 } });
    expect(aplicarEscolhas(planoDaMeta(cabe), cabe.meta, { itens: [], saida: "nenhuma" }, HOJE).ok).toBe(false);
    const semPrazo = entrada({ meta: { alvo: 5000, guardado: 0, prazo: null } });
    expect(aplicarEscolhas(planoDaMeta(semPrazo), semPrazo.meta, { itens: [{ id: "corrida", valor: 0 }], saida: "nenhuma" }, HOJE).ok).toBe(false);
  });

  it("o registro volta igual, e lixo vira null", () => {
    const r = aplicarEscolhas(p, e.meta, { itens: [{ id: "delivery:ifood", valor: 0 }, { id: "corrida", valor: 120 }], saida: "nenhuma" }, HOJE);
    if (!r.ok) throw new Error(r.erro);
    expect(planoDoRegistro(JSON.parse(JSON.stringify(r.plano)))).toEqual(r.plano);
    expect(planoDoRegistro({ versao: 2 })).toBeNull();
    expect(planoDoRegistro(null)).toBeNull();
  });
});

describe("o aviso no caminho (75% do teto)", () => {
  const plano: PlanoGravado = {
    versao: 1,
    itens: [
      { id: "delivery:ifood", tipo: "delivery", nome: "iFood", marca: "ifood", hoje: 400, teto: 200, economia: 200, acao: "reduzir", raiox: null },
      { id: "assinatura:max", tipo: "assinatura", nome: "Max", marca: "hbomax", hoje: 29.9, teto: 0, economia: 29.9, acao: "cancelar", raiox: "max" },
    ],
    cobrancas: [],
    porMes: 440,
    alvo: 5000,
    prazo: "2027-10",
    saida: "nenhuma",
    achado: 229.9,
    em: "",
  };
  const ifood = (valor: number, descricao = "IFOOD *PIZZA"): LancamentoDoPlano => ({ ano: 2026, mes: 10, valor, categoria: "ALIMENTACAO", subcategoria: "Delivery", descricao });

  it("avisa a partir de 75% do teto, só da coisinha com teto", () => {
    expect(tetosAlcancados(plano, [ifood(100), ifood(49)])).toEqual([]);
    const [a] = tetosAlcancados(plano, [ifood(100), ifood(50)]);
    expect(a).toMatchObject({ gasto: 150, pct: 75 });
    expect(a.item.id).toBe("delivery:ifood");
  });

  it("estorno abate, e o que não é iFood não conta", () => {
    expect(tetosAlcancados(plano, [ifood(160), ifood(30, "Estorno IFOOD"), { ...ifood(500), descricao: "Supermercado", subcategoria: "Supermercado" }])).toEqual([]);
  });

  it("uma chave por coisinha, meta e mês; o texto sem travessão", () => {
    expect(chaveDoAvisoDoTeto("meta1", "delivery:ifood", 2026, 10)).toBe("plano:meta1:delivery:ifood:2026-10:75");
    const [a] = tetosAlcancados(plano, [ifood(150)]);
    const t = textoDoAvisoDoTeto(a, "Carro", (v) => `R$ ${v}`);
    expect(t).toEqual({ titulo: "Faltam R$ 50 no combinado de iFood", corpo: "Você já usou R$ 150 de R$ 200 este mês. É o plano da meta Carro." });
    expect(`${t.titulo}${t.corpo}`).not.toMatch(/[—–]|\bpra\b/);
  });
});
