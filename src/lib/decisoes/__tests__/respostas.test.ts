import { describe, expect, it } from "vitest";
import { comAbertura, estouGastandoDemais, minhaReservaBasta, ondeEstouExagerando, porqueAcabouMaisRapido, quandoAtinjoMinhaMeta, quantoPrecisoGuardar, ritmoMensalDaMeta } from "../respostas";

const money = (v: number) => `R$ ${Math.round(v)}`;
const cat = (key: string, planejado: number, gasto: number) => ({ key, label: key, planejado, gasto });

describe("respostas da Central", () => {
  it("estou gastando demais: responde sim/não com os números, não manda pra tela", () => {
    const bom = estouGastandoDemais({ money, gastoDoMes: 3000, planejado: 7000, decorrido: 0.6, renda: 10000, categorias: [cat("Mercado", 1500, 900)] });
    expect(bom.veredito).toBe("bom");
    expect(bom.frase).toMatch(/^Não\. Você gastou R\$ 3000 de R\$ 7000/);
    const ruim = estouGastandoDemais({ money, gastoDoMes: 7500, planejado: 7000, decorrido: 0.6, renda: 10000, categorias: [cat("Mercado", 1500, 2000)] });
    expect(ruim.veredito).toBe("ruim");
    expect(ruim.detalhes.join(" ")).toContain("Mercado");
  });

  it("a abertura segue o tema e fala com a pessoa", () => {
    const r = comAbertura("girly", estouGastandoDemais({ money, gastoDoMes: 3000, planejado: 7000, decorrido: 0.6, renda: null, categorias: [] }));
    expect(r.frase.startsWith("Amiga, não.")).toBe(true);
  });

  it("onde estou exagerando: aponta a categoria mais acima do ritmo", () => {
    const r = ondeEstouExagerando({ money, decorrido: 0.5, categorias: [cat("Lazer", 600, 500), cat("Mercado", 1500, 800)], fora: 0, maiores: [], recorrentesAno: null });
    expect(r.frase).toContain("Lazer");
    const nada = ondeEstouExagerando({ money, decorrido: 0.5, categorias: [cat("Lazer", 600, 200)], fora: 0, maiores: [], recorrentesAno: null });
    expect(nada.veredito).toBe("bom");
  });

  it("quanto preciso guardar: soma metas e reserva, nunca abaixo de 10% da renda", () => {
    const meta = { nome: "Viagem", alvo: 6000, atual: 0, prazo: "dezembro de 2026", necessarioPorMes: 500, ritmoPorMes: 300, chegaEm: null, noPrazo: false };
    const r = quantoPrecisoGuardar({ money, metas: [meta], reserva: { porMes: 400, falta: 8000 }, guardarPlanejado: 600, renda: 10000 });
    expect(r.frase).toContain("R$ 1000 por mês");
    expect(r.veredito).toBe("ruim");
  });

  it("quando atinjo a meta: no ritmo real, diz se chega no prazo", () => {
    const r = quandoAtinjoMinhaMeta({ money, metas: [{ nome: "Carro", alvo: 30000, atual: 10000, prazo: "junho de 2027", necessarioPorMes: 2200, ritmoPorMes: 1000, chegaEm: "maio de 2028", noPrazo: false }] });
    expect(r.frase).toContain("depois do prazo");
  });

  it("reserva: usa o custo de vida real quando ele é maior", () => {
    const r = minhaReservaBasta({ money, reserva: { atual: 30000, custoMensal: 5000, mesesMeta: 6, porMes: 1000 }, gastoReal: 7000 });
    expect(r.veredito).not.toBe("bom");
    expect(r.detalhes.join(" ")).toContain("R$ 7000");
  });

  it("por que acabou mais rápido: mostra o que subiu", () => {
    const antes = { label: "julho", renda: 10000, gastos: 6000, guardado: 1000, porCategoria: { LAZER: { label: "Lazer", valor: 400 } } };
    const agora = { label: "agosto", renda: 10000, gastos: 7200, guardado: 800, porCategoria: { LAZER: { label: "Lazer", valor: 1400 } } };
    const r = porqueAcabouMaisRapido({ money, atual: agora, anterior: antes, maiores: [] });
    expect(r.frase).toContain("Lazer (+R$ 1000)");
  });
});

describe("respostas: conta fixa", () => {
  it("aluguel pago no começo do mês não aparece como exagero", () => {
    const r = ondeEstouExagerando({ money, decorrido: 0.3, categorias: [{ key: "MORADIA", label: "Moradia", planejado: 3000, gasto: 2900, fixa: true }], fora: 0, maiores: [], recorrentesAno: null });
    expect(r.veredito).toBe("bom");
  });
});

describe("respostas da Central: o que a revisão achou", () => {
  it("aluguel já pago não faz o mês parecer acima do ritmo", () => {
    const r = estouGastandoDemais({
      money,
      gastoDoMes: 2000,
      planejado: 5000,
      decorrido: 5 / 30,
      renda: 10000,
      categorias: [
        { key: "MORADIA", label: "Moradia", planejado: 2000, gasto: 2000, fixa: true },
        { key: "ALIMENTACAO", label: "Alimentação", planejado: 3000, gasto: 0 },
      ],
    });
    expect(r.veredito).toBe("bom");
    expect(r.conta.some((c) => c.rotulo.includes("Contas fixas"))).toBe(true);
  });

  it("recorrente lançado no dia 1 também entra inteiro; o resto continua correndo com os dias", () => {
    const r = estouGastandoDemais({
      money,
      gastoDoMes: 1800,
      planejado: 3000,
      decorrido: 5 / 30,
      renda: 10000,
      categorias: [{ key: "SAUDE", label: "Saúde", planejado: 3000, gasto: 1800, fixoAutomatico: 800 }],
    });
    // Esperado: 800 + 2.200 × 5/30 ≈ 1.167; gastou 1.800: acima do ritmo.
    expect(r.veredito).toBe("atencao");
  });

  it("casal só com a conta conjunta: não cobra a regra dos 90%", () => {
    const r = estouGastandoDemais({ money, gastoDoMes: 4600, planejado: 5000, decorrido: 24 / 30, renda: 5000, categorias: [], regra90: false });
    expect(r.veredito).not.toBe("ruim");
    expect(r.detalhes.join(" ")).not.toMatch(/passam de 90%/);
    expect(r.conta.some((c) => c.rotulo === "90% da renda")).toBe(false);
    const comRegra = estouGastandoDemais({ money, gastoDoMes: 4600, planejado: 5000, decorrido: 24 / 30, renda: 5000, categorias: [] });
    expect(comRegra.veredito).toBe("ruim");
  });

  it("meta vencida: pede data nova em vez de cobrar o que falta inteiro por mês", () => {
    const viagem = { nome: "Viagem", alvo: 10000, atual: 2000, prazo: "agosto de 2026", necessarioPorMes: 500, ritmoPorMes: 500, chegaEm: "junho de 2028", noPrazo: false, vencida: true };
    const meta = quandoAtinjoMinhaMeta({ money, metas: [viagem] });
    expect(meta.frase).toContain("já passou");
    expect(meta.frase).not.toContain("Pra chegar a tempo");
    expect(meta.acoes[0].rotulo).toBe("Escolher uma data nova");
    const guardar = quantoPrecisoGuardar({ money, metas: [viagem], reserva: null, guardarPlanejado: 500, renda: null });
    expect(guardar.frase).toMatch(/^R\$ 500 por mês/);
    expect(guardar.detalhes[0]).toContain("já passou");
    const semValor = quantoPrecisoGuardar({ money, metas: [{ ...viagem, necessarioPorMes: 0 }], reserva: null, guardarPlanejado: 0, renda: null });
    expect(semValor.frase).toContain("data nova");
  });

  it("ritmo da meta divide pelos meses em que ela já existia", () => {
    // Criada em agosto, 600 em agosto e 600 em setembro: em outubro, 600 por mês.
    expect(ritmoMensalDaMeta({ soma: 1200, mesesComGuardado: 2, criadaEm: { ano: 2026, mes: 8 }, hoje: { ano: 2026, mes: 10 } })).toBe(600);
    expect(ritmoMensalDaMeta({ soma: 1800, mesesComGuardado: 3, criadaEm: { ano: 2025, mes: 1 }, hoje: { ano: 2026, mes: 10 } })).toBe(600);
    // Guardado lançado com data de antes da criação conta o mês dele.
    expect(ritmoMensalDaMeta({ soma: 1800, mesesComGuardado: 3, criadaEm: { ano: 2026, mes: 9 }, hoje: { ano: 2026, mes: 10 } })).toBe(600);
    expect(ritmoMensalDaMeta({ soma: 600, mesesComGuardado: 1, criadaEm: { ano: 2026, mes: 10 }, hoje: { ano: 2026, mes: 10 } })).toBe(600);
  });
});
