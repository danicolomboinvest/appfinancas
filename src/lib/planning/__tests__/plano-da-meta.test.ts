import { describe, expect, it } from "vitest";
import {
  LIMITES_DAS_ALTERNATIVAS,
  alternativasPara,
  coisinhasDosGastos,
  fraseDoPlano,
  grupoDoLancamento,
  metadeArredondada,
  planoDaMeta,
  type AssinaturaDoPlano,
  type EntradaDoPlano,
  type LancamentoDoPlano,
  type PlanoDaMeta,
} from "../plano-da-meta";
import { porMesDaNovaMeta } from "@/lib/metas/projecao";

/** 16/10/2026: os meses fechados do plano são jul, ago e set de 2026. */
const HOJE = new Date(2026, 9, 16, 12);
const OUT_2027 = new Date(2027, 9, 1, 12);

type Mostra = Extract<PlanoDaMeta, { mostra: true }>;
const mostra = (p: PlanoDaMeta): Mostra => {
  if (!p.mostra) throw new Error(`não mostra: ${p.motivo}`);
  return p;
};

/** O mesmo gasto em cada mês fechado. */
function todoMes(base: Omit<LancamentoDoPlano, "ano" | "mes">, meses = [7, 8, 9]): LancamentoDoPlano[] {
  return meses.map((mes) => ({ ...base, ano: 2026, mes }));
}
/** Um gasto que fecha o mês com dado (aluguel), para o mês contar como mês com dados. */
const aluguel = todoMes({ valor: 1500, categoria: "MORADIA", subcategoria: "Aluguel", descricao: "Aluguel" });

/** A conta de exemplo do protótipo (anúncios): renda R$ 4.380, iFood, Uber e 99, Compras, Lazer. */
function contaDeExemplo(extra: Partial<EntradaDoPlano> = {}): EntradaDoPlano {
  const pedidos = (valores: number[]) => valores.flatMap((v, i) => [{ valor: v / 2, categoria: "ALIMENTACAO", subcategoria: "Delivery", descricao: "IFOOD *RESTAURANTE", ano: 2026, mes: 7 + i }, { valor: v / 2, categoria: "ALIMENTACAO", subcategoria: "Delivery", descricao: "IFD*BURGER", ano: 2026, mes: 7 + i }]);
  return {
    hoje: HOJE,
    perfil: { tipo: "PESSOAL", moeda: "BRL" },
    meta: { alvo: 5000, guardado: 0, prazo: OUT_2027 },
    rendaMedia: 4380,
    rendaMeses: 12,
    gastoTipico: { media: 4130, meses: 3 },
    aportesCombinados: 250,
    lancamentos: [
      ...aluguel,
      ...pedidos([370, 390, 410]),
      ...[240, 250, 260].map((v, i) => ({ valor: v, categoria: "TRANSPORTE", subcategoria: "Aplicativo", descricao: i % 2 ? "UBER *TRIP" : "99 APP *CORRIDA", ano: 2026, mes: 7 + i })),
      ...[120, 130, 140].map((v, i) => ({ valor: v, categoria: "OUTROS", subcategoria: null, descricao: i === 1 ? "SHEIN.COM" : "SHOPEE *LOJA", ano: 2026, mes: 7 + i })),
      ...[150, 155, 160].flatMap((v, i) => [{ valor: v - 60, categoria: "LAZER", subcategoria: "Bar/Balada", descricao: "BAR DO ZE", ano: 2026, mes: 7 + i }, { valor: 60, categoria: "LAZER", subcategoria: "Cinema/Shows", descricao: "INGRESSO SHOW", ano: 2026, mes: 7 + i }]),
      ...todoMes({ valor: 55.9, categoria: "LAZER", subcategoria: "Streaming", descricao: "NETFLIX.COM" }),
      ...todoMes({ valor: 900, categoria: "ALIMENTACAO", subcategoria: "Supermercado", descricao: "CARREFOUR" }),
      ...todoMes({ valor: 180, categoria: "TRANSPORTE", subcategoria: "Transporte público", descricao: "SPTRANS BILHETE UNICO" }),
    ],
    assinaturas: [
      { nome: "Max", mensal: 29.9, estado: "para_cancelar", marcas: ["c:m:max", "n:max", "r:max"], mesesCobrados: 3, marca: "hbomax" },
      { nome: "Globoplay", mensal: 22.9, estado: "para_cancelar", marcas: ["n:globoplay", "r:globoplay"], mesesCobrados: 3, marca: "globoplay" },
      { nome: "Netflix", mensal: 55.9, estado: "mantida", marcas: ["n:netflix", "r:netflix"], mesesCobrados: 3, marca: "netflix" },
    ],
    ...extra,
  };
}

describe("a sugestão", () => {
  it("reduz pela metade, arredondada para cima de R$ 10 em R$ 10", () => {
    expect(metadeArredondada(390)).toBe(200);
    expect(metadeArredondada(250)).toBe(130);
    expect(metadeArredondada(155)).toBe(80);
    expect(metadeArredondada(30)).toBe(20);
    expect(metadeArredondada(400)).toBe(200);
  });
});

describe("a conta de exemplo do protótipo", () => {
  const p = mostra(planoDaMeta(contaDeExemplo()));

  it("pede R$ 440 por mês para R$ 5.000 até out/2027 (o protótipo dizia R$ 400)", () => {
    expect(p.pede).toBe(440);
    expect(p.pede).toBe(porMesDaNovaMeta(5000, OUT_2027, HOJE));
    expect(p.prazoTexto).toBe("out/2027");
  });

  it("a sobra é renda menos gasto menos aportes, de R$ 10 em R$ 10", () => {
    expect(p.sobraBruta).toBe(0);
    expect(p.sobra).toBe(0);
    expect(p.falta).toBe(440);
  });

  it("acha as coisinhas na ordem do remanejo: assinaturas, desejo, dia a dia", () => {
    expect(p.coisinhas.map((c) => [c.nome, c.hoje, c.para, c.economia])).toEqual([
      ["Max", 29.9, 0, 29.9],
      ["Globoplay", 22.9, 0, 22.9],
      ["Lazer", 155, 80, 75],
      ["Compras", 130, 70, 60],
      ["iFood", 390, 200, 190],
      ["Uber e 99", 250, 130, 120],
    ]);
    expect(p.coisinhas.filter((c) => c.nivel === 2).map((c) => c.tipo)).toEqual(["delivery", "corrida"]);
    expect(p.coisinhas.find((c) => c.tipo === "compras")?.lojas).toEqual(["Shopee", "Shein"]);
  });

  it("nunca põe streaming mantido, mercado ou ônibus", () => {
    const nomes = p.coisinhas.map((c) => c.nome);
    expect(nomes).not.toContain("Netflix");
    expect(p.coisinhas.some((c) => c.hoje === 900 || c.hoje === 180)).toBe(false);
  });

  it("fecha com as 6 coisinhas e soma certo", () => {
    expect(p.situacao).toBe("fecha");
    expect(p.achado).toBeCloseTo(497.8, 2);
    // 29,90 + 22,90 + 75 + 60 + 190 = 377,80 < 440; com a corrida, 497,80.
    expect(p.fechaCom).toBe(6);
    expect(p.alternativas).toBeNull();
  });

  it("a frase não tem conta armada, nem travessão, e usa 'para'", () => {
    const f = fraseDoPlano(p) as string;
    expect(f).toBe("Para chegar até out/2027, faltam R$ 440 por mês.");
    expect(f).not.toMatch(/[—–]/);
    expect(f).not.toMatch(/\bpra\b/i);
  });
});

describe("as coisinhas", () => {
  const base = { hoje: HOJE, assinaturas: [] as AssinaturaDoPlano[] };

  it("usa a mediana dos meses fechados, com zero no mês sem gasto", () => {
    const { coisinhas } = coisinhasDosGastos({ ...base, lancamentos: [...aluguel, { ano: 2026, mes: 8, valor: 100, categoria: "LAZER", subcategoria: "Passeios", descricao: "PARQUE" }, { ano: 2026, mes: 9, valor: 300, categoria: "LAZER", subcategoria: "Passeios", descricao: "PARQUE" }] });
    expect(coisinhas[0]).toMatchObject({ tipo: "lazer", hoje: 100, meses: 2 });
  });

  it("só sugere com pelo menos R$ 30 por mês e em 2 dos 3 meses", () => {
    const pouco = coisinhasDosGastos({ ...base, lancamentos: [...aluguel, ...todoMes({ valor: 25, categoria: "LAZER", subcategoria: "Passeios", descricao: "PARQUE" }).map((l, i) => ({ ...l, valor: 25 + i }))] });
    expect(pouco.coisinhas).toHaveLength(0);
    const umMes = coisinhasDosGastos({ ...base, lancamentos: [...aluguel, { ano: 2026, mes: 9, valor: 900, categoria: "OUTROS", subcategoria: null, descricao: "SHEIN" }] });
    expect(umMes.coisinhas).toHaveLength(0);
  });

  it("parcela, pagamento de fatura, aplicação e Pix para pessoa nunca viram coisinha", () => {
    const g = (descricao: string, categoria = "OUTROS") => grupoDoLancamento({ ano: 2026, mes: 9, valor: 200, categoria, subcategoria: null, descricao });
    expect(g("SHOPEE *LOJA 03/10")).toBeNull();
    expect(g("MAGALU PARC 2/6")).toBeNull();
    expect(g("Pagamento de fatura")).toBeNull();
    expect(g("Aplicação RDB")).toBeNull();
    expect(g("Pix enviado Maria", "LAZER")).toBeNull();
    expect(g("SHOPEE *LOJA")?.tipo).toBe("compras");
    expect(g("Pix enviado Mercado Livre")?.tipo).toBe("compras");
  });

  it("Pix numa categoria dela de compras não é compra (pode ser qualquer coisa)", () => {
    const l = (descricao: string): LancamentoDoPlano => ({ ano: 2026, mes: 9, valor: 200, categoria: null, categoriaPropria: { nome: "Compras" }, subcategoria: null, descricao });
    expect(grupoDoLancamento(l("Pix enviado"))).toBeNull();
    expect(grupoDoLancamento(l("Transferencia enviada pelo Pix"))).toBeNull();
    expect(grupoDoLancamento(l("LOJA DA ESQUINA"))?.tipo).toBe("compras");
    expect(grupoDoLancamento({ ...l("LOJA"), categoriaPropria: { nome: "Beleza" } })).toBeNull();
    expect(grupoDoLancamento({ ...l("LOJA"), categoriaPropria: { nome: "Compras", essencial: true } })).toBeNull();
  });

  it("nunca Moradia, Saúde, Educação, Impostos, mercado, transporte público ou conta fixa", () => {
    for (const categoria of ["MORADIA", "SAUDE", "EDUCACAO", "IMPOSTOS"]) {
      expect(grupoDoLancamento({ ano: 2026, mes: 9, valor: 300, categoria, subcategoria: null, descricao: "UBER *TRIP" })).toBeNull();
    }
    expect(grupoDoLancamento({ ano: 2026, mes: 9, valor: 300, categoria: "ALIMENTACAO", subcategoria: "Supermercado", descricao: "AMAZON" })).toBeNull();
    expect(grupoDoLancamento({ ano: 2026, mes: 9, valor: 300, categoria: "TRANSPORTE", subcategoria: "Transporte público", descricao: "METRO" })).toBeNull();
    expect(grupoDoLancamento({ ano: 2026, mes: 9, valor: 300, categoria: "TRANSPORTE", subcategoria: "Aplicativo", descricao: "UBER *TRIP", fixa: true })).toBeNull();
  });

  it("Uber Eats é delivery, mesmo em Transporte", () => {
    expect(grupoDoLancamento({ ano: 2026, mes: 9, valor: 80, categoria: "TRANSPORTE", subcategoria: "Aplicativo", descricao: "UBER EATS" })?.tipo).toBe("delivery");
  });

  it("estorno lançado como gasto abate o mês", () => {
    const { coisinhas } = coisinhasDosGastos({ ...base, lancamentos: [...aluguel, ...todoMes({ valor: 300, categoria: "TRANSPORTE", subcategoria: "Aplicativo", descricao: "UBER *TRIP" }), { ano: 2026, mes: 8, valor: 100, categoria: "TRANSPORTE", subcategoria: "Aplicativo", descricao: "Estorno UBER" }] });
    // Meses: 300, 200, 300 -> mediana 300; sem o estorno seria 300 também, mas o mês de agosto cai.
    expect(coisinhas[0]).toMatchObject({ tipo: "corrida", hoje: 300 });
    const { coisinhas: c2 } = coisinhasDosGastos({ ...base, lancamentos: [...aluguel, ...todoMes({ valor: 300, categoria: "TRANSPORTE", subcategoria: "Aplicativo", descricao: "UBER *TRIP" }), ...todoMes({ valor: 100, categoria: "TRANSPORTE", subcategoria: "Aplicativo", descricao: "Estorno UBER" })] });
    expect(c2[0].hoje).toBe(200);
  });

  it("mensalidade fixa (um pagamento por mês, mesmo valor) não é hábito para cortar pela metade", () => {
    const { coisinhas } = coisinhasDosGastos({ ...base, lancamentos: [...aluguel, ...todoMes({ valor: 260, categoria: "LAZER", subcategoria: "Hobbies", descricao: "CLUBE" })] });
    expect(coisinhas).toHaveLength(0);
  });

  it("a assinatura do iFood marcada para cancelar não leva junto os pedidos do iFood", () => {
    const { coisinhas } = coisinhasDosGastos({
      hoje: HOJE,
      lancamentos: [...aluguel, ...todoMes({ valor: 12.9, categoria: "ALIMENTACAO", subcategoria: "Delivery", descricao: "IFOOD CLUBE" }), ...todoMes({ valor: 300, categoria: "ALIMENTACAO", subcategoria: "Delivery", descricao: "IFOOD *PIZZA" })],
      assinaturas: [{ nome: "iFood", mensal: 12.9, estado: "para_cancelar", marcas: ["r:ifood"], mesesCobrados: 3, marca: "ifood" }],
    });
    expect(coisinhas.map((c) => [c.nome, c.hoje])).toEqual([
      ["iFood (assinatura)", 12.9],
      ["iFood", 300],
    ]);
  });

  it("assinatura: só a marcada para cancelar, que ainda cobra, uma vez só", () => {
    const a = (nome: string, estado: AssinaturaDoPlano["estado"], marcas: string[], mesesCobrados = 3, mensal = 39.9): AssinaturaDoPlano => ({ nome, mensal, estado, marcas, mesesCobrados });
    const { coisinhas } = coisinhasDosGastos({
      hoje: HOJE,
      lancamentos: aluguel,
      assinaturas: [
        a("Spotify", "para_cancelar", ["r:spotify"]),
        a("SPOTIFY", "para_cancelar", ["n:spotify"]),
        a("Deezer", "mantida", ["r:deezer"]),
        a("Disney", "aberta", ["r:disney"]),
        a("Max", "cancelada", ["r:max"]),
        a("Paramount", "para_cancelar", ["r:paramount"], 0),
        a("Tinder", "para_cancelar", ["r:tinder"], 1, 9.9),
      ],
    });
    expect(coisinhas.map((c) => c.nome)).toEqual(["Spotify", "Tinder"]);
    expect(coisinhas.every((c) => c.acao === "cancelar" && c.para === 0)).toBe(true);
  });

  it("casal simples: o que é da casa vai depois do que é só dela, no mesmo nível", () => {
    const { coisinhas } = coisinhasDosGastos({
      ...base,
      lancamentos: [...aluguel, ...todoMes({ valor: 400, categoria: "LAZER", subcategoria: "Bar/Balada", descricao: "BAR", daCasa: true }), ...todoMes({ valor: 100, categoria: "OUTROS", subcategoria: null, descricao: "SHEIN" })].flatMap((l) => (l.categoria === "MORADIA" ? [l] : [{ ...l, valor: l.valor / 2 }, { ...l, valor: l.valor / 2 }])),
    });
    expect(coisinhas.map((c) => [c.tipo, c.daCasa])).toEqual([
      ["compras", false],
      ["lazer", true],
    ]);
  });
});

describe("os casos de borda", () => {
  it("perfil Empresa não mostra", () => {
    expect(planoDaMeta(contaDeExemplo({ perfil: { tipo: "EMPRESA", moeda: "BRL" } }))).toEqual({ mostra: false, motivo: "empresa" });
  });

  it("moeda diferente de real não mostra", () => {
    expect(planoDaMeta(contaDeExemplo({ perfil: { tipo: "PESSOAL", moeda: "EUR" } }))).toEqual({ mostra: false, motivo: "moeda" });
  });

  it("meta já alcançada não mostra", () => {
    expect(planoDaMeta(contaDeExemplo({ meta: { alvo: 5000, guardado: 5000, prazo: OUT_2027 } }))).toEqual({ mostra: false, motivo: "meta_concluida" });
  });

  it("sem renda: a sobra não entra (conta zero) e as coisinhas aparecem", () => {
    const p = mostra(planoDaMeta(contaDeExemplo({ rendaMedia: null })));
    expect(p.avisos).toContain("sem_renda");
    expect(p.sobraBruta).toBeNull();
    expect(p.falta).toBe(440);
    expect(p.situacao).toBe("fecha");
  });

  it("menos de 2 meses fechados com gasto: só o que a meta pede", () => {
    const e = contaDeExemplo();
    const p = mostra(planoDaMeta({ ...e, lancamentos: e.lancamentos.filter((l) => l.mes === 9), gastoTipico: { media: 4130, meses: 1 } }));
    expect(p.situacao).toBe("poucos_dados");
    expect(p.coisinhas).toEqual([]);
    expect(p.falta).toBe(440);
  });

  it("com 2 meses fechados, a coisinha precisa estar nos 2", () => {
    const e = contaDeExemplo();
    const p = mostra(planoDaMeta({ ...e, lancamentos: e.lancamentos.filter((l) => l.mes !== 7) }));
    expect(p.mesesDeDados).toBe(2);
    expect(p.avisos).toContain("dois_meses");
    expect(p.coisinhas.length).toBeGreaterThan(0);
  });

  it("sobra negativa conta zero (não soma o buraco) e avisa", () => {
    const p = mostra(planoDaMeta(contaDeExemplo({ gastoTipico: { media: 6000, meses: 3 } })));
    expect(p.avisos).toContain("sobra_negativa");
    expect(p.sobra).toBe(0);
    expect(p.falta).toBe(440);
  });

  it("aportes combinados maiores que a sobra nunca deixam a sobra negativa sozinhos", () => {
    const p = mostra(planoDaMeta(contaDeExemplo({ gastoTipico: { media: 3000, meses: 3 }, aportesCombinados: 47810 })));
    expect(p.sobraBruta).toBe(0);
    expect(p.avisos).not.toContain("sobra_negativa");
  });

  it("sobra maior que a meta: já cabe, sem plano", () => {
    const p = mostra(planoDaMeta(contaDeExemplo({ gastoTipico: { media: 3000, meses: 3 }, aportesCombinados: 0 })));
    expect(p.sobra).toBe(1380);
    expect(p.situacao).toBe("ja_cabe");
    expect(p.coisinhas).toEqual([]);
    expect(fraseDoPlano(p)).toBe("O que sobra hoje já paga essa meta até out/2027.");
  });

  it("nenhuma coisinha: vai direto às alternativas", () => {
    const e = contaDeExemplo({ gastoTipico: { media: 4000, meses: 3 }, aportesCombinados: 0 });
    const p = mostra(planoDaMeta({ ...e, lancamentos: aluguel, assinaturas: [] }));
    expect(p.situacao).toBe("sem_coisinhas");
    expect(p.sobra).toBe(380);
    expect(p.alternativas?.prazo?.texto).toBe("nov/2027");
    expect(p.alternativas?.metaMenor?.porMes).toBeLessThanOrEqual(380);
    expect(porMesDaNovaMeta((p.alternativas?.metaMenor?.alvo ?? 0) + 100, OUT_2027, HOJE)).toBeGreaterThan(380);
  });

  it("nenhuma coisinha e nada sobrando: sem alternativa nenhuma", () => {
    const p = mostra(planoDaMeta({ ...contaDeExemplo(), lancamentos: aluguel, assinaturas: [] }));
    expect(p.situacao).toBe("sem_coisinhas");
    expect(p.alternativas).toEqual({ prazo: null, metaMenor: null, oQueDa: null });
  });

  it("meta sem prazo: diz quando chega com a sobra e com as coisinhas", () => {
    const p = mostra(planoDaMeta(contaDeExemplo({ meta: { alvo: 5000, guardado: 0, prazo: null }, gastoTipico: { media: 3850, meses: 3 } })));
    expect(p.situacao).toBe("sem_prazo");
    expect(p.pede).toBeNull();
    expect(p.sobra).toBe(280);
    expect(p.semPrazo?.comSobra?.texto).toBeDefined();
    expect(p.semPrazo?.comCoisinhas && p.semPrazo.comSobra && p.semPrazo.comCoisinhas.meses < p.semPrazo.comSobra.meses).toBe(true);
    expect(fraseDoPlano(p)).toBe(`Com o que sobra hoje, você chega em ${p.semPrazo?.comSobra?.texto}.`);
  });

  it("prazo que já passou vira meta sem prazo", () => {
    const p = mostra(planoDaMeta(contaDeExemplo({ meta: { alvo: 5000, guardado: 1000, prazo: new Date(2026, 5, 1, 12) } })));
    expect(p.situacao).toBe("sem_prazo");
    expect(p.avisos).toContain("prazo_vencido");
  });

  it("renda de um mês só avisa", () => {
    expect(mostra(planoDaMeta(contaDeExemplo({ rendaMeses: 1 }))).avisos).toContain("renda_de_um_mes");
  });
});

describe("as alternativas", () => {
  const meta = { alvo: 5000, guardado: 0, prazo: OUT_2027 };

  it("prazo que cabe e meta menor, guardando o disponível", () => {
    const a = alternativasPara(meta, 377.8, HOJE);
    expect(a.prazo).toMatchObject({ texto: "nov/2027", porMes: 370 });
    // A maior meta, de R$ 100 em R$ 100, que cabe em R$ 377,80 até out/2027.
    expect(a.metaMenor).toEqual({ alvo: 4200, porMes: 370 });
    expect(porMesDaNovaMeta(4300, OUT_2027, HOJE)).toBeGreaterThan(377.8);
    expect(a.oQueDa).toBeNull();
  });

  it("prazo só até 3 vezes o escolhido e 10 anos; meta menor só com metade e R$ 200", () => {
    const a = alternativasPara(meta, 60, HOJE);
    expect(a.prazo).toBeNull();
    expect(a.metaMenor).toBeNull();
    expect(a.oQueDa).toBe(60);
    const longe = alternativasPara({ alvo: 200000, guardado: 0, prazo: new Date(2030, 9, 1, 12) }, 800, HOJE);
    expect(longe.prazo === null || longe.prazo.meses <= LIMITES_DAS_ALTERNATIVAS.prazoMaximoEmMeses).toBe(true);
  });

  it("nada disponível: nenhuma", () => {
    expect(alternativasPara(meta, 0, HOJE)).toEqual({ prazo: null, metaMenor: null, oQueDa: null });
  });
});
