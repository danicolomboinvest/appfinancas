import { describe, expect, it } from "vitest";
import { avaliarCompra, compraDecididaEmAberto, comprasAindaNaoLancadas, cortesPorMeta, mesesAteMeta, valorPresente, type CompraBase } from "../posso-comprar";

const fmt = { money: (v: number) => `R$ ${Math.round(v)}`, mesDaqui: (m: number | null) => (m === null ? "sem previsão" : `+${m}`) };
const base: CompraBase = {
  renda: 12000,
  gastoPlanejado: 9700,
  sobraDoMes: 2150,
  diasRestantes: 17,
  taxaReferencia: 0.009,
  metas: [
    { id: "viagem", nome: "Viagem", atual: 1500, alvo: 3000, aporte: 300, taxa: 0.009, prazoMeses: 5 },
    { id: "reserva", nome: "Reserva", atual: 5400, alvo: 12000, aporte: 2000, taxa: 0.009, prazoMeses: 0, reserva: true },
  ],
};

describe("avaliarCompra", () => {
  it("sem renda ou sem orçamento, pede o dado em vez de responder", () => {
    expect(avaliarCompra({ ...base, renda: 0 }, { valor: 100, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt)).toEqual({ erro: "renda" });
    expect(avaliarCompra({ ...base, gastoPlanejado: 0 }, { valor: 100, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt)).toEqual({ erro: "orcamento" });
  });

  it("celular de R$ 6.000 em 10x: cabe nos 90%, atrasa a viagem, não mexe na reserva", () => {
    const r = avaliarCompra(base, { valor: 6000, modo: "parcelado", parcelas: 10, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.veredito).toBe("custo");
    expect(r.titulo).toBe("Cabe, mas tem um custo");
    expect(r.explicacao).toContain("Viagem");
  });

  it("parcela que passa dos 90% da renda é não", () => {
    const r = avaliarCompra(base, { valor: 24000, modo: "parcelado", parcelas: 10, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.veredito).toBe("nao");
    expect(r.titulo).toContain("90%");
  });

  it("à vista maior que a sobra do mês não cabe e sugere parcelar ou guardar", () => {
    const r = avaliarCompra(base, { valor: 9499, modo: "vista", parcelas: 1, juros: 0, desconto: 0.1 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.veredito).toBe("nao");
    expect(r.sugestao).toBeTruthy();
  });

  it("sofá da aula: com 10% de desconto, à vista vale mais que 12x sem juros a 0,9%", () => {
    const r = avaliarCompra(base, { valor: 9499, modo: "parcelado", parcelas: 12, juros: 0, desconto: 0.1 }, fmt);
    if ("erro" in r || !r.comparacao) throw new Error();
    expect(r.comparacao.melhor).toBe("vista");
  });

  it("a reserva é a última a perder aporte", () => {
    const cortes = cortesPorMeta(base.metas, 600);
    expect(cortes.get("viagem")).toBe(300);
    expect(cortes.get("reserva")).toBe(300);
    expect(cortesPorMeta(base.metas, 200).has("reserva")).toBe(false);
  });

  it("valor presente sem taxa é a soma simples", () => {
    expect(valorPresente(100, 10, 0)).toBe(1000);
  });
});

describe("avaliarCompra: casos que o teste achou", () => {
  it("parcela sai primeiro do dinheiro sem destino; só o resto corta metas", () => {
    // renda 12.000, gastos 7.000, metas 2.300 → 2.700 sem destino. Parcela de 600 não mexe em meta.
    const r = avaliarCompra({ ...base, gastoPlanejado: 7000 }, { valor: 6000, modo: "parcelado", parcelas: 10, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.veredito).toBe("ok");
    expect(r.linhas.find((l) => l.rotulo === "Guardado por mês")?.depois).toBe("R$ 2300");
  });

  it("sugestão de parcelar usa o preço cheio, não o preço com desconto", () => {
    const r = avaliarCompra(base, { valor: 9500, modo: "vista", parcelas: 1, juros: 0, desconto: 0.2 }, fmt);
    if ("erro" in r) throw new Error();
    // folga dos 90% = 10.800 − 9.700 = 1.100 → 9.500 / 1.100 = 9x de R$ 1.056
    expect(r.sugestao).toContain("9x");
    expect(r.sugestao).toContain("R$ 1056");
  });

  it("parcelado em 1x é à vista; parcelas acima de 48 avisam o limite", () => {
    const uma = avaliarCompra(base, { valor: 500, modo: "parcelado", parcelas: 1, juros: 0, desconto: 0 }, fmt);
    if ("erro" in uma) throw new Error();
    expect(uma.linhas.some((l) => l.rotulo === "Parcela")).toBe(false);
    const muitas = avaliarCompra(base, { valor: 5000, modo: "parcelado", parcelas: 60, juros: 0, desconto: 0 }, fmt);
    if ("erro" in muitas) throw new Error();
    expect(muitas.conta.some((c) => c.valor.includes("48"))).toBe(true);
  });

  it("perto de 90% mostra casa decimal, e entrada estranha não vira NaN", () => {
    const r = avaliarCompra({ ...base, gastoPlanejado: 10000 }, { valor: 8500, modo: "parcelado", parcelas: 10, juros: -0.05, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.explicacao).toMatch(/90,\d%/);
    const nan = avaliarCompra(base, { valor: 600, modo: "parcelado", parcelas: Number.NaN, juros: Number.NaN, desconto: Number.NaN }, fmt);
    expect(JSON.stringify(nan)).not.toMatch(/NaN|Infinity/);
  });

  it("meta já alcançada não absorve corte; meta sem prazo perde antes das com prazo", () => {
    const metas = [
      { id: "pronta", nome: "Pronta", atual: 5000, alvo: 5000, aporte: 1000, taxa: 0, prazoMeses: 40 },
      { id: "semprazo", nome: "Sem prazo", atual: 0, alvo: 10000, aporte: 200, taxa: 0, prazoMeses: 0 },
      { id: "perto", nome: "Perto", atual: 0, alvo: 1000, aporte: 300, taxa: 0, prazoMeses: 4 },
    ];
    const c = cortesPorMeta(metas, 400);
    expect(c.get("pronta")).toBeUndefined();
    expect(c.get("semprazo")).toBe(200);
    expect(c.get("perto")).toBe(200);
  });

  it("sem metas, não fala de metas nem de reserva", () => {
    const r = avaliarCompra({ ...base, metas: [] }, { valor: 5000, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.linhas.some((l) => l.rotulo === "Suas metas")).toBe(false);
    expect(r.explicacao).not.toContain("reserva");
  });
});

describe("avaliarCompra: segunda rodada de testes", () => {
  it("regra de ouro considera o desconto à vista mesmo no modo parcelado", () => {
    const r = avaliarCompra({ ...base, taxaReferencia: 0.005 }, { valor: 1000, modo: "parcelado", parcelas: 12, juros: 0, desconto: 0.05 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.comparacao?.vista).toBe(950);
    expect(r.comparacao?.melhor).toBe("vista");
  });

  it("à vista também usa primeiro o dinheiro sem destino", () => {
    const r = avaliarCompra({ ...base, gastoPlanejado: 7000, sobraDoMes: 500 }, { valor: 1000, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.veredito).toBe("ok");
  });

  it("acima de 90% nunca aparece como '90%'", () => {
    const r = avaliarCompra({ ...base, renda: 10000, gastoPlanejado: 9000, metas: [] }, { valor: 40, modo: "parcelado", parcelas: 10, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.veredito).toBe("nao");
    expect(r.explicacao).toContain("90,1%");
  });

  it("previsão da meta bate com o plano (aporte no começo do mês)", () => {
    // R$ 500 em 6 meses: 83,33 por mês chega em 6, não em 7.
    expect(mesesAteMeta({ atual: 0, alvo: 500, taxa: 0 }, () => 500 / 6)).toBe(6);
  });
});

describe("avaliarCompra: aviso de juros", () => {
  it("juros acima do rendimento: amarelo, com o produto, o total e o a mais", () => {
    const r = avaliarCompra({ ...base, gastoPlanejado: 7000 }, { valor: 3000, modo: "parcelado", parcelas: 12, juros: 0.04, desconto: 0, descricao: "celular" }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.veredito).toBe("custo");
    expect(r.titulo).toContain("juros");
    expect(r.alertaJuros).toMatch(/^Celular custa R\$ 3000\. Em 12x com juros de 4% ao mês, você paga R\$ \d+: R\$ \d+ a mais só por parcelar\.$/);
  });

  it("sem juros, sem aviso; juros abaixo do rendimento avisa o valor mas não pinta de amarelo", () => {
    const sem = avaliarCompra({ ...base, gastoPlanejado: 7000 }, { valor: 3000, modo: "parcelado", parcelas: 12, juros: 0, desconto: 0 }, fmt);
    if ("erro" in sem) throw new Error();
    expect(sem.alertaJuros ?? null).toBeNull();
    const baixo = avaliarCompra({ ...base, gastoPlanejado: 7000 }, { valor: 3000, modo: "parcelado", parcelas: 12, juros: 0.005, desconto: 0 }, fmt);
    if ("erro" in baixo) throw new Error();
    expect(baixo.veredito).toBe("ok");
    expect(baixo.alertaJuros).toContain("a mais só por parcelar");
  });
});

describe("avaliarCompra: renda já comprometida", () => {
  const b = { ...base, renda: 10000, gastoPlanejado: 7000, sobraDoMes: 1500, metas: [] };

  it("gasto real maior que o planejado: a conta usa o real", () => {
    const planejado = avaliarCompra(b, { valor: 3000, modo: "parcelado", parcelas: 10, juros: 0, desconto: 0 }, fmt);
    const real = avaliarCompra({ ...b, gastoReal: 8800 }, { valor: 3000, modo: "parcelado", parcelas: 10, juros: 0, desconto: 0 }, fmt);
    if ("erro" in planejado || "erro" in real) throw new Error();
    expect(planejado.veredito).toBe("ok");
    expect(real.veredito).toBe("nao");
    expect(real.explicacao).toContain("88% comprometida");
    expect(real.comprometimento).toMatchObject({ valor: 8800, fonte: "real" });
  });

  it("gasto real menor que o planejado: vale o planejado (o maior dos dois)", () => {
    const r = avaliarCompra({ ...b, gastoReal: 5000 }, { valor: 3000, modo: "parcelado", parcelas: 10, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.comprometimento).toMatchObject({ valor: 7000, fonte: "planejado" });
  });

  it("à vista que cabe no mês mas leva os gastos acima de 90% fica amarelo", () => {
    const r = avaliarCompra({ ...b, gastoReal: 8900, sobraDoMes: 0 }, { valor: 500, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.veredito).toBe("custo");
    expect(r.titulo).toContain("90%");
  });
});

describe("avaliarCompra: jeitos diferentes de preencher", () => {
  const b = { ...base, renda: 10000, gastoPlanejado: 7000, sobraDoMes: 1500, metas: [] };

  it("o 'guardar' do Plano do mês conta mesmo sem meta", () => {
    const r = avaliarCompra({ ...b, guardarPlanejado: 2000 }, { valor: 1800, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.titulo).not.toContain("não tem destino");
  });

  it("orçamento que cobre só parte dos gastos: usa o que já saiu no mês e avisa", () => {
    const r = avaliarCompra({ ...b, gastoPlanejado: 1500, gastoDoMesAtual: 6000 }, { valor: 5000, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.veredito).not.toBe("ok");
    expect(r.comprometimento?.fonte).toBe("mes");
    expect(r.avisos?.join(" ")).toContain("orçamento inteiro");
  });

  it("gasto real muito acima do orçamento avisa sobre transferência/fatura; renda sem plano avisa a fonte", () => {
    const r = avaliarCompra({ ...b, gastoReal: 13000, fonteRenda: "media" }, { valor: 600, modo: "parcelado", parcelas: 6, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.avisos?.some((a) => a.includes("pagamento de fatura"))).toBe(true);
    expect(r.avisos?.some((a) => a.includes("não planejou a renda"))).toBe(true);
  });

  it("meta atrasada não aparece como 'no prazo'; meta no ritmo mostra a data dela", () => {
    const metas = [{ id: "v", nome: "Viagem", atual: 100, alvo: 10000, aporte: 4950, taxa: 0, prazoMeses: 2, status: "BEHIND" as const }];
    const r = avaliarCompra({ ...b, metas }, { valor: 500, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.linhas.find((l) => l.rotulo === "Suas metas")?.hoje).toBe("com atraso");
    const noRitmo = avaliarCompra({ ...b, metas: [{ id: "c", nome: "Casa", atual: 0, alvo: 3000, aporte: 1000, taxa: 0, prazoMeses: 3, status: "ON_TRACK" as const, mesesAtePrazo: 3 }] }, { valor: 3000, modo: "parcelado", parcelas: 10, juros: 0, desconto: 0 }, fmt);
    if ("erro" in noRitmo) throw new Error();
    expect(noRitmo.linhas.find((l) => l.rotulo === "Casa")?.hoje).toBe("+3");
  });
});

describe("avaliarCompra: casal com conta conjunta", () => {
  it("sem a regra dos 90%, a conta olha o que cabe e avisa por quê", () => {
    const b = { ...base, renda: 6000, gastoPlanejado: 5900, sobraDoMes: 800, metas: [], regra90: false };
    const r = avaliarCompra(b, { valor: 300, modo: "parcelado", parcelas: 3, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.titulo).not.toContain("90%");
    expect(r.avisos?.some((a) => a.includes("conta conjunta"))).toBe(true);
  });

  it("parcela maior que o que entra na conta conjunta é não, e não fala em 90%", () => {
    // Renda 5.000, orçamento 5.000, sem metas: R$ 30.000 em 10x (R$ 3.000/mês) leva a conta a 160%.
    const b = { ...base, renda: 5000, gastoPlanejado: 5000, sobraDoMes: 1000, metas: [], regra90: false };
    const r = avaliarCompra(b, { valor: 30000, modo: "parcelado", parcelas: 10, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.veredito).toBe("nao");
    expect(r.titulo).toContain("conta conjunta");
    expect(r.explicacao).not.toContain("90%");
    expect(r.conta.some((c) => c.rotulo.includes("90%"))).toBe(false);
  });

  it("cabe no guardado da conta conjunta: não é 'não', e a explicação não fala em 90%", () => {
    const b = { ...base, renda: 6000, gastoPlanejado: 5000, sobraDoMes: 800, metas: [], guardarPlanejado: 500, regra90: false };
    // Sem destino 500 + guardado 500 = 1.000 por mês; parcela de 900 cabe (a regra dos 90% diria não).
    const r = avaliarCompra(b, { valor: 9000, modo: "parcelado", parcelas: 10, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.veredito).toBe("ok");
    expect(r.explicacao).not.toContain("90%");
    // Um real a mais por mês e já não cabe.
    const estoura = avaliarCompra(b, { valor: 10010, modo: "parcelado", parcelas: 10, juros: 0, desconto: 0 }, fmt);
    if ("erro" in estoura) throw new Error();
    expect(estoura.veredito).toBe("nao");
    expect(estoura.sugestao).toContain("11x");
  });
});

describe("compras que ela já decidiu fazer", () => {
  const b = { ...base, renda: 10000, gastoPlanejado: 7000, sobraDoMes: 1500, guardarPlanejado: 1500, metas: [] };
  const bota = { valor: 1200, modo: "vista" as const, parcelas: 1, juros: 0, desconto: 0 };

  it("a segunda compra não usa de novo o dinheiro sem destino que a primeira já levou", () => {
    const primeira = avaliarCompra(b, bota, fmt);
    if ("erro" in primeira) throw new Error();
    expect(primeira.titulo).toBe("Cabe no dinheiro que ainda não tem destino");
    const segunda = avaliarCompra({ ...b, jaDecidido: { vista: 1200, parcelaMensal: 0 } }, bota, fmt);
    if ("erro" in segunda) throw new Error();
    expect(segunda.titulo).not.toBe("Cabe no dinheiro que ainda não tem destino");
    expect(segunda.conta.some((c) => c.rotulo.includes("já decidiu"))).toBe(true);
  });

  it("parcelas já decididas entram no compromisso de todo mês", () => {
    const r = avaliarCompra({ ...b, jaDecidido: { vista: 0, parcelaMensal: 300 } }, { valor: 3000, modo: "parcelado", parcelas: 10, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.comprometimento?.hoje).toBeCloseTo(0.73, 5);
  });

  it("compra que já virou lançamento não conta de novo", () => {
    const decidida = new Date("2026-09-10T15:00:00Z");
    const depois = new Date("2026-09-12T10:00:00Z");
    const decididas = [
      { valor: 1200, modo: "vista" as const, parcelas: 1, criadaEm: decidida },
      { valor: 3000, modo: "parcelado" as const, parcelas: 10, criadaEm: decidida },
      { valor: 500, modo: "vista" as const, parcelas: 1, criadaEm: decidida },
    ];
    // A bota foi importada; a parcela da jaqueta também; o tênis de 500 ainda não.
    const gastos = [
      { valor: 1200, criadoEm: depois },
      { valor: 300, criadoEm: depois },
      // Gasto de 500 lançado ANTES da decisão (outra compra): não é o tênis.
      { valor: 500, criadoEm: new Date("2026-09-01T10:00:00Z") },
    ];
    expect(comprasAindaNaoLancadas(decididas, gastos)).toEqual({ vista: 500, parcelaMensal: 0 });
    expect(comprasAindaNaoLancadas(decididas, [])).toEqual({ vista: 1700, parcelaMensal: 300 });
  });
});

describe("compras decididas: o que a revisão achou", () => {
  it("a compra à vista já decidida entra na regra dos 90% da compra seguinte", () => {
    // Renda 10.000, orçamento 7.000, guardar 500: a compra A de 2.000 à vista já foi decidida.
    const b: CompraBase = { ...base, renda: 10000, gastoPlanejado: 7000, sobraDoMes: 1000, guardarPlanejado: 500, metas: [], jaDecidido: { vista: 2000, parcelaMensal: 0 } };
    const r = avaliarCompra(b, { valor: 400, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    // 7.000 + 2.000 + 400 = 94% da renda: cabe no dinheiro, mas não é verde.
    expect(r.veredito).toBe("custo");
    expect(r.titulo).toBe("Cabe, mas passa da regra dos 90%");
    expect(r.comprometimento?.hoje).toBeCloseTo(0.9, 5);
    expect(r.comprometimento?.depois).toBeCloseTo(0.94, 5);
  });

  it("parcelado olha o compromisso de todo mês: a compra à vista decidida é uma vez só", () => {
    const b: CompraBase = { ...base, renda: 10000, gastoPlanejado: 7000, sobraDoMes: 1000, guardarPlanejado: 500, metas: [], jaDecidido: { vista: 2000, parcelaMensal: 0 } };
    const r = avaliarCompra(b, { valor: 4800, modo: "parcelado", parcelas: 12, juros: 0, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.comprometimento?.depois).toBeCloseTo(0.74, 5);
  });

  it("parcelado decidido no fim do mês continua na conta depois da virada", () => {
    const geladeira = { valor: 9600, modo: "parcelado" as const, parcelas: 12, criadaEm: new Date("2026-09-28T15:00:00Z") };
    const bota = { valor: 300, modo: "vista" as const, parcelas: 1, criadaEm: new Date("2026-09-28T15:00:00Z") };
    const dia1 = new Date("2026-10-01T12:00:00Z");
    expect(comprasAindaNaoLancadas([geladeira, bota], [], dia1)).toEqual({ vista: 0, parcelaMensal: 800 });
    // Uma parcela já lançada (a fatura dela está sendo importada): já está nos números.
    expect(comprasAindaNaoLancadas([geladeira], [{ valor: 800, criadoEm: new Date("2026-09-29T10:00:00Z") }], dia1)).toEqual({ vista: 0, parcelaMensal: 0 });
    // Depois da última parcela, sai.
    expect(compraDecididaEmAberto(geladeira, new Date("2027-08-15T12:00:00Z"))).toBe(true);
    expect(compraDecididaEmAberto(geladeira, new Date("2027-09-15T12:00:00Z"))).toBe(false);
  });

  it("o mês da decisão é o de Brasília", () => {
    // 22h do dia 30/09 em Brasília já é 01/10 em UTC: ainda é compra de setembro.
    const noite = { valor: 300, modo: "vista" as const, parcelas: 1, criadaEm: new Date("2026-10-01T01:00:00Z") };
    expect(compraDecididaEmAberto(noite, new Date("2026-09-30T23:30:00-03:00"))).toBe(true);
    expect(compraDecididaEmAberto(noite, new Date("2026-10-01T12:00:00Z"))).toBe(false);
  });

  it("parcelado com juros: o valor gravado (com juros) faz a parcela bater com o lançamento", () => {
    const r = avaliarCompra({ ...base, metas: [] }, { valor: 3000, modo: "parcelado", parcelas: 12, juros: 0.04, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    // O que a tela grava no "Vou comprar": o preço mais os juros.
    const gravado = 3000 + (r.custoJuros ?? 0);
    expect(gravado / 12).toBeCloseTo(319.66, 2);
    const decidida = { valor: gravado, modo: "parcelado" as const, parcelas: 12, criadaEm: new Date("2026-09-10T15:00:00Z") };
    expect(comprasAindaNaoLancadas([decidida], [{ valor: 319.66, criadoEm: new Date("2026-09-12T10:00:00Z") }])).toEqual({ vista: 0, parcelaMensal: 0 });
  });
});
