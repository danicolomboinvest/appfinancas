import { describe, expect, it } from "vitest";
import { juntarRespostas, planosQueSubiram, type DecisaoDoBanco, type GastoComHora, type PlanoMexido } from "../juntar";
import { alertaResolvido, categoriaResolvida, escolherSugestaoDoMes, sugestaoResolvida, type RespostasDoMes } from "../perguntas";
import { AVISOS, type ComoResolveu } from "../regra";
import type { Sugestao } from "../sugestoes";
import { montarFoco, type FocoEntrada, type FocoMeta } from "@/lib/decisoes/foco";
import { cartaoDaPilha, type DadosDaPilha } from "@/lib/decisoes/pilha";
import { vozDoTema } from "@/lib/profiles/voice";

/**
 * "Resolve numa tela, some em todas" (14/10/2026). A Dani cobriu Cuidado pessoal no Orçamento e o
 * Resumo continuou dizendo que a categoria subiu. Aqui cada resposta é gravada do jeito que a tela
 * dela grava (a mesma linha da tabela Decisao), passa pelo mesmo caminho do carregador
 * (juntarRespostas) e cada tela faz a pergunta que faz de verdade:
 * - Resumo novo: categoriaResolvida(..., "categoria-subiu") e a fila da sugestão;
 * - Orçamento: categoriaResolvida(..., "estouro") (o AlertaDoOrcamento);
 * - Decidir: a pilha (cartaoDaPilha sobre o motor do Foco com as respostas);
 * - topo (Decisões importantes / AvisoFoco): o `atencao` do motor;
 * - push e e-mail: alertaResolvido sobre a chave do cron.
 */

const EU = { userId: "ana", profileId: "pessoal-ana" };
const OUTRO = { userId: "lucas", profileId: "pessoal-lucas" };
const COMECO = new Date(Date.UTC(2026, 9, 1, 3));
const HOJE = new Date("2026-10-14T15:00:00Z");
const MARCA = "2026-10-12T10:00:00.000Z";
const CUIDADO = "ck_cuidado_pessoal";

type Mundo = { gasto: Record<string, number>; plano: Record<string, number>; marca?: string; subiram?: PlanoMexido[]; gastos?: GastoComHora[] };

/** Outubro da Ana: Cuidado pessoal (criada por ela) e Lazer passaram; Alimentação tem folga. */
const OUTUBRO: Mundo = {
  gasto: { [CUIDADO]: 420, LAZER: 520, ALIMENTACAO: 700, SAUDE: 200 },
  plano: { [CUIDADO]: 300, LAZER: 400, ALIMENTACAO: 1500, SAUDE: 350 },
};

const linha = (l: Partial<DecisaoDoBanco> & { tipo: string; chave: string }, dono = EU): DecisaoDoBanco => ({ valor: null, descricao: null, dados: null, createdAt: HOJE, ...dono, ...l });

/** O que cada tela grava, linha por linha (ver as actions citadas). */
const grava = {
  /** foco/actions.ts dispensarAvisoAction: OQueFazer (pontual, cobrir), Pilha (livre, deixar, cobrir), ResolverAgora, Ritual. */
  aviso: (id: string, como: ComoResolveu, gasto: number, excesso: number, dono = EU) =>
    linha({ tipo: "aviso_dispensado", chave: `2026-10|${id}`, valor: excesso > 0 ? excesso : null, dados: { como, gasto, excesso } }, dono),
  /** orcamento/actions.ts registrarPlanoSubiu: o lápis que subiu o plano. */
  lapis: (k: string, gasto: number, dono = EU) => linha({ tipo: "aviso_dispensado", chave: `2026-10|plano-${k}`, dados: { como: "lapis", gasto, excesso: 0 } }, dono),
  /** foco/actions.ts definirTetoAction: "Segurar em" e "não gastar mais nada". */
  teto: (k: string, valor: number, gastoNaHora: number, dono = EU) => linha({ tipo: "teto", chave: `2026-10|${k}`, valor, dados: { gastoNaHora } }, dono),
  /** foco/novo/actions.ts dispensarSugestaoAction: "Agora não" e o toque no botão do Resumo. */
  sugestao: (tipo: string, id: string, como: "agora-nao" | "botao" | "boa", extra: { gasto?: number; excesso?: number; marca?: string } = {}, dono = EU) =>
    linha(
      { tipo: "sugestao_dispensada", chave: `${tipo}|${id}`, descricao: extra.marca ?? MARCA, dados: { boa: como === "boa", semana: "2026-W42", como, ...(extra.gasto !== undefined ? { gasto: extra.gasto, excesso: extra.excesso ?? 0 } : {}) } },
      dono,
    ),
  /** Dispensa gravada antes desta regra (sem dados). */
  antiga: (id: string, valor: number | null) => linha({ tipo: "aviso_dispensado", chave: `2026-10|${id}`, valor }),
};

function doMes(linhas: DecisaoDoBanco[], m: Mundo = OUTUBRO): RespostasDoMes {
  const { respostas, dispensas } = juntarRespostas({ eu: EU, linhas, comeco: COMECO, subiram: m.subiram, gastosDosQueSubiram: m.gastos });
  return { mes: { ano: 2026, mes: 10 }, respostas, dispensas, marca: m.marca ?? MARCA, gasto: m.gasto, plano: m.plano };
}

const ROTULO: Record<string, string> = { [CUIDADO]: "Cuidado pessoal", LAZER: "Lazer", ALIMENTACAO: "Alimentação", SAUDE: "Saúde" };
const money = (v: number) => `R$ ${Math.round(v)}`;
const META: FocoMeta = { id: "europa", nome: "Europa", status: "BEHIND", quando: "novembro de 2027", porMes: 1340 };

/** O motor do Foco com os números do mundo: é dele que saem o Decidir e o topo. */
function motor(r: RespostasDoMes, m: Mundo, extra: Partial<FocoEntrada> = {}) {
  const categorias = Object.keys(m.plano).map((key) => ({ key, label: ROTULO[key] ?? key, planejado: m.plano[key], gasto: m.gasto[key] ?? 0 }));
  return montarFoco({
    ritmo: "semanal",
    dia: 14,
    diasNoMes: 31,
    categorias,
    gastoDoMes: categorias.reduce((s, c) => s + c.gasto, 0),
    aportadoNoMes: 0,
    aportePlanejado: 800,
    diasDesdeUltimoGasto: 1,
    metas: [META],
    reserva: { atual: 2000, custoMensal: 3000 },
    raiox: { n: 2, anual: 600 },
    hrefMes: "/mensal/2026/10",
    money,
    t: vozDoTema("padrao").titulos,
    respostas: r.respostas,
    ...extra,
  });
}

const dadosDaPilha = (m: Mundo): DadosDaPilha => ({
  money,
  remanejo: { categorias: Object.keys(m.plano).map((key) => ({ key, label: ROTULO[key] ?? key, planejado: m.plano[key], gasto: m.gasto[key] ?? 0 })), essenciais: [], livre: 800, diasRestantes: 18 },
  metas: [{ id: "europa", nome: "Europa", atual: 1429, alvo: 20000, prazoCurto: "nov/2027", porMes: 1340, ritmo: 200, chega: { curto: "mai/2032", ano: 2032, mes: 5 }, vencida: false }],
  reserva: { atual: 2000, alvo: 18000, fimDoMes: 300 },
  hrefMes: "/mensal/2026/10",
});

/** Onde o aviso da categoria aparece, tela por tela. */
function telasDaCategoria(linhas: DecisaoDoBanco[], k: string, m: Mundo = OUTUBRO) {
  const r = doMes(linhas, m);
  const f = motor(r, m);
  const pilha = [...f.atencao, ...f.depois].map((i) => cartaoDaPilha(i, dadosDaPilha(m))).filter((c) => c !== null).map((c) => c!.id);
  return {
    resumo: !categoriaResolvida(r, "categoria-subiu", k),
    orcamento: !categoriaResolvida(r, "estouro", k),
    decidir: pilha.includes(`estouro-${k}`),
    topo: f.atencao.some((i) => i.id === `estouro-${k}`),
    email: !alertaResolvido(r, `2026-10:${k}:100`),
  };
}
const EM_TODAS = { resumo: true, orcamento: true, decidir: true, topo: true, email: true };
const EM_NENHUMA = { resumo: false, orcamento: false, decidir: false, topo: false, email: false };

describe("sem resposta, o aviso aparece em todas as telas", () => {
  it("Cuidado pessoal passou R$ 120 e Lazer R$ 120", () => {
    expect(telasDaCategoria([], CUIDADO)).toEqual(EM_TODAS);
    expect(telasDaCategoria([], "LAZER")).toEqual(EM_TODAS);
  });
});

describe("categoria que passou: resolve numa tela, some em todas", () => {
  it("o caso da Dani: cobriu Cuidado pessoal no Orçamento (tirou de outras); o Resumo não diz mais que subiu", () => {
    // O plano subiu R$ 120 (tirado de Alimentação) e a folha gravou a resposta.
    const depois: Mundo = { ...OUTUBRO, plano: { ...OUTUBRO.plano, [CUIDADO]: 420, ALIMENTACAO: 1380 } };
    expect(telasDaCategoria([grava.aviso(`estouro-${CUIDADO}`, "cobrir", 420, 120)], CUIDADO, depois)).toEqual(EM_NENHUMA);
    // Antes desta regra, o Resumo só olhava categoria ainda acima do plano: depois de cobrir, não
    // estava mais, e a resposta era ignorada. Lazer, que ela não tocou, continua.
    expect(telasDaCategoria([grava.aviso(`estouro-${CUIDADO}`, "cobrir", 420, 120)], "LAZER", depois)).toEqual(EM_TODAS);
  });

  const respostas: [string, DecisaoDoBanco][] = [
    ["Foi pontual (Orçamento, folha O que fazer?)", grava.aviso("estouro-LAZER", "pontual", 520, 120)],
    ["Tirar de (Decidir)", grava.aviso("estouro-LAZER", "cobrir", 520, 120)],
    ["Usar o livre do mês (Decidir)", grava.aviso("estouro-LAZER", "livre", 520, 120)],
    ["Deixar assim por agora (Decidir)", grava.aviso("estouro-LAZER", "deixar", 520, 120)],
    ["Não gastar mais nada (topo, Ritual)", grava.teto("LAZER", 0, 520)],
    ["Subiu o plano no lápis (Orçamento)", grava.lapis("LAZER", 520)],
    ["Agora não (Resumo novo)", grava.sugestao("categoria", "LAZER", "agora-nao", { gasto: 520, excesso: 180 })],
  ];
  for (const [nome, l] of respostas) {
    it(nome, () => {
      expect(telasDaCategoria([l], "LAZER")).toEqual(EM_NENHUMA);
      // Só a categoria respondida: Cuidado pessoal continua em todas.
      expect(telasDaCategoria([l], CUIDADO)).toEqual(EM_TODAS);
    });
  }

  it("o plano subiu pelo Editar meu plano (sem resposta gravada): conta como resposta, com o gasto da hora", () => {
    const quando = new Date("2026-10-13T12:00:00Z");
    const m: Mundo = {
      ...OUTUBRO,
      plano: { ...OUTUBRO.plano, LAZER: 450 },
      subiram: planosQueSubiram([{ chave: "LAZER", planejado: 450, createdAt: new Date("2026-01-05T12:00:00Z"), updatedAt: quando }], { LAZER: 400 }),
      gastos: [
        { chave: "LAZER", valor: 500, createdAt: new Date("2026-10-10T12:00:00Z") },
        { chave: "LAZER", valor: 20, createdAt: new Date("2026-10-14T12:00:00Z") },
      ],
    };
    expect(telasDaCategoria([], "LAZER", m)).toEqual(EM_NENHUMA);
  });

  it("a categoria de onde ela TIROU para cobrir outra (o plano desceu) não conta como respondida", () => {
    const tirada = planosQueSubiram([{ chave: "ALIMENTACAO", planejado: 1380, createdAt: new Date("2026-01-05T12:00:00Z"), updatedAt: HOJE }], { ALIMENTACAO: 1500 });
    expect(tirada).toEqual([]);
  });

  it("tocar no 'Ver limite' do Resumo tira só o cartão do Resumo: o Orçamento é onde ela vai resolver", () => {
    expect(telasDaCategoria([grava.sugestao("categoria", "LAZER", "botao", { gasto: 520, excesso: 180 })], "LAZER")).toEqual({ ...EM_TODAS, resumo: false });
  });

  it("'Segurar em R$ X' (do aviso de ritmo) não responde ao 'passou do plano' que veio depois", () => {
    expect(telasDaCategoria([grava.teto("LAZER", 90, 500)], "LAZER")).toEqual({ ...EM_TODAS, resumo: false });
  });
});

describe("categoria correndo rápido (ritmo)", () => {
  // Alimentação: 1.150 de 1.500 no dia 14 (77%).
  const m: Mundo = { ...OUTUBRO, gasto: { ...OUTUBRO.gasto, ALIMENTACAO: 1150 } };
  const onde = (linhas: DecisaoDoBanco[]) => {
    const r = doMes(linhas, m);
    const f = motor(r, m);
    return {
      decidir: [...f.atencao, ...f.depois].map((i) => cartaoDaPilha(i, dadosDaPilha(m))?.id).includes("ritmo-ALIMENTACAO"),
      email: !alertaResolvido(r, "2026-10:ALIMENTACAO:80"),
      resumo: !categoriaResolvida(r, "categoria-subiu", "ALIMENTACAO"),
    };
  };
  it("aparece no Decidir, no e-mail de 80% e no Resumo", () => {
    expect(onde([])).toEqual({ decidir: true, email: true, resumo: true });
  });
  it("'Segurar em' no Decidir tira dos três", () => {
    expect(onde([grava.teto("ALIMENTACAO", 350, 1150)])).toEqual({ decidir: false, email: false, resumo: false });
  });
  it("'Deixar assim' no Decidir tira dos três", () => {
    expect(onde([grava.aviso("ritmo-ALIMENTACAO", "deixar", 1150, 0)])).toEqual({ decidir: false, email: false, resumo: false });
  });
});

describe("categoria que subiu (Resumo novo): o 'Agora não' vale nas outras telas", () => {
  it("a fila do Resumo pula a categoria respondida e mostra a próxima", () => {
    const r = doMes([grava.aviso(`estouro-${CUIDADO}`, "pontual", 420, 120)]);
    const fila: Sugestao[] = [
      { tipo: "categoria", id: CUIDADO, texto: "Cuidado pessoal subiu", botao: null },
      { tipo: "parcela", id: "2026-10", texto: "1 parcela acaba", botao: null },
    ];
    expect(escolherSugestaoDoMes(r, fila, { agora: HOJE, semana: "2026-W42" })?.tipo).toBe("parcela");
  });
});

describe("meta, reserva, guardar, fora do plano e Raio-X: resolve no Decidir, some no topo e no e-mail", () => {
  const ids = (linhas: DecisaoDoBanco[]) => {
    const r = doMes(linhas);
    const f = motor(r, OUTUBRO, { categorias: [{ key: "ALIMENTACAO", label: "Alimentação", planejado: 1500, gasto: 700 }], gastoDoMes: 2200 });
    return { todos: [...f.atencao, ...f.depois].map((i) => i.id), r };
  };
  it("sem resposta, todos aparecem", () => {
    expect(ids([]).todos).toEqual(expect.arrayContaining(["meta-europa", "reserva", "aporte", "fora", "raiox"]));
  });
  const casos: [string, string, DecisaoDoBanco][] = [
    ["meta: Guardar mais (Decidir)", "meta-europa", grava.aviso("meta-europa", "guardar-mais", 0, 0)],
    ["meta: Mudar a data (Decidir)", "meta-europa", grava.aviso("meta-europa", "mudar-data", 0, 0)],
    ["reserva: Mandar a sobra (Decidir)", "reserva", grava.aviso("reserva", "sobra-reserva", 0, 0)],
    ["guardar: Guardo esta semana (Decidir)", "aporte", linha({ tipo: "aviso_dispensado", chave: "2026-W42|aporte", dados: { como: "deixar" } })],
    ["fora do plano: Deixar assim (Decidir)", "fora", grava.aviso("fora", "deixar", 0, 0)],
    ["Raio-X: Deixar assim (Decidir)", "raiox", grava.aviso("raiox", "deixar", 0, 0)],
    ["meta: Entendi (gravado antes desta regra)", "meta-europa", grava.antiga("meta-europa", null)],
  ];
  for (const [nome, id, l] of casos) {
    it(nome, () => {
      const { todos, r } = ids([l]);
      expect(todos).not.toContain(id);
      if (id === "meta-europa") expect(alertaResolvido(r, "2026-10:goal:europa")).toBe(true);
    });
  }
  it("a meta sem resposta continua no e-mail", () => {
    expect(alertaResolvido(doMes([]), "2026-10:goal:europa")).toBe(false);
  });
});

describe("sugestões do Resumo (falta o cartão, revisar, fechar o mês, ritual): 'Agora não' vale no Resumo antigo também", () => {
  const casos: [Sugestao["tipo"], string][] = [
    ["falta-dado", "cartao"],
    ["falta-dado", "revisar"],
    ["hora-do-mes", "fechar-2026-9"],
    ["hora-do-mes", "ritual-2026-W42"],
    ["dinheiro", "m:netflix"],
    ["parcela", "2026-10"],
  ];
  for (const [tipo, id] of casos) {
    it(`${tipo}|${id}: some até o próximo extrato, nas duas telas`, () => {
      const r = doMes([grava.sugestao(tipo, id, "agora-nao")]);
      expect(sugestaoResolvida(r, { tipo, id })).toBe(true);
      expect(escolherSugestaoDoMes(r, [{ tipo, id, texto: "", botao: null }], { agora: HOJE, semana: "2026-W42" })).toBeNull();
      // Chegou um extrato novo: volta.
      expect(sugestaoResolvida({ ...r, marca: "2026-10-14T09:00:00.000Z" }, { tipo, id })).toBe(false);
    });
  }
  it("tocar no botão ('Mandar a fatura') duas vezes não pausa o tipo por 30 dias", () => {
    const r = doMes([grava.sugestao("falta-dado", "cartao", "botao", { marca: "2026-10-01" }), grava.sugestao("falta-dado", "revisar", "botao", { marca: "2026-10-02" })]);
    expect(escolherSugestaoDoMes(r, [{ tipo: "falta-dado", id: "cartao", texto: "", botao: null }], { agora: HOJE, semana: "2026-W42" })?.id).toBe("cartao");
  });
});

describe("volta se piorar bem (50% e pelo menos R$ 50)", () => {
  const piorou = (gastoLazer: number) => ({ ...OUTUBRO, gasto: { ...OUTUBRO.gasto, LAZER: gastoLazer } });
  it("foi pontual com Lazer passando R$ 120: segura até o gasto subir R$ 60 (metade do que passava)", () => {
    const l = [grava.aviso("estouro-LAZER", "pontual", 520, 120)];
    expect(telasDaCategoria(l, "LAZER", piorou(579))).toEqual(EM_NENHUMA);
    expect(telasDaCategoria(l, "LAZER", piorou(580))).toEqual(EM_TODAS);
  });
  it("aviso pequeno (passava R$ 20): volta com R$ 50 a mais, não com R$ 10", () => {
    const l = [grava.aviso("estouro-LAZER", "pontual", 420, 20)];
    expect(telasDaCategoria(l, "LAZER", piorou(469))).toEqual(EM_NENHUMA);
    expect(telasDaCategoria(l, "LAZER", piorou(470)).orcamento).toBe(true);
  });
  it("depois de cobrir: o plano novo não conta, conta o que ela gastou depois", () => {
    const l = [grava.aviso("estouro-LAZER", "cobrir", 520, 120)];
    const coberto = (g: number) => ({ ...OUTUBRO, gasto: { ...OUTUBRO.gasto, LAZER: g }, plano: { ...OUTUBRO.plano, LAZER: 520 } });
    expect(telasDaCategoria(l, "LAZER", coberto(560))).toEqual(EM_NENHUMA);
    expect(telasDaCategoria(l, "LAZER", coberto(580))).toEqual(EM_TODAS);
  });
  it("'Agora não' no Resumo (subiu R$ 180): volta com R$ 90 a mais, em todas as telas", () => {
    const l = [grava.sugestao("categoria", "LAZER", "agora-nao", { gasto: 520, excesso: 180 })];
    expect(telasDaCategoria(l, "LAZER", piorou(609))).toEqual(EM_NENHUMA);
    expect(telasDaCategoria(l, "LAZER", piorou(610))).toEqual(EM_TODAS);
  });
  it("não gastar mais nada segura o mês inteiro, piore o quanto piorar", () => {
    expect(telasDaCategoria([grava.teto("LAZER", 0, 520)], "LAZER", piorou(5000))).toEqual(EM_NENHUMA);
  });
  it("resposta antiga (só quanto passava): a regra de antes, contra o plano de agora", () => {
    const l = [grava.antiga("estouro-LAZER", 120)];
    expect(telasDaCategoria(l, "LAZER", piorou(579)).orcamento).toBe(false);
    expect(telasDaCategoria(l, "LAZER", piorou(580))).toEqual(EM_TODAS);
  });
  it("'Agora não' do Resumo de antes desta regra (sem gasto): só o cartão do Resumo, até o próximo extrato", () => {
    const antiga = linha({ tipo: "sugestao_dispensada", chave: "categoria|LAZER", descricao: MARCA, dados: { boa: false, semana: "2026-W42" } });
    expect(telasDaCategoria([antiga], "LAZER")).toEqual({ ...EM_TODAS, resumo: false });
    expect(categoriaResolvida(doMes([antiga], { ...OUTUBRO, marca: "2026-10-14T09:00:00.000Z" }), "categoria-subiu", "LAZER")).toBe(false);
  });
  it("resposta do mês passado não vale neste mês (o Resumo guarda 90 dias para a pausa do tipo)", () => {
    const setembro = { ...grava.sugestao("categoria", "LAZER", "agora-nao", { gasto: 520, excesso: 180 }), createdAt: new Date("2026-09-28T12:00:00Z") };
    expect(telasDaCategoria([setembro], "LAZER")).toEqual(EM_TODAS);
  });
});

describe("casal simples: o orçamento é da casa", () => {
  it("o Lucas cobriu Lazer: some para a Ana também", () => {
    expect(telasDaCategoria([grava.aviso("estouro-LAZER", "cobrir", 520, 120, OUTRO)], "LAZER")).toEqual(EM_NENHUMA);
    expect(telasDaCategoria([grava.teto("LAZER", 0, 520, OUTRO)], "LAZER")).toEqual(EM_NENHUMA);
  });
  it("o 'Agora não' do Resumo dele é dele: o cartão dela continua", () => {
    expect(telasDaCategoria([grava.sugestao("categoria", "LAZER", "agora-nao", { gasto: 520, excesso: 180 }, OUTRO)], "LAZER")).toEqual(EM_TODAS);
  });
  it("meta, reserva e o resto que não é do orçamento ficam com quem respondeu", () => {
    const r = doMes([grava.aviso("meta-europa", "deixar", 0, 0, OUTRO), grava.aviso("reserva", "deixar", 0, 0, OUTRO)]);
    const f = motor(r, OUTUBRO);
    expect([...f.atencao, ...f.depois].map((i) => i.id)).toEqual(expect.arrayContaining(["meta-europa", "reserva"]));
  });
});

describe("o catálogo declara cada aviso", () => {
  it("todo tipo tem onde aparece, id, condição, o que resolve e quando volta", () => {
    for (const [tipo, d] of Object.entries(AVISOS)) {
      expect(d.ondeAparece.length, tipo).toBeGreaterThan(0);
      expect(d.resolvidoPor.length, tipo).toBeGreaterThan(0);
      expect(d.id && d.existe && d.volta, tipo).toBeTruthy();
    }
  });
});
