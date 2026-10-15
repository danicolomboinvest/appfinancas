import { describe, expect, it } from "vitest";
import { estadoDaAssinatura, type Evento, type RespostaDeAssinatura } from "../regra";
import {
  avisoDeHoje,
  cobrancaAnterior,
  diaDaCobranca,
  lembreteDaLinha,
  lembreteQueVale,
  proximaCobranca,
  textoDoAviso,
  type CobrancaDaAssinatura,
  type LembreteDeAssinatura,
} from "../lembrete";

/** O lembrete de cancelar no dia da cobrança (15/10/2026): a parte pura. */

const NETFLIX = ["c:m:netflix", "n:netflix", "r:netflix"];
const dia = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d));
const cob = (a: number, m: number, d: number | null, valor = 55.9): CobrancaDaAssinatura => ({ data: d === null ? null : dia(a, m, d), valor, year: a, month: m });

let n = 0;
const ev = (resposta: RespostaDeAssinatura | "desfazer", minuto: number, extra: Partial<Evento> = {}): Evento => ({
  id: `e${String(n++).padStart(4, "0")}`,
  marcas: NETFLIX,
  resposta,
  em: new Date(Date.UTC(2026, 9, 15, 12, minuto)),
  minha: true,
  daCasa: false,
  registro: true,
  ...extra,
});
const lem = (acao: "ligar" | "desligar", minuto: number, d: number | null = 12): LembreteDeAssinatura =>
  lembreteDaLinha({ id: `l${String(n++).padStart(4, "0")}`, descricao: acao, dados: { marcas: NETFLIX, em: new Date(Date.UTC(2026, 9, 15, 12, minuto)).toISOString(), dia: d, valor: 55.9, nome: "Netflix", raiox: "netflix" }, createdAt: new Date() })!;

describe("o dia da cobrança", () => {
  it("o dia em que ela costuma cair, com o valor da mais recente", () => {
    expect(diaDaCobranca([cob(2026, 7, 12, 49.9), cob(2026, 8, 12, 55.9), cob(2026, 9, 13, 55.9)])).toEqual({ dia: 13, valor: 55.9 });
  });

  it("escorregar de um mês para o outro (31 e 1) ainda é o mesmo dia", () => {
    expect(diaDaCobranca([cob(2026, 7, 31), cob(2026, 9, 1)])?.dia).toBe(1);
  });

  it("sem dia confiável devolve null: uma cobrança só, sem data, ou dias espalhados", () => {
    expect(diaDaCobranca([cob(2026, 9, 12)])).toBeNull();
    expect(diaDaCobranca([cob(2026, 8, null), cob(2026, 9, null)])).toBeNull();
    expect(diaDaCobranca([cob(2026, 7, 3), cob(2026, 8, 18), cob(2026, 9, 12)])).toBeNull();
    // Duas no mesmo mês contam como uma.
    expect(diaDaCobranca([cob(2026, 9, 10), cob(2026, 9, 12)])).toBeNull();
  });

  it("a próxima e a anterior respeitam o fim do mês", () => {
    expect(proximaCobranca(12, dia(2026, 10, 12))).toEqual(dia(2026, 10, 12));
    expect(proximaCobranca(12, dia(2026, 10, 13))).toEqual(dia(2026, 11, 12));
    expect(proximaCobranca(31, dia(2026, 11, 2))).toEqual(dia(2026, 11, 30));
    expect(proximaCobranca(30, dia(2027, 2, 1))).toEqual(dia(2027, 2, 28));
    expect(cobrancaAnterior(12, dia(2026, 10, 11))).toEqual(dia(2026, 9, 12));
    expect(cobrancaAnterior(31, dia(2026, 10, 1))).toEqual(dia(2026, 9, 30));
  });
});

describe("a trava: uma vez por ciclo", () => {
  const l = { dia: 12, em: dia(2026, 10, 1) };
  it("véspera e dia têm a mesma chave; o mês seguinte tem outra", () => {
    const vespera = avisoDeHoje("c:m:netflix", l, dia(2026, 10, 11));
    const noDia = avisoDeHoje("c:m:netflix", l, dia(2026, 10, 12));
    expect(vespera?.quando).toBe("vespera");
    expect(noDia?.quando).toBe("dia");
    expect(vespera?.chave).toBe(noDia?.chave);
    expect(avisoDeHoje("c:m:netflix", l, dia(2026, 11, 11))?.chave).not.toBe(vespera?.chave);
  });

  it("fora da véspera e do dia, nada; sem dia, nada", () => {
    expect(avisoDeHoje("c:m:netflix", l, dia(2026, 10, 9))).toBeNull();
    expect(avisoDeHoje("c:m:netflix", l, dia(2026, 10, 13))).toBeNull();
    expect(avisoDeHoje("c:m:netflix", { dia: null, em: l.em }, dia(2026, 10, 11))).toBeNull();
  });
});

describe("para sozinho", () => {
  it("vale enquanto está para cancelar e foi ligado depois do Cancelar", () => {
    const eventos = [ev("raiox_cancelar", 0)];
    expect(lembreteQueVale(NETFLIX, [lem("ligar", 1)], estadoDaAssinatura(NETFLIX, eventos))?.dia).toBe(12);
  });

  it("Cancelei mesmo, Manter, Uso e Não é assinatura param o lembrete", () => {
    const lembretes = [lem("ligar", 1)];
    for (const r of ["raiox_cancelei", "raiox_manter", "perdido_uso", "lista_nao_e"] as const) {
      const eventos = [ev("raiox_cancelar", 0), ev(r, 2)];
      expect(lembreteQueVale(NETFLIX, lembretes, estadoDaAssinatura(NETFLIX, eventos))).toBeNull();
    }
  });

  it("Desfazer o Cancelar para; cancelar de novo é pedido novo", () => {
    const c = ev("raiox_cancelar", 0);
    const lembretes = [lem("ligar", 1)];
    expect(lembreteQueVale(NETFLIX, lembretes, estadoDaAssinatura(NETFLIX, [c, ev("desfazer", 2, { desfaz: c.id })]))).toBeNull();
    expect(lembreteQueVale(NETFLIX, lembretes, estadoDaAssinatura(NETFLIX, [c, ev("desfazer", 2, { desfaz: c.id }), ev("raiox_cancelar", 3)]))).toBeNull();
  });

  it("Desfazer o lembrete tira o lembrete; ligar de novo volta", () => {
    const eventos = [ev("raiox_cancelar", 0)];
    expect(lembreteQueVale(NETFLIX, [lem("ligar", 1), lem("desligar", 2)], estadoDaAssinatura(NETFLIX, eventos))).toBeNull();
    expect(lembreteQueVale(NETFLIX, [lem("ligar", 1), lem("desligar", 2), lem("ligar", 3, 20)], estadoDaAssinatura(NETFLIX, eventos))?.dia).toBe(20);
  });

  it("linha estranha não vira lembrete", () => {
    expect(lembreteDaLinha({ id: "x", descricao: "outra", dados: { marcas: NETFLIX }, createdAt: new Date() })).toBeNull();
    expect(lembreteDaLinha({ id: "x", descricao: "ligar", dados: {}, createdAt: new Date() })).toBeNull();
    expect(lembreteDaLinha({ id: "x", descricao: "ligar", dados: { marcas: NETFLIX, dia: 40 }, createdAt: new Date() })?.dia).toBeNull();
  });
});

describe("Cancelou? quando a cobrança não veio", () => {
  const l = { dia: 12, em: dia(2026, 10, 5) };
  const id = "c:m:netflix";
  it("pergunta 3 dias depois do dia, se o extrato já passou do dia e a cobrança não veio", () => {
    const a = avisoDeHoje(id, l, dia(2026, 10, 16), { cobrancas: [cob(2026, 9, 12)], dadosAte: dia(2026, 10, 14) });
    expect(a?.quando).toBe("pergunta");
    expect(a?.cobranca).toEqual(dia(2026, 10, 12));
    expect(a?.chave).toBe("assinatura|c:m:netflix|2026-10-12|pergunta");
  });

  it("não pergunta: a cobrança veio, o extrato não chegou, já disse Ainda não, ou o ciclo é de antes do pedido", () => {
    expect(avisoDeHoje(id, l, dia(2026, 10, 16), { cobrancas: [cob(2026, 10, 13)], dadosAte: dia(2026, 10, 14) })).toBeNull();
    expect(avisoDeHoje(id, l, dia(2026, 10, 16), { cobrancas: [], dadosAte: dia(2026, 10, 10) })).toBeNull();
    expect(avisoDeHoje(id, l, dia(2026, 10, 16), { cobrancas: [], dadosAte: dia(2026, 10, 14), respondeuAindaNao: true })).toBeNull();
    expect(avisoDeHoje(id, { dia: 12, em: dia(2026, 10, 13) }, dia(2026, 10, 16), { cobrancas: [], dadosAte: dia(2026, 10, 14) })).toBeNull();
  });
});

describe("o texto", () => {
  it("curto, sem artigo, sem travessão", () => {
    expect(textoDoAviso("vespera", "Netflix", "R$ 55,90")).toEqual({ titulo: "Netflix cobra R$ 55,90 amanhã", corpo: "Se for cancelar, é hoje." });
    expect(textoDoAviso("dia", "Netflix", null).titulo).toBe("Netflix cobra hoje");
    expect(textoDoAviso("pergunta", "Netflix", null).corpo).toContain("Cancelou?");
    for (const q of ["vespera", "dia", "pergunta"] as const) expect(JSON.stringify(textoDoAviso(q, "Netflix", "R$ 1"))).not.toMatch(/[—–]|\bpra\b/);
  });
});
