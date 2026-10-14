import { describe, expect, it } from "vitest";
import {
  categoriaQueCaiu,
  categoriaQueSubiu,
  categoriasQueMudaram,
  compararAteOMesmoDia,
  curvaAcumulada,
  diaDeCorte,
  direcao,
  escolherCaso,
  escolherSugestao,
  limiteProposto,
  porcentagemQueFicou,
  tipoPausadoAte,
  type Dispensa,
  type EntradaDoTopo,
  type SinalDoMes,
  type Sugestao,
} from "../regras";

const SEM: SinalDoMes = { gastos: 0, entradas: 0, extrato: false, fatura: false, digitados: 0 };
const base: EntradaDoTopo = { dia: 13, atual: SEM, passado: SEM, mesesComDado: 0, ultimoArquivo: null };
const SET = { ano: 2026, mes: 9 };

describe("Qual número vai no topo, caso a caso", () => {
  it("nada ainda: R$ ?, nunca um número inventado", () => {
    expect(escolherCaso(base)).toBe("nada");
  });

  it("primeira vez com o extrato da conta de setembro: o que ficou com ela", () => {
    const e = { ...base, passado: { ...SEM, gastos: 4870, entradas: 5480, extrato: true }, mesesComDado: 1, ultimoArquivo: { mes: SET, extrato: true, fatura: false } };
    expect(escolherCaso(e)).toBe("extrato");
  });

  it("primeira vez só com a fatura: o cartão em setembro (sem renda não existe 'ficou')", () => {
    const e = { ...base, passado: { ...SEM, gastos: 2140, fatura: true }, mesesComDado: 1, ultimoArquivo: { mes: SET, extrato: false, fatura: true } };
    expect(escolherCaso(e)).toBe("fatura");
  });

  it("extrato e fatura do mesmo mês: o mesmo número do extrato, com o cartão aberto", () => {
    const e = { ...base, passado: { ...SEM, gastos: 4870, entradas: 5480, extrato: true, fatura: true }, mesesComDado: 1, ultimoArquivo: { mes: SET, extrato: true, fatura: true } };
    expect(escolherCaso(e)).toBe("extrato-fatura");
  });

  it("só um gasto digitado: o número é o que ela digitou", () => {
    const e = { ...base, atual: { ...SEM, gastos: 45, digitados: 1 }, mesesComDado: 1 };
    expect(escolherCaso(e)).toBe("digitou");
  });

  it("dois meses ou mais e gasto no mês de agora: o dia a dia", () => {
    const e = { ...base, atual: { ...SEM, gastos: 3140, entradas: 5000 }, passado: { ...SEM, gastos: 4000, entradas: 6400 }, mesesComDado: 6 };
    expect(escolherCaso(e)).toBe("dia-a-dia");
  });

  it("dias 1 a 7: o mês que fechou", () => {
    const e = { ...base, dia: 3, atual: { ...SEM, gastos: 300 }, passado: { ...SEM, gastos: 4000, entradas: 6400 }, mesesComDado: 6 };
    expect(escolherCaso(e)).toBe("mes-fechado");
  });

  it("dia 8 em diante volta ao dia a dia", () => {
    const e = { ...base, dia: 8, atual: { ...SEM, gastos: 300 }, passado: { ...SEM, gastos: 4000, entradas: 6400 }, mesesComDado: 6 };
    expect(escolherCaso(e)).toBe("dia-a-dia");
  });

  it("dois meses, mas nada ainda no mês de agora: o mês que fechou, nunca 'R$ 0 saiu'", () => {
    const e = { ...base, passado: { ...SEM, gastos: 4000, entradas: 6400 }, mesesComDado: 3 };
    expect(escolherCaso(e)).toBe("mes-fechado");
  });

  it("extrato de setembro mandado no dia 3, conta nova: continua a primeira vez", () => {
    const e = { ...base, dia: 3, passado: { ...SEM, gastos: 4870, entradas: 5480, extrato: true }, mesesComDado: 1, ultimoArquivo: { mes: SET, extrato: true, fatura: false } };
    expect(escolherCaso(e)).toBe("extrato");
  });

  it("porcentagem do que ficou: 610 de 5.480 é 11%; sem entrada, nenhuma", () => {
    expect(porcentagemQueFicou(5480, 610)).toBe(11);
    expect(porcentagemQueFicou(0, 0)).toBeNull();
  });

  it("dias 1 a 7 com o mês passado só com a fatura (entrou 0): nunca 'saiu a mais do que entrou'", () => {
    const e = { ...base, dia: 3, atual: { ...SEM, gastos: 300 }, passado: { ...SEM, gastos: 2140, fatura: true }, mesesComDado: 2 };
    expect(escolherCaso(e)).toBe("dia-a-dia");
    const vazio = { ...base, dia: 3, passado: { ...SEM, gastos: 2140, fatura: true }, mesesComDado: 2, ultimoArquivo: { mes: SET, extrato: false, fatura: true } };
    expect(escolherCaso(vazio)).toBe("fatura");
  });

  it("com resgate o que ficou passa do que entrou: sem porcentagem (nunca 133%)", () => {
    expect(porcentagemQueFicou(3000, 4000)).toBeNull();
  });
});

describe("Comparação até o mesmo dia", () => {
  const outubro = [
    { valor: 100, dia: 2, categoria: "ALIMENTACAO" },
    { valor: 50, dia: 12, categoria: "LAZER" },
    { valor: 1650, dia: null, categoria: "MORADIA" },
  ];
  const setembro = [
    { valor: 80, dia: 5, categoria: "ALIMENTACAO" },
    { valor: 300, dia: 13, categoria: "LAZER" },
    { valor: 900, dia: 20, categoria: "ALIMENTACAO" },
    { valor: 1650, dia: null, categoria: "MORADIA" },
  ];

  it("o corte é o dia do último gasto, não hoje (o extrato do dia 12 compara com 12/09)", () => {
    expect(diaDeCorte(outubro, 14)).toBe(12);
    // Gasto com data do futuro (parcela projetada) não puxa o corte.
    expect(diaDeCorte([...outubro, { valor: 10, dia: 25, categoria: "X" }], 14)).toBe(12);
    // Sem nenhum dia: hoje.
    expect(diaDeCorte([{ dia: null }], 14)).toBe(14);
  });

  it("soma só até o mesmo dia nos dois meses; sem dia conta desde o dia 1", () => {
    const c = compararAteOMesmoDia(outubro, setembro, 12, SET);
    expect(c.atual).toBe(1800);
    // Setembro até 12/09: 80 + 1650 (os 300 do dia 13 e os 900 do dia 20 ficam de fora).
    expect(c.passado).toBe(1730);
    expect(c.diferenca).toBe(70);
  });

  it("dia 31 contra um mês de 30 dias vira 30", () => {
    expect(compararAteOMesmoDia([], [], 31, SET).cortePassado).toBe(30);
  });

  it("a curva acumula dia a dia", () => {
    expect(curvaAcumulada([{ valor: 10, dia: 1 }, { valor: 5, dia: 3 }, { valor: 1, dia: null }], 4)).toEqual([11, 11, 16, 16]);
  });

  it("as categorias que mais mudaram, em reais, até o mesmo dia; fixa igual fica de fora", () => {
    const m = categoriasQueMudaram(outubro, setembro, 12, 12, new Set(["MORADIA"]));
    expect(m.map((c) => c.categoria)).toEqual(["LAZER", "ALIMENTACAO"]);
    expect(m[0]).toMatchObject({ atual: 50, passado: 0, diferenca: 50, compras: 1 });
    expect(m[1]).toMatchObject({ atual: 100, passado: 80, diferenca: 20 });
  });

  it("estorno baixa o valor, mas não conta como compra", () => {
    const m = categoriasQueMudaram(
      [{ valor: 100, dia: 2, categoria: "LAZER" }, { valor: -40, dia: 3, categoria: "LAZER" }],
      [],
      12,
      12,
      new Set(),
    );
    expect(m[0]).toMatchObject({ atual: 60, compras: 1 });
  });

  it("direção: a mais, a menos, igual", () => {
    expect(direcao(180)).toBe("mais");
    expect(direcao(-120)).toBe("menos");
    expect(direcao(0.4)).toBe("igual");
  });
});

describe("Regras das sugestões", () => {
  const cat = (categoria: string, atual: number, passado: number) => ({ categoria, atual, passado, diferenca: atual - passado, compras: 3 });

  it("categoria que subiu: 20% e R$ 100, nunca Moradia, Saúde ou Educação", () => {
    expect(categoriaQueSubiu([cat("LAZER", 520, 340)])?.categoria).toBe("LAZER");
    // R$ 90 a mais: não.
    expect(categoriaQueSubiu([cat("LAZER", 430, 340)])).toBeNull();
    // R$ 150 a mais, mas só 10%: não.
    expect(categoriaQueSubiu([cat("ALIMENTACAO", 1650, 1500)])).toBeNull();
    expect(categoriaQueSubiu([cat("SAUDE", 900, 300)])).toBeNull();
  });

  it("algo indo bem: caiu R$ 100 e 20%", () => {
    expect(categoriaQueCaiu([cat("ALIMENTACAO", 400, 640)])?.categoria).toBe("ALIMENTACAO");
    expect(categoriaQueCaiu([cat("ALIMENTACAO", 600, 640)])).toBeNull();
  });

  it("limite: média dos últimos 3 meses, para cima de 50 em 50", () => {
    expect(limiteProposto([200, 380, 410, 360])).toBe(400);
    expect(limiteProposto([0, 0])).toBeNull();
  });
});

describe("Fila de sugestões e dispensa", () => {
  const S = (tipo: Sugestao["tipo"], id: string): Sugestao => ({ tipo, id, texto: id, botao: null });
  const agora = new Date("2026-10-14T12:00:00Z");
  const ctx = { marca: "2026-10-12T10:00:00.000Z", agora, semana: "2026-W42" };
  const dispensa = (tipo: Sugestao["tipo"], id: string, em: string, marca = "2026-10-12T10:00:00.000Z"): Dispensa => ({ tipo, id, marca, em: new Date(em) });

  it("uma por vez: vale a de maior prioridade, venha na ordem que vier", () => {
    const fila = [S("indo-bem", "a"), S("categoria", "LAZER"), S("falta-dado", "cartao")];
    expect(escolherSugestao(fila, [], ctx)?.tipo).toBe("falta-dado");
  });

  it("a prioridade fura a ordem dos tipos (Fechar o mês nos dias 1 a 7)", () => {
    const fila = [S("categoria", "LAZER"), { ...S("hora-do-mes", "fechar-2026-09"), prioridade: 0.5 }, S("falta-dado", "cartao")];
    expect(escolherSugestao(fila, [], ctx)?.tipo).toBe("falta-dado");
    expect(escolherSugestao(fila.slice(0, 2), [], ctx)?.tipo).toBe("hora-do-mes");
  });

  it("sem nada na fila, nada aparece", () => {
    expect(escolherSugestao([], [], ctx)).toBeNull();
  });

  it("'Agora não' esconde até o próximo extrato e mostra a próxima", () => {
    const fila = [S("falta-dado", "cartao"), S("categoria", "LAZER")];
    const d = [dispensa("falta-dado", "cartao", "2026-10-13T12:00:00Z")];
    expect(escolherSugestao(fila, d, ctx)?.id).toBe("LAZER");
    // Chegou um extrato novo: volta, se ainda valer.
    expect(escolherSugestao(fila, d, { ...ctx, marca: "2026-10-14T09:00:00.000Z" })?.id).toBe("cartao");
  });

  it("duas dispensas do mesmo tipo pausam o tipo por 30 dias, mesmo com extrato novo", () => {
    const d = [dispensa("categoria", "LAZER", "2026-10-01T12:00:00Z", "2026-10-01"), dispensa("categoria", "ALIMENTACAO", "2026-10-05T12:00:00Z", "2026-10-05")];
    expect(tipoPausadoAte(d, "categoria")?.toISOString()).toBe("2026-11-04T12:00:00.000Z");
    const fila = [S("categoria", "TRANSPORTE"), S("parcela", "nov")];
    expect(escolherSugestao(fila, d, { ...ctx, marca: "2026-10-14" })?.tipo).toBe("parcela");
    // Passados os 30 dias, volta.
    expect(escolherSugestao(fila, d, { ...ctx, marca: "2026-11-10", agora: new Date("2026-11-05T12:00:00Z") })?.tipo).toBe("categoria");
  });

  it("uma dispensa só não pausa o tipo", () => {
    expect(tipoPausadoAte([dispensa("dinheiro", "x", "2026-10-01T12:00:00Z")], "dinheiro")).toBeNull();
  });

  it("dispensa durante a pausa não conta para a próxima", () => {
    const d = [
      dispensa("parcela", "a", "2026-09-01T12:00:00Z"),
      dispensa("parcela", "b", "2026-09-02T12:00:00Z"),
      dispensa("parcela", "c", "2026-09-10T12:00:00Z"),
      dispensa("parcela", "d", "2026-10-05T12:00:00Z"),
    ];
    // Pausa até 02/10; a de 10/09 não conta; a de 05/10 é a primeira depois: sem pausa nova.
    expect(tipoPausadoAte(d, "parcela")?.toISOString()).toBe("2026-10-02T12:00:00.000Z");
  });

  it("'Boa' no indo bem: some nesta semana e não pausa o tipo", () => {
    const boa: Dispensa = { tipo: "indo-bem", id: "ALIMENTACAO", marca: ctx.marca, em: new Date("2026-10-13T12:00:00Z"), boa: true, semana: "2026-W42" };
    const boa2: Dispensa = { ...boa, id: "LAZER", em: new Date("2026-10-06T12:00:00Z"), semana: "2026-W41" };
    expect(escolherSugestao([S("indo-bem", "TRANSPORTE")], [boa], ctx)).toBeNull();
    expect(tipoPausadoAte([boa, boa2], "indo-bem")).toBeNull();
    expect(escolherSugestao([S("indo-bem", "TRANSPORTE")], [boa2], { ...ctx, marca: "2026-10-14" })?.id).toBe("TRANSPORTE");
  });
});

describe("a parcela projetada não vira dado do mês seguinte (14/10/2026)", () => {
  it("só a fatura de setembro, com a 3/3 projetada em outubro: o topo é a fatura de setembro", async () => {
    const { semAsProjetadas, escolherCaso } = await import("../regras");
    const valores = [
      { ano: 2026, mes: 9, entrou: 0, gastou: 482.65, guardou: 0 },
      { ano: 2026, mes: 10, entrou: 0, gastou: 150, guardou: 0 },
    ];
    const porLote = [
      { year: 2026, month: 9, importBatchId: "f1", _count: { _all: 7 } },
      { year: 2026, month: 10, importBatchId: "f1", _count: { _all: 1 } },
    ];
    const limpo = semAsProjetadas(valores, porLote, [{ ano: 2026, mes: 10, valor: 150, loteId: "f1" }]);
    expect(limpo.valores[1].gastou).toBe(0);
    expect(limpo.porLote).toHaveLength(1);
    const vazio = { gastos: 0, entradas: 0, extrato: false, fatura: false, digitados: 0 };
    const caso = escolherCaso({
      dia: 14,
      atual: { ...vazio, gastos: limpo.valores[1].gastou },
      passado: { ...vazio, gastos: limpo.valores[0].gastou, fatura: true },
      mesesComDado: limpo.valores.filter((v) => v.gastou !== 0).length,
      ultimoArquivo: { mes: { ano: 2026, mes: 9 }, extrato: false, fatura: true },
    });
    expect(caso).toBe("fatura");
    // Antes: as duas contavam, e a conta nova caía no "dia a dia" de outubro.
    expect(escolherCaso({ dia: 14, atual: { ...vazio, gastos: 150, fatura: true }, passado: { ...vazio, gastos: 482.65, fatura: true }, mesesComDado: 2, ultimoArquivo: { mes: { ano: 2026, mes: 10 }, extrato: false, fatura: true } })).toBe("dia-a-dia");
  });
});
