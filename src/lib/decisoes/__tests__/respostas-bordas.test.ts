import { describe, expect, it } from "vitest";
import {
  esperadoNoRitmo,
  melhoreiDoMesPassado,
  minhaReservaBasta,
  porqueAcabouMaisRapido,
  quantoPossoGastarNaSemana,
  ritmoMensalDaMeta,
  type ResumoMes,
} from "../respostas";

/**
 * Bordas das respostas da Central: mês sem dados, zero, arredondamento de "quantos meses a
 * reserva cobre" e a virada do ano no ritmo da meta.
 *
 * `it.fails` = bug encontrado e NÃO corrigido aqui: o teste descreve o comportamento certo e
 * hoje falha. Quando o bug for corrigido, o Vitest acusa, e é só trocar `it.fails` por `it`.
 */
const money = (v: number) => `R$ ${v.toFixed(2)}`;
const vazio = (label: string): ResumoMes => ({ label, renda: 0, gastos: 0, guardado: 0, porCategoria: {} });

describe("melhoreiDoMesPassado: mês sem dados", () => {
  // Era bug (corrigido): cliente nova (nada lançado em agosto nem em setembro) pergunta "Melhorei?" e recebe
  // vermelho: "Não. Em setembro os gastos foram R$ 0 e o guardado R$ 0, contra R$ 0 e R$ 0".
  // Os três critérios usam ">" / "<" estritos, então empate em zero dá 0 pontos = "ruim".
  it("dois meses vazios não viram 'Não' em vermelho", () => {
    const r = melhoreiDoMesPassado({ money, atual: vazio("setembro"), anterior: vazio("agosto") });
    expect(r.veredito).not.toBe("ruim");
  });

  // Era bug (corrigido): mês anterior vazio (primeiro mês de uso) contra um mês com dados vira "Sim" verde:
  // guardou R$ 500 "a mais" que o nada. Não é melhora, é o primeiro mês.
  it("mês anterior vazio não é base pra dizer 'Sim, melhorou'", () => {
    const atual: ResumoMes = { label: "setembro", renda: 5000, gastos: 4500, guardado: 500, porCategoria: {} };
    const r = melhoreiDoMesPassado({ money, atual, anterior: vazio("agosto") });
    expect(r.veredito).not.toBe("bom");
  });

  it("renda zero não divide por zero na taxa de guardado (mostra 0%)", () => {
    const r = melhoreiDoMesPassado({ money, atual: { ...vazio("setembro"), guardado: 100 }, anterior: vazio("agosto") });
    expect(r.detalhes[0]).toContain("0% em setembro");
    expect(r.detalhes.join(" ")).not.toMatch(/NaN|Infinity/);
  });
});

describe("porqueAcabouMaisRapido: mês sem dados", () => {
  it("dois meses vazios não inventam categoria que subiu nem NaN", () => {
    const r = porqueAcabouMaisRapido({ money, atual: vazio("setembro"), anterior: vazio("agosto"), maiores: [] });
    expect(r.frase).not.toMatch(/NaN|Infinity|subiu/);
    expect(r.detalhes).toEqual([]);
  });
});

describe("quantoPossoGastarNaSemana: bordas", () => {
  it("sem orçamento pede o orçamento", () => {
    expect(quantoPossoGastarNaSemana({ money, livreSemana: null, livreMes: null, diasRestantes: 10, diasSemLancar: null }).veredito).toBe("atencao");
  });

  it("livre zero ou negativo é 'nada livre', em vermelho", () => {
    for (const livreMes of [0, -200]) {
      const r = quantoPossoGastarNaSemana({ money, livreSemana: 0, livreMes, diasRestantes: 10, diasSemLancar: null });
      expect(r.veredito).toBe("ruim");
      expect(r.frase).toMatch(/Nada livre/);
    }
  });

  it("último dia: 'acaba em 1 dia' e o valor por dia é o livre inteiro", () => {
    const r = quantoPossoGastarNaSemana({ money, livreSemana: 90, livreMes: 90, diasRestantes: 1, diasSemLancar: null });
    expect(r.frase).toBe("R$ 90.00 até o fim do mês, que acaba em 1 dia: uns R$ 90.00 por dia.");
  });

  it("dias restantes zero não divide por zero no 'por dia'", () => {
    const r = quantoPossoGastarNaSemana({ money, livreSemana: 90, livreMes: 90, diasRestantes: 0, diasSemLancar: null });
    expect(r.frase).not.toMatch(/NaN|Infinity/);
  });
});

describe("esperadoNoRitmo: bordas", () => {
  it("dia 1 (decorrido 0) ainda espera 3% do plano, nunca zero", () => {
    expect(esperadoNoRitmo(1000, 0, []).esperado).toBeCloseTo(30);
    expect(esperadoNoRitmo(1000, -0.5, []).esperado).toBeCloseTo(30);
  });

  it("sem plano, esperado zero; estorno (gasto negativo) em conta fixa não vira 'pago' negativo", () => {
    expect(esperadoNoRitmo(0, 0.5, [])).toEqual({ esperado: 0, fixoPago: 0 });
    const r = esperadoNoRitmo(2000, 0.5, [{ key: "MORADIA", label: "Moradia", planejado: 1500, gasto: -100, fixa: true }]);
    expect(r.fixoPago).toBe(0);
    expect(r.esperado).toBe(1000);
  });

  it("conta fixa paga acima do plano entra só até o plano do mês", () => {
    const r = esperadoNoRitmo(1000, 0.1, [{ key: "MORADIA", label: "Moradia", planejado: 800, gasto: 5000, fixa: true }]);
    expect(r.fixoPago).toBe(800);
    expect(r.esperado).toBeCloseTo(800 + 200 * 0.1);
  });
});

describe("minhaReservaBasta: arredondamento e zero", () => {
  it("sem reserva ou com custo mensal zero não divide por zero", () => {
    expect(minhaReservaBasta({ money, reserva: null, gastoReal: null }).veredito).toBe("ruim");
    expect(minhaReservaBasta({ money, reserva: { atual: 5000, custoMensal: 0, mesesMeta: 6, porMes: 100 }, gastoReal: null }).frase).toMatch(/Ainda não tem reserva/);
  });

  it("5,99 meses aparecem como 5,9 (arredonda pra baixo, nunca promete o que não tem)", () => {
    const r = minhaReservaBasta({ money, reserva: { atual: 5990, custoMensal: 1000, mesesMeta: 6, porMes: 100 }, gastoReal: null });
    expect(r.frase).toContain("5,9 meses");
    expect(r.veredito).toBe("atencao");
  });

  it("menos de 1 mês diz 'menos de 1 mês'; exatamente 1 diz '1 mês' no singular", () => {
    expect(minhaReservaBasta({ money, reserva: { atual: 999, custoMensal: 1000, mesesMeta: 6, porMes: 0 }, gastoReal: null }).frase).toContain("menos de 1 mês");
    expect(minhaReservaBasta({ money, reserva: { atual: 1000, custoMensal: 1000, mesesMeta: 6, porMes: 0 }, gastoReal: null }).frase).toContain("cobre 1 mês");
  });

  it("quanto falta arredonda os meses pra cima (5.000 / 3.000 = 2 meses, não 1,67)", () => {
    const r = minhaReservaBasta({ money, reserva: { atual: 1000, custoMensal: 1000, mesesMeta: 6, porMes: 3000 }, gastoReal: null });
    expect(r.detalhes.join(" ")).toContain("completa em 2 meses");
  });
});

describe("ritmoMensalDaMeta: virada do ano", () => {
  it("meta criada em dezembro, hoje janeiro: 1 mês fechado (não -11)", () => {
    expect(ritmoMensalDaMeta({ soma: 600, mesesComGuardado: 1, criadaEm: { ano: 2026, mes: 12 }, hoje: { ano: 2027, mes: 1 } })).toBe(600);
  });

  it("nunca divide por zero nem por mais de 3 meses", () => {
    expect(ritmoMensalDaMeta({ soma: 0, mesesComGuardado: 0, criadaEm: { ano: 2027, mes: 3 }, hoje: { ano: 2027, mes: 1 } })).toBe(0);
    expect(ritmoMensalDaMeta({ soma: 900, mesesComGuardado: 0, criadaEm: { ano: 2020, mes: 1 }, hoje: { ano: 2027, mes: 1 } })).toBe(300);
  });
});
