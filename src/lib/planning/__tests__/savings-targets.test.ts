import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * A fila "pra onde vai o que você guarda" (reserva + metas abertas), com repositórios de mentira.
 * Bordas: reserva já completa, reserva com mais na carteira do que no campo, meta alcançada,
 * meta com alvo zero, valores que chegam do banco como texto (Decimal).
 */
type Fundo = { currentAmount: string; targetMonths: number; monthlyExpenseBase: string; monthlyContribution: string } | null;
type Meta = { id: string; name: string; targetAmount: string; computedCurrentAmount: number; targetDate: Date | null; annualRate: string | null; createdAt: Date };

const banco = vi.hoisted(() => ({ fundo: null as Fundo, metas: [] as Meta[], ativos: [] as { objective: string; currentValue: string }[] }));

vi.mock("@/lib/repositories/emergency-fund.repo", () => ({ getEmergencyFund: async () => banco.fundo }));
vi.mock("@/lib/repositories/goal.repo", () => ({ listGoalsWithProgress: async () => banco.metas }));
vi.mock("@/lib/repositories/asset.repo", () => ({ listAssets: async () => banco.ativos }));

import { getSavingsTargets } from "../savings-targets";

const ctx = { userId: "u1", profileId: "p1" } as AuthContext;
const hoje = new Date(2026, 8, 30, 12);

beforeEach(() => {
  banco.fundo = null;
  banco.metas = [];
  banco.ativos = [];
});

describe("getSavingsTargets: bordas", () => {
  it("sem reserva e sem metas: fila vazia", async () => {
    expect(await getSavingsTargets(ctx, hoje)).toEqual([]);
  });

  it("reserva: alvo = meses × custo; o que falta nunca é negativo", async () => {
    banco.fundo = { currentAmount: "7000", targetMonths: 6, monthlyExpenseBase: "1000", monthlyContribution: "300" };
    const [r] = await getSavingsTargets(ctx, hoje);
    expect(r).toMatchObject({ id: "reserva", kind: "reserva", remaining: 0, monthlyNeeded: 300 });
  });

  it("reserva: vale o MAIOR entre o campo e o que está na carteira marcado como reserva", async () => {
    banco.fundo = { currentAmount: "1000", targetMonths: 6, monthlyExpenseBase: "1000", monthlyContribution: "300" };
    banco.ativos = [
      { objective: "RESERVA_EMERGENCIA", currentValue: "2500.50" },
      { objective: "RESERVA_EMERGENCIA", currentValue: "1499.50" },
      { objective: "LIBERDADE_FINANCEIRA", currentValue: "99999" },
    ];
    const [r] = await getSavingsTargets(ctx, hoje);
    expect(r.remaining).toBe(2000);
  });

  it("meta alcançada (ou com alvo zero) não entra na fila", async () => {
    banco.metas = [
      { id: "g1", name: "Pronta", targetAmount: "1000", computedCurrentAmount: 1000, targetDate: new Date(2027, 5, 1), annualRate: null, createdAt: new Date(2026, 0, 1) },
      { id: "g2", name: "Zero", targetAmount: "0", computedCurrentAmount: 0, targetDate: new Date(2027, 5, 1), annualRate: null, createdAt: new Date(2026, 0, 1) },
    ];
    expect(await getSavingsTargets(ctx, hoje)).toEqual([]);
  });

  it("meta aberta: o que falta e um valor por mês finito e positivo", async () => {
    banco.metas = [{ id: "g1", name: "Viagem", targetAmount: "6000", computedCurrentAmount: 1000, targetDate: new Date(2027, 8, 30), annualRate: "0", createdAt: new Date(2026, 0, 1) }];
    const [m] = await getSavingsTargets(ctx, hoje);
    expect(m.remaining).toBe(5000);
    expect(Number.isFinite(m.monthlyNeeded)).toBe(true);
    expect(m.monthlyNeeded).toBeGreaterThan(0);
  });

  it("meta sem prazo: valor por mês finito (nada de NaN ou Infinity na fila)", async () => {
    banco.metas = [{ id: "g1", name: "Sem data", targetAmount: "6000", computedCurrentAmount: 0, targetDate: null, annualRate: null, createdAt: new Date(2026, 0, 1) }];
    const [m] = await getSavingsTargets(ctx, hoje);
    expect(Number.isFinite(m.monthlyNeeded)).toBe(true);
    expect(m.remaining).toBe(6000);
  });
});
