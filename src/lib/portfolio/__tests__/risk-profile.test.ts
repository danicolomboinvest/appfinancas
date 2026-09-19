import { describe, expect, it } from "vitest";
import { riskProfileFromAnswers, horizonFromGoals } from "../risk-profile";

describe("perfil de investidora", () => {
  it("quem venderia tudo numa queda NUNCA passa de conservador", () => {
    // O defeito relatado: prazo longo e reserva pronta compensavam o medo na soma e a pessoa
    // saía como moderada — justamente quem mais precisa de proteção.
    expect(riskProfileFromAnswers({ prazo: 2, queda: 0, reserva: 2 }).profile).toBe("conservador");
    expect(riskProfileFromAnswers({ prazo: 2, queda: 0, reserva: 1 }).profile).toBe("conservador");
    expect(riskProfileFromAnswers({ prazo: 1, queda: 0, reserva: 2 }).profile).toBe("conservador");
  });

  it("explica o que limitou o perfil, em vez de só cuspir o rótulo", () => {
    expect(riskProfileFromAnswers({ prazo: 2, queda: 0, reserva: 2 }).reason).toContain("venderia tudo");
    expect(riskProfileFromAnswers({ prazo: 0, queda: 2, reserva: 2 }).reason).toContain("menos de 2 anos");
    expect(riskProfileFromAnswers({ prazo: 2, queda: 2, reserva: 0 }).reason).toContain("reserva");
  });

  it("quem segura queda com desconforto para em moderada", () => {
    expect(riskProfileFromAnswers({ prazo: 2, queda: 1, reserva: 2 }).profile).toBe("moderado");
  });

  it("arrojada exige as três coisas: prazo, estômago e reserva", () => {
    expect(riskProfileFromAnswers({ prazo: 2, queda: 2, reserva: 2 }).profile).toBe("arrojado");
    expect(riskProfileFromAnswers({ prazo: 2, queda: 2, reserva: 0 }).profile).toBe("moderado");
    expect(riskProfileFromAnswers({ prazo: 0, queda: 2, reserva: 2 }).profile).toBe("moderado");
  });

  it("dinheiro de curto prazo sem reserva é sempre conservador", () => {
    expect(riskProfileFromAnswers({ prazo: 0, queda: 2, reserva: 0 }).profile).toBe("conservador");
  });
});

describe("prazo tirado das metas", () => {
  const hoje = new Date("2026-09-19T12:00:00Z");
  const meta = (name: string, valor: number, data: string | null) => ({
    name,
    targetAmount: valor,
    targetDate: data ? new Date(data) : null,
  });

  it("sem meta com data, não inventa prazo", () => {
    expect(horizonFromGoals([], hoje)).toBeNull();
    expect(horizonFromGoals([meta("Sonho", 5000, null)], hoje)).toBeNull();
  });

  it("uma meta só: o prazo é o dela", () => {
    const h = horizonFromGoals([meta("Viagem", 20000, "2027-09-19")], hoje)!;
    expect(h.months).toBe(12);
    expect(h.prazo).toBe(0); // menos de 2 anos
    expect(h.summary).toContain("Viagem em 12 meses");
  });

  it("pesa pelo TAMANHO da meta, não pela quantidade", () => {
    // R$ 50.000 daqui a 1 ano e R$ 5.000 daqui a 10: a carteira é de curto prazo, não de longo.
    const h = horizonFromGoals(
      [meta("Entrada do apê", 50000, "2027-09-19"), meta("Aposentadoria", 5000, "2036-09-19")],
      hoje,
    )!;
    expect(h.months).toBeLessThan(24);
    expect(h.prazo).toBe(0);
  });

  it("mistura de curto, médio e longo cai no meio", () => {
    const h = horizonFromGoals(
      [meta("Viagem", 10000, "2027-09-19"), meta("Carro", 10000, "2030-09-19"), meta("Casa", 10000, "2033-09-19")],
      hoje,
    )!;
    expect(h.prazo).toBe(1); // entre 2 e 5 anos na média ponderada
    expect(h.summary.split(",")).toHaveLength(3);
  });

  it("meta bem longa puxa pra carteira de longo prazo", () => {
    const h = horizonFromGoals([meta("Liberdade financeira", 1000000, "2046-09-19")], hoje)!;
    expect(h.prazo).toBe(2);
    expect(h.summary).toContain("20 anos");
  });

  it("meta vencida conta como prazo zero, não negativo", () => {
    const h = horizonFromGoals([meta("Atrasada", 1000, "2020-01-01")], hoje)!;
    expect(h.months).toBe(0);
    expect(h.prazo).toBe(0);
  });
});
