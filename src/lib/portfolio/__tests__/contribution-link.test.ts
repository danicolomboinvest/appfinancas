import { describe, expect, it } from "vitest";

/**
 * A regra do progresso da meta, isolada da consulta ao banco (goal.repo faz a mesma conta em
 * cima do que vem do Prisma). É a regra que evita os DOIS erros opostos: contar o mesmo dinheiro
 * duas vezes, e sumir com dinheiro que a pessoa guardou de verdade.
 */
type Aporte = { amount: number; allocations: { amount: number; assetGoalId: string | null }[] };

function progressoDaMeta(goalId: string, valorDosAtivosDaMeta: number, aportes: Aporte[]): number {
  const naoContado = aportes.reduce((sum, e) => {
    const jaNoAtivoDaMeta = e.allocations.filter((a) => a.assetGoalId === goalId).reduce((s, a) => s + a.amount, 0);
    return sum + Math.max(0, e.amount - jaNoAtivoDaMeta);
  }, 0);
  return valorDosAtivosDaMeta + naoContado;
}

describe("progresso da meta com aporte ligado a ativo", () => {
  it("aporte que ainda não virou ativo conta como guardado", () => {
    expect(progressoDaMeta("viagem", 0, [{ amount: 1000, allocations: [] }])).toBe(1000);
  });

  it("aporte que entrou num ativo DA META não conta duas vezes", () => {
    // O CDB da viagem já vale 1.000 por causa deste aporte; somar o aporte de novo daria 2.000.
    const aportes: Aporte[] = [{ amount: 1000, allocations: [{ amount: 1000, assetGoalId: "viagem" }] }];
    expect(progressoDaMeta("viagem", 1000, aportes)).toBe(1000);
  });

  it("aporte da meta que foi pra um ativo SEM meta continua contando", () => {
    // Guardou pensando na viagem, mas pôs em ITUB4, que não é da viagem: o dinheiro existe.
    const aportes: Aporte[] = [{ amount: 1428.57, allocations: [{ amount: 1428.57, assetGoalId: null }] }];
    expect(progressoDaMeta("viagem", 0, aportes)).toBeCloseTo(1428.57, 2);
  });

  it("aporte da meta que foi pra um ativo de OUTRA meta continua contando na origem", () => {
    const aportes: Aporte[] = [{ amount: 500, allocations: [{ amount: 500, assetGoalId: "casa" }] }];
    expect(progressoDaMeta("viagem", 0, aportes)).toBe(500);
  });

  it("aporte dividido: só o pedaço que entrou no ativo da meta é descontado", () => {
    const aportes: Aporte[] = [
      { amount: 1000, allocations: [{ amount: 600, assetGoalId: "viagem" }, { amount: 400, assetGoalId: null }] },
    ];
    // 600 já estão dentro dos 600 do ativo; os 400 continuam contando.
    expect(progressoDaMeta("viagem", 600, aportes)).toBe(1000);
  });

  it("vários meses de aporte somam, e o que virou ativo não dobra", () => {
    const aportes: Aporte[] = [
      { amount: 1000, allocations: [{ amount: 1000, assetGoalId: "viagem" }] },
      { amount: 1000, allocations: [{ amount: 1000, assetGoalId: "viagem" }] },
      { amount: 1000, allocations: [] },
    ];
    expect(progressoDaMeta("viagem", 2000, aportes)).toBe(3000);
  });
});
