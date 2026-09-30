import { describe, expect, it } from "vitest";
import { gastoDepoisDoCombinado, montarFoco, planoQueCabe, type FocoEntrada, type GastoDoCombinado } from "../foco";
import { vozDoTema } from "@/lib/profiles/voice";

const base = (over: Partial<FocoEntrada> = {}): FocoEntrada => ({
  ritmo: "semanal",
  dia: 14,
  diasNoMes: 30,
  categorias: [
    { key: "MORADIA", label: "Moradia", planejado: 3600, gasto: 3600 },
    { key: "ALIMENTACAO", label: "Alimentação", planejado: 1500, gasto: 720 },
    { key: "LAZER", label: "Lazer", planejado: 700, gasto: 610 },
  ],
  gastoDoMes: 4930,
  aportadoNoMes: 0,
  aportePlanejado: 2000,
  diasDesdeUltimoGasto: 1,
  metas: [],
  reserva: null,
  hrefMes: "/mensal/2026/9",
  money: (v) => `R$ ${Math.round(v)}`,
  t: vozDoTema("padrao").titulos,
  ...over,
});

describe("montarFoco", () => {
  it("livre da semana = sobra do orçamento ÷ dias que faltam × 7", () => {
    const f = montarFoco(base());
    // sobra: 0 + 780 + 90 = 870; 17 dias restantes (14 a 30)
    expect(f.livre.tipo).toBe("semana");
    if (f.livre.tipo === "semOrcamento") throw new Error();
    expect(f.livre.restante).toBe(870);
    expect(f.livre.valor).toBeCloseTo((870 / 17) * 7, 5);
  });

  it("sem orçamento não inventa número", () => {
    expect(montarFoco(base({ categorias: [] })).livre.tipo).toBe("semOrcamento");
  });

  it("estouro vem antes de tudo e nunca mostra mais de 3", () => {
    const f = montarFoco(
      base({
        categorias: [
          { key: "A", label: "A", planejado: 100, gasto: 150 },
          { key: "B", label: "B", planejado: 100, gasto: 80 },
          { key: "C", label: "C", planejado: 100, gasto: 75 },
        ],
        metas: [{ id: "m1", nome: "Viagem", status: "BEHIND", quando: "fevereiro de 2027", porMes: 400 }],
        reserva: { atual: 1000, custoMensal: 5000 },
      }),
    );
    expect(f.atencao).toHaveLength(3);
    expect(f.atencao[0].id).toBe("estouro-A");
    expect(f.atencao.map((i) => i.nivel)).toEqual([...f.atencao.map((i) => i.nivel)].sort());
    expect(f.depois.length).toBeGreaterThan(0);
  });

  it("não repete a mesma categoria como estouro e como ritmo", () => {
    const f = montarFoco(base({ categorias: [{ key: "A", label: "A", planejado: 100, gasto: 150 }] }));
    const ids = [...f.atencao, ...f.depois].map((i) => i.id);
    expect(ids.filter((id) => id.endsWith("-A"))).toEqual(["estouro-A"]);
  });

  it("quem é mensal e ainda não lançou nada recebe estimativa e nenhum alerta de gasto", () => {
    const f = montarFoco(base({ ritmo: "mensal", gastoDoMes: 0, categorias: [{ key: "A", label: "A", planejado: 3000, gasto: 0 }] }));
    expect(f.livre.tipo).toBe("estimativa");
    if (f.livre.tipo === "semOrcamento") throw new Error();
    expect(f.livre.restante).toBeCloseTo((3000 * 17) / 30, 5);
    expect([...f.atencao, ...f.depois].some((i) => i.id.startsWith("ritmo-") || i.id.startsWith("estouro-"))).toBe(false);
  });

  it("avisa quando o último gasto é velho (semanal)", () => {
    const f = montarFoco(base({ diasDesdeUltimoGasto: 12 }));
    if (f.livre.tipo === "semOrcamento") throw new Error();
    expect(f.livre.diasSemLancar).toBe(12);
  });

  it("aporte do mês só vira cobrança a partir do dia 10", () => {
    expect(montarFoco(base({ dia: 5 })).atencao.some((i) => i.id === "aporte")).toBe(false);
    expect([...montarFoco(base()).atencao, ...montarFoco(base()).depois].some((i) => i.id === "aporte")).toBe(true);
  });

  it("reserva abaixo de 6 meses de custo de vida entra; acima, não", () => {
    const todos = (f: ReturnType<typeof montarFoco>) => [...f.atencao, ...f.depois];
    expect(todos(montarFoco(base({ reserva: { atual: 5400, custoMensal: 9700 } }))).some((i) => i.id === "reserva")).toBe(true);
    expect(todos(montarFoco(base({ reserva: { atual: 60000, custoMensal: 9700 } }))).some((i) => i.id === "reserva")).toBe(false);
  });
});

describe("montarFoco: casos que os testes de persona acharam", () => {
  it("aluguel pago inteiro não vira 'correndo rápido'", () => {
    const f = montarFoco(base({ dia: 5 }));
    expect(f.atencao.map((i) => i.id)).not.toContain("ritmo-MORADIA");
  });

  it("o maior estouro nunca cai no '+N podem esperar'", () => {
    const f = montarFoco(
      base({
        categorias: [
          { key: "MERCADO", label: "Mercado", planejado: 1000, gasto: 1010 },
          { key: "TRANSP", label: "Transporte", planejado: 300, gasto: 350 },
          { key: "DELIV", label: "Delivery", planejado: 200, gasto: 260 },
          { key: "COMPRAS", label: "Compras", planejado: 400, gasto: 1400 },
        ],
        gastoDoMes: 3020,
      }),
    );
    expect(f.atencao[0].id).toBe("estouro-COMPRAS");
    expect(f.depois[0].id).toBe("estouro-MERCADO");
  });

  it("centavos acima do plano não são estouro", () => {
    const f = montarFoco(base({ categorias: [{ key: "A", label: "A", planejado: 500, gasto: 500.4 }], gastoDoMes: 500.4 }));
    expect(f.atencao.filter((i) => i.id.startsWith("estouro"))).toEqual([]);
  });

  it("livre desconta estouro e gasto fora do orçamento", () => {
    const f = montarFoco(
      base({
        categorias: [
          { key: "ALIMENTACAO", label: "Alimentação", planejado: 1500, gasto: 2500 },
          { key: "LAZER", label: "Lazer", planejado: 700, gasto: 0 },
        ],
        gastoDoMes: 2500,
      }),
    );
    if (f.livre.tipo === "semOrcamento") throw new Error();
    expect(f.livre.restante).toBe(0);
    const fora = montarFoco(base({ categorias: [{ key: "ALIMENTACAO", label: "Alimentação", planejado: 1500, gasto: 600 }], gastoDoMes: 9600 }));
    if (fora.livre.tipo === "semOrcamento") throw new Error();
    expect(fora.livre.restante).toBe(0);
  });

  it("categoria com aviso não aparece também em 'indo bem'", () => {
    // Teto do aviso de ritmo (R$ 90) e depois ela passou do plano: o estouro é novidade e aparece.
    const f = montarFoco(
      base({
        categorias: [{ key: "LAZER", label: "Lazer", planejado: 700, gasto: 900 }],
        gastoDoMes: 900,
        tetos: [{ categoria: "LAZER", valor: 90 }],
      }),
    );
    expect(f.atencao[0].id).toBe("estouro-LAZER");
    expect(f.bem.map((b) => b.titulo).join(" ")).not.toContain("Lazer");
    expect(f.combinados).toHaveLength(0);
  });

  it("'não gastar mais nada' (teto zero) resolve o estouro: sai da lista e vira combinado", () => {
    const f = montarFoco(
      base({
        categorias: [
          { key: "LAZER", label: "Lazer", planejado: 500, gasto: 700 },
          { key: "ALIMENTACAO", label: "Alimentação", planejado: 1500, gasto: 1700 },
        ],
        gastoDoMes: 2400,
        tetos: [{ categoria: "LAZER", valor: 0 }],
      }),
    );
    const ids = [...f.atencao, ...f.depois].map((i) => i.id);
    expect(ids).not.toContain("estouro-LAZER");
    // As outras categorias estouradas continuam avisando.
    expect(ids).toContain("estouro-ALIMENTACAO");
    // Vira um card de combinado, cumprido: nada entrou depois.
    expect(f.combinados).toHaveLength(1);
    expect(f.combinados[0]).toMatchObject({ categoria: "LAZER", teto: 0, quebrou: false });
  });

  it("combinado quebrado: o que entrou depois do 'nada mais' aparece", () => {
    const f = montarFoco(
      base({
        categorias: [{ key: "LAZER", label: "Lazer", planejado: 500, gasto: 780 }],
        gastoDoMes: 780,
        tetos: [{ categoria: "LAZER", valor: 0, gastoNaHora: 700 }],
      }),
    );
    expect([...f.atencao, ...f.depois].map((i) => i.id)).not.toContain("estouro-LAZER");
    expect(f.combinados[0]).toMatchObject({ depois: 80, quebrou: true });
  });

  it("teto do aviso de ritmo: conta só o que entrou depois contra o teto", () => {
    const f = montarFoco(
      base({
        categorias: [{ key: "LAZER", label: "Lazer", planejado: 500, gasto: 450 }],
        gastoDoMes: 450,
        tetos: [{ categoria: "LAZER", valor: 90, gastoNaHora: 410 }],
      }),
    );
    expect(f.combinados[0]).toMatchObject({ teto: 90, depois: 40, quebrou: false });
  });

  it("semanal sem gasto nenhum no mês depois do dia 7 avisa dado velho e não comemora", () => {
    const f = montarFoco(base({ dia: 20, diasDesdeUltimoGasto: null, categorias: [{ key: "A", label: "A", planejado: 1000, gasto: 0 }], gastoDoMes: 0 }));
    if (f.livre.tipo === "semOrcamento") throw new Error();
    expect(f.livre.semGastoComData).toBe(true);
    expect(f.livre.diasSemLancar).toBeNull();
    const velho = montarFoco(base({ dia: 20, diasDesdeUltimoGasto: 12, categorias: [{ key: "A", label: "Alimentação", planejado: 1000, gasto: 300 }], gastoDoMes: 300 }));
    expect(velho.bem.map((b) => b.titulo).join(" ")).not.toContain("dentro do ritmo");
  });

  it("reserva: arredonda pra baixo e acerta o plural", () => {
    const titulo = (atual: number) => montarFoco(base({ reserva: { atual, custoMensal: 1000 } })).atencao.concat(montarFoco(base({ reserva: { atual, custoMensal: 1000 } })).depois).find((i) => i.id === "reserva")?.titulo;
    expect(titulo(5960)).toContain("5,9 meses");
    expect(titulo(2000)).toContain("2 meses");
    expect(titulo(1000)).toContain("1 mês");
    expect(titulo(0)).toContain("menos de 1 mês");
  });

  it("meta com prazo vencido não pede 'o total em um mês'", () => {
    const f = montarFoco(base({ metas: [{ id: "m", nome: "Carro", status: "BEHIND", quando: "agosto de 2026", porMes: 18000, vencida: true }] }));
    const item = [...f.atencao, ...f.depois].find((i) => i.id === "meta-m");
    expect(item?.texto).not.toContain("18000");
    expect(f.fio).toBeNull();
  });

  it("mensal sem nada lançado não recebe cobrança de aporte", () => {
    const f = montarFoco(base({ ritmo: "mensal", dia: 20, gastoDoMes: 0, categorias: [{ key: "A", label: "A", planejado: 1000, gasto: 0 }] }));
    expect([...f.atencao, ...f.depois].map((i) => i.id)).not.toContain("aporte");
  });

  it("último dia do mês: '1 dia', nunca '1 dias', em todos os temas", () => {
    for (const tema of ["padrao", "girly", "minimalista", "disciplina", "semfiltro", "game", "manifestacao"] as const) {
      const t = vozDoTema(tema).titulos;
      const f = montarFoco(base({ t, dia: 30, categorias: [{ key: "A", label: "A", planejado: 100, gasto: 200 }], gastoDoMes: 200 }));
      expect(f.atencao[0].texto).not.toMatch(/\b1 dias\b/);
      expect(t.focoRaioXT(1)).not.toMatch(/\b1 gast(os|inhos)\b/);
      expect(t.fechImportadoT("agosto", 1)).not.toMatch(/\b1 (lançamentos|gastos)\b/);
    }
  });
});

describe("montarFoco: segunda rodada de testes", () => {
  it("gasto fora do orçamento que zera o livre vira aviso, e ninguém é elogiado", () => {
    const f = montarFoco(base({ aportePlanejado: null, categorias: [{ key: "ALIM", label: "Alimentação", planejado: 1500, gasto: 600 }], gastoDoMes: 9600 }));
    expect(f.atencao[0].id).toBe("fora");
    expect(f.bem.map((b) => b.titulo).join(" ")).not.toContain("dentro do ritmo");
  });

  it("a divisão por categoria soma exatamente o livre (ritual e Foco batem)", () => {
    const f = montarFoco(base({ categorias: [{ key: "M", label: "Mercado", planejado: 1000, gasto: 200 }, { key: "L", label: "Lazer", planejado: 500, gasto: 100 }], gastoDoMes: 1400 }));
    if (f.livre.tipo === "semOrcamento") throw new Error();
    expect(f.livre.porCategoria.reduce((s, c) => s + c.restante, 0)).toBeCloseTo(f.livre.restante, 6);
    const est = montarFoco(base({ ritmo: "mensal", dia: 20, gastoDoMes: 0, categorias: [{ key: "M", label: "Mercado", planejado: 1000, gasto: 0 }, { key: "L", label: "Lazer", planejado: 500, gasto: 0 }] }));
    if (est.livre.tipo === "semOrcamento") throw new Error();
    expect(est.livre.porCategoria.reduce((s, c) => s + c.restante, 0)).toBeCloseTo(est.livre.restante, 6);
  });

  it("meta que só com rendimento chega lá não pede aporte negativo; prazo neste mês fala do total", () => {
    const neg = montarFoco(base({ metas: [{ id: "a", nome: "A", status: "BEHIND", quando: "x", porMes: -30.7 }] }));
    expect([...neg.atencao, ...neg.depois].map((i) => i.id)).not.toContain("meta-a");
    const ultimo = montarFoco(base({ metas: [{ id: "b", nome: "B", status: "BEHIND", quando: "outubro de 2026", porMes: 18000, ultimoMes: true }] }));
    const item = [...ultimo.atencao, ...ultimo.depois].find((i) => i.id === "meta-b");
    expect(item?.texto).not.toContain("por mês");
  });

  it("conta fixa paga um pouco abaixo do plano no começo do mês não 'corre'", () => {
    const f = montarFoco(base({ dia: 3, categorias: [{ key: "MORADIA", label: "Moradia", planejado: 2000, gasto: 1850, fixa: true }], gastoDoMes: 1850 }));
    expect([...f.atencao, ...f.depois].map((i) => i.id)).not.toContain("ritmo-MORADIA");
  });

  it("mensal com só a despesa recorrente automática continua na estimativa", () => {
    const f = montarFoco(base({ ritmo: "mensal", dia: 20, lancouGastoNoMes: false, gastoDoMes: 2000, categorias: [{ key: "MORADIA", label: "Moradia", planejado: 2000, gasto: 2000, fixa: true }, { key: "A", label: "A", planejado: 1000, gasto: 0 }] }));
    expect(f.livre.tipo).toBe("estimativa");
    expect([...f.atencao, ...f.depois].map((i) => i.id)).not.toContain("aporte");
  });

  it("dado velho vale desde o começo do mês; nunca lançou = aviso próprio, sem 'há N dias'", () => {
    const f = montarFoco(base({ dia: 5, diasDesdeUltimoGasto: 60 }));
    if (f.livre.tipo === "semOrcamento") throw new Error();
    expect(f.livre.diasSemLancar).toBe(60);
    const nunca = montarFoco(base({ dia: 9, diasDesdeUltimoGasto: null }));
    if (nunca.livre.tipo === "semOrcamento") throw new Error();
    expect(nunca.livre.diasSemLancar).toBeNull();
    expect(nunca.livre.semGastoComData).toBe(true);
  });

  it("R$ 0,40 faltando não é 'Guardar R$ 0'; 99,6% não é '100% usado'", () => {
    const f = montarFoco(base({ aportePlanejado: 2000, aportadoNoMes: 1999.6 }));
    expect([...f.atencao, ...f.depois].map((i) => i.id)).not.toContain("aporte");
    expect(f.bem.some((b) => b.titulo.includes("guardados"))).toBe(true);
    const r = montarFoco(base({ dia: 10, categorias: [{ key: "A", label: "A", planejado: 1000, gasto: 996 }], gastoDoMes: 996 }));
    expect(r.atencao.find((i) => i.id === "ritmo-A")?.titulo).toContain("99%");
  });
});

describe("O plano estava baixo (planoQueCabe)", () => {
  it("sobe pro gasto até aqui mais o plano de sempre pros dias que faltam, e o aviso de ritmo não volta na hora", () => {
    // Dia 10 de 30, plano R$ 600, gasto R$ 703: antes subia pra R$ 710 e sobravam R$ 7 pra 21 dias.
    const novo = planoQueCabe({ gasto: 703, planejado: 600 }, 21, 30);
    expect(novo).toBe(1130);
    const depois = montarFoco(base({ dia: 10, categorias: [{ key: "ALIMENTACAO", label: "Alimentação", planejado: novo, gasto: 703 }], gastoDoMes: 703, aportePlanejado: null }));
    expect([...depois.atencao, ...depois.depois].map((i) => i.id)).toEqual([]);
  });

  it("gasto múltiplo de 10 não vira sobra zero", () => {
    expect(planoQueCabe({ gasto: 700, planejado: 600 }, 21, 30)).toBeGreaterThan(700);
  });

  it("conta fixa não corre: o plano novo é o que ela pagou", () => {
    expect(planoQueCabe({ gasto: 2050, planejado: 1800, fixa: true }, 21, 30)).toBe(2050);
  });

  it("o que já estava marcado antes do mês não se repete no resto do mês", () => {
    // Plano 1000, dos quais 800 são o plano de saúde automático: só os 200 que variam correm.
    expect(planoQueCabe({ gasto: 1100, planejado: 1000, fixoAutomatico: 800 }, 15, 30)).toBe(1200);
  });

  it("o aviso de estouro leva o plano novo pro botão", () => {
    const f = montarFoco(base({ dia: 10, categorias: [{ key: "LAZER", label: "Lazer", planejado: 600, gasto: 703 }], gastoDoMes: 703 }));
    const d = f.atencao[0].detalhe;
    expect(d?.tipo === "estouro" ? d.planoNovo : null).toBe(1130);
  });
});

describe("combinado: o que entrou DEPOIS dele (gastoDepoisDoCombinado)", () => {
  const combinadoEm = new Date("2026-09-12T18:00:00Z");
  const g = (over: Partial<GastoDoCombinado>): GastoDoCombinado => ({ valor: 100, dia: "2026-09-14", criadoEm: new Date("2026-09-14T15:00:00Z"), importado: false, ...over });

  it("fatura importada depois com compras de antes do combinado não quebra nada", () => {
    const soma = gastoDepoisDoCombinado(
      [
        g({ dia: "2026-09-03", criadoEm: new Date("2026-09-20T12:00:00Z"), importado: true }),
        g({ dia: null, criadoEm: new Date("2026-09-20T12:00:00Z"), importado: true }),
        // No próprio dia do combinado, importado: não dá pra saber se foi antes da hora.
        g({ dia: "2026-09-12", criadoEm: new Date("2026-09-20T12:00:00Z"), importado: true }),
      ],
      combinadoEm,
      "2026-09-12",
    );
    expect(soma).toBe(0);
  });

  it("gasto que já existia (movido pra categoria depois, ou conta fixa lançada lá atrás) não conta", () => {
    expect(gastoDepoisDoCombinado([g({ dia: "2026-09-03", criadoEm: new Date("2026-09-03T12:00:00Z") }), g({ dia: "2026-09-15", criadoEm: new Date("2026-01-05T12:00:00Z") })], combinadoEm, "2026-09-12")).toBe(0);
  });

  it("conta o gasto de depois: importado com data depois do dia, à mão lançado depois da hora", () => {
    const soma = gastoDepoisDoCombinado(
      [
        g({ valor: 80, dia: "2026-09-14", importado: true }),
        g({ valor: 30, dia: null, criadoEm: new Date("2026-09-12T20:00:00Z") }),
        g({ valor: 20, dia: "2026-09-12", criadoEm: new Date("2026-09-12T20:00:00Z") }),
        // Lançado à mão depois, mas com data de antes: é gasto antigo que ela lembrou agora.
        g({ valor: 500, dia: "2026-09-02", criadoEm: new Date("2026-09-13T20:00:00Z") }),
      ],
      combinadoEm,
      "2026-09-12",
    );
    expect(soma).toBe(130);
  });

  it("montarFoco usa a soma de depois em vez da diferença entre totais", () => {
    const f = montarFoco(
      base({
        categorias: [{ key: "LAZER", label: "Lazer", planejado: 500, gasto: 1000 }],
        gastoDoMes: 1000,
        // Na hora eram R$ 700; a fatura trouxe mais R$ 300 de antes do combinado.
        tetos: [{ categoria: "LAZER", valor: 0, gastoNaHora: 700, gastoDepois: 0 }],
      }),
    );
    expect(f.combinados[0]).toMatchObject({ depois: 0, quebrou: false });
  });
});
