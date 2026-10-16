import { describe, expect, it } from "vitest";
import { planoDaMeta, type EntradaDoPlano, type LancamentoDoPlano } from "../plano-da-meta";
import { antesDoPlanoNovo, aplicarEscolhas, avisosPorCoisinha, devolucoes, juntarTrazidos, mesmosValores, oQueTirarFaz, chaveDoAvisoDoTeto, planoDoRegistro, tetosAlcancados, textoDoAvisoDoTeto, type PlanoGravado } from "../plano-gravado";

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

  it("duas metas com o iFood: um aviso só, o do teto mais apertado", () => {
    const outro: PlanoGravado = { ...plano, itens: [{ ...plano.itens[0], teto: 160 }] };
    const lanc = [ifood(150)];
    const todos = [...tetosAlcancados(plano, lanc).map((a) => ({ ...a, meta: "Carro" })), ...tetosAlcancados(outro, lanc).map((a) => ({ ...a, meta: "Viagem" }))];
    expect(todos).toHaveLength(2);
    const um = avisosPorCoisinha(todos);
    expect(um).toHaveLength(1);
    expect(um[0]).toMatchObject({ meta: "Viagem", pct: 94 });
  });

  it("uma chave por coisinha e mês; o texto sem travessão", () => {
    expect(chaveDoAvisoDoTeto("delivery:ifood", 2026, 10)).toBe("plano:delivery:ifood:2026-10:75");
    const [a] = tetosAlcancados(plano, [ifood(150)]);
    const t = textoDoAvisoDoTeto(a, "Carro", (v) => `R$ ${v}`);
    expect(t).toEqual({ titulo: "Faltam R$ 50 no combinado de iFood", corpo: "Você já usou R$ 150 de R$ 200 este mês. É o plano da meta Carro." });
    expect(`${t.titulo}${t.corpo}`).not.toMatch(/[—–]|\bpra\b/);
  });
});

describe("tirar o plano volta a meta (16/10)", () => {
  const antes = { alvo: 5000, prazo: "2027-10", porMes: 440 };
  const depois = { alvo: 5000, prazo: "2028-04", porMes: 260 };
  const base: PlanoGravado = { versao: 1, itens: [], cobrancas: [], porMes: 260, alvo: 5000, prazo: "2028-04", saida: "prazo", achado: 200, em: "", antes, depois };

  it("o plano mudou a meta e ela não mexeu: volta aos valores de antes", () => {
    expect(oQueTirarFaz(base, { ...depois })).toEqual({ acao: "voltar", valores: antes });
  });

  it("ela mexeu na meta à mão depois: fica como está", () => {
    expect(oQueTirarFaz(base, { ...depois, porMes: 300 })).toEqual({ acao: "mexida" });
    expect(oQueTirarFaz(base, { ...depois, prazo: "2028-06" })).toEqual({ acao: "mexida" });
  });

  it("o plano não mudou a meta, ou é antigo (sem o antes): nada a voltar", () => {
    expect(oQueTirarFaz({ ...base, antes: depois }, depois)).toEqual({ acao: "nada" });
    const { antes: _a, depois: _d, ...velho } = base;
    void _a;
    void _d;
    expect(oQueTirarFaz(velho, depois)).toEqual({ acao: "nada" });
  });

  it("mudar o plano guarda o antes de tudo, se a meta ainda está como o plano deixou", () => {
    expect(antesDoPlanoNovo(base, depois)).toEqual(antes);
    expect(antesDoPlanoNovo(base, { ...depois, porMes: 300 })).toEqual({ ...depois, porMes: 300 });
    expect(antesDoPlanoNovo(null, depois)).toEqual(depois);
  });

  it("compara no centavo e no mês, e o registro guarda o antes e o depois", () => {
    expect(mesmosValores({ alvo: 5000, prazo: null, porMes: 440.001 }, { alvo: 5000, prazo: null, porMes: 440 })).toBe(true);
    expect(planoDoRegistro(JSON.parse(JSON.stringify(base)))).toEqual(base);
  });
});

describe("o que ela já guarda e trazer das outras metas (16/10)", () => {
  const viagem = { id: "viagem", nome: "Viagem", foto: "/fotos/metas/praia.jpg", porMes: 300, alvo: 6000, guardado: 1000, prazo: new Date(2027, 9, 1, 12), taxaAnual: 0.1, reserva: false };
  const reserva = { id: "reserva", nome: "Reserva", foto: null, porMes: 250, alvo: 24000, guardado: 1000, prazo: null, taxaAnual: 0.1, reserva: true };
  // Renda 4.380, gasto 3.830: sobra R$ 550; as metas levam R$ 550 e não sobra nada sem meta.
  const e = entrada({ rendaMedia: 4380, gastoTipico: { media: 3830, meses: 3 }, aportesCombinados: 550, outras: [viagem, reserva] });
  const p = planoDaMeta(e);
  if (!p.mostra) throw new Error("não mostra");

  it("mostra para onde vai: R$ 250 na Reserva, R$ 300 na Viagem", () => {
    expect(p.jaGuarda.total).toBe(550);
    expect(p.jaGuarda.semMeta).toBe(0);
    expect(p.jaGuarda.fontes.map((f) => [f.nome, f.porMes, f.podeTrazer, f.travada])).toEqual([
      ["Reserva", 250, 0, "reserva_curta"],
      ["Viagem", 300, 300, null],
    ]);
  });

  it("reserva de 3 a 6 meses cede 30%; dinheiro sem meta aparece como sem meta", () => {
    const media = planoDaMeta(entrada({ rendaMedia: 4380, gastoTipico: { media: 3830, meses: 3 }, aportesCombinados: 250, outras: [{ ...reserva, guardado: 3830 * 4 }] }));
    expect(media.mostra && media.jaGuarda.fontes[0]).toMatchObject({ podeTrazer: 70, travada: "reserva_media" });
    expect(media.mostra && media.jaGuarda.semMeta).toBe(300);
  });

  it("nunca traz mais do que existe: combinado maior que a sobra do mês", () => {
    const apertado = planoDaMeta(entrada({ rendaMedia: 4380, gastoTipico: { media: 4200, meses: 3 }, aportesCombinados: 300, outras: [viagem] }));
    expect(apertado.mostra && apertado.jaGuarda.trazivel).toBe(180);
  });

  it("trazer da Viagem entra na conta e grava o por mês dela antes e depois", () => {
    const r = aplicarEscolhas(p, e.meta, { itens: [{ id: "delivery:ifood", valor: 200 }], saida: "nenhuma", trazer: [{ id: "viagem", valor: 300 }] }, HOJE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trazidos).toEqual([{ id: "viagem", nome: "Viagem", reserva: false, valor: 300, antes: 300, depois: 0 }]);
    expect(r.plano.trazidos).toEqual(r.trazidos);
  });

  it("a Reserva curta não cede, nem fora da régua", () => {
    expect(aplicarEscolhas(p, e.meta, { itens: [], saida: "nenhuma", trazer: [{ id: "reserva", valor: 100 }] }, HOJE)).toEqual({ ok: false, erro: "A Reserva fica: ela ainda está com menos de 3 meses." });
    expect(aplicarEscolhas(p, e.meta, { itens: [], saida: "nenhuma", trazer: [{ id: "viagem", valor: 305 }] }, HOJE).ok).toBe(false);
    expect(aplicarEscolhas(p, e.meta, { itens: [], saida: "nenhuma", trazer: [{ id: "outra", valor: 10 }] }, HOJE).ok).toBe(false);
  });

  it("tirar devolve só o que ela não mexeu; mudar o plano soma com o que veio antes", () => {
    const plano: PlanoGravado = { versao: 1, itens: [], cobrancas: [], porMes: 440, alvo: 5000, prazo: "2027-10", saida: "nenhuma", achado: 0, em: "", trazidos: [{ id: "viagem", nome: "Viagem", reserva: false, valor: 100, antes: 300, depois: 200 }] };
    expect(devolucoes(plano, new Map([["viagem", 200]]))).toEqual([{ id: "viagem", reserva: false, porMes: 300 }]);
    expect(devolucoes(plano, new Map([["viagem", 250]]))).toEqual([]);
    const juntos = juntarTrazidos(plano.trazidos!, [{ id: "viagem", nome: "Viagem", reserva: false, valor: 50, antes: 200, depois: 150 }], new Map([["viagem", 200]]));
    expect(juntos).toEqual([{ id: "viagem", nome: "Viagem", reserva: false, valor: 150, antes: 300, depois: 150 }]);
  });
});
