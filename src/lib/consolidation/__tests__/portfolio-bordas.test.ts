import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * Carteira por objetivo e por classe, com banco de mentira. Bordas: carteira vazia (percentual
 * sem dividir por zero), reserva com alvo zero, meta com alvo zero, centavos.
 */
type Ativo = { objective: string; goalId: string | null; currentValue: string; assetClass: string };
const banco = vi.hoisted(() => ({
  ativos: [] as Ativo[],
  reserva: null as { targetAmount: string } | null,
  metas: [] as { id: string; name: string; targetAmount: string; computedCurrentAmount: number }[],
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    asset: { findMany: async () => banco.ativos },
    emergencyFund: { findUnique: async () => banco.reserva },
  },
}));
vi.mock("@/lib/repositories/goal.repo", () => ({ listGoalsWithProgress: async () => banco.metas }));

import { getAllocationByClass, getPortfolioByObjective } from "../portfolio";

const ctx = { userId: "u1", profileId: "p1" } as AuthContext;

beforeEach(() => {
  banco.ativos = [];
  banco.reserva = null;
  banco.metas = [];
});

describe("getAllocationByClass", () => {
  it("carteira vazia: nenhuma classe e total zero", async () => {
    expect(await getAllocationByClass(ctx)).toEqual({ classes: [], totalPortfolio: 0 });
  });

  it("ativos todos zerados: percentual 0, não NaN", async () => {
    banco.ativos = [{ objective: "OUTRO", goalId: null, currentValue: "0", assetClass: "RENDA_FIXA" }];
    const r = await getAllocationByClass(ctx);
    expect(r.classes).toEqual([{ assetClass: "RENDA_FIXA", currentValue: 0, currentPercent: 0 }]);
  });

  it("percentuais somam 100% com centavos (0,10 + 0,20 não vira 0,30000000000000004)", async () => {
    banco.ativos = [
      { objective: "OUTRO", goalId: null, currentValue: "0.10", assetClass: "RENDA_FIXA" },
      { objective: "OUTRO", goalId: null, currentValue: "0.20", assetClass: "RENDA_FIXA" },
      { objective: "OUTRO", goalId: null, currentValue: "0.30", assetClass: "ACOES" },
    ];
    const r = await getAllocationByClass(ctx);
    expect(r.totalPortfolio).toBe(0.6);
    expect(r.classes.find((c) => c.assetClass === "RENDA_FIXA")!.currentValue).toBe(0.3);
    expect(r.classes.reduce((s, c) => s + c.currentPercent, 0)).toBeCloseTo(1, 12);
  });
});

describe("getPortfolioByObjective", () => {
  it("sem reserva cadastrada: alvo e percentual null; com alvo zero, percentual null (não Infinity)", async () => {
    banco.ativos = [{ objective: "RESERVA_EMERGENCIA", goalId: null, currentValue: "500", assetClass: "RENDA_FIXA" }];
    expect((await getPortfolioByObjective(ctx)).reserva).toEqual({ currentValue: 500, targetAmount: null, achievementPercent: null });
    banco.reserva = { targetAmount: "0" };
    expect((await getPortfolioByObjective(ctx)).reserva).toEqual({ currentValue: 500, targetAmount: 0, achievementPercent: null });
  });

  it("meta com alvo zero mostra 0%, não divide por zero", async () => {
    banco.metas = [{ id: "g1", name: "Sem valor", targetAmount: "0", computedCurrentAmount: 300 }];
    const [m] = (await getPortfolioByObjective(ctx)).metas;
    expect(m.achievementPercent).toBe(0);
  });

  it("ativo 'Meta' de meta apagada entra em 'outro', e os cards somam o total da carteira", async () => {
    banco.metas = [{ id: "g1", name: "Casa", targetAmount: "10000", computedCurrentAmount: 1000 }];
    banco.ativos = [
      { objective: "META", goalId: "g1", currentValue: "1000", assetClass: "RENDA_FIXA" },
      { objective: "META", goalId: "apagada", currentValue: "2000", assetClass: "RENDA_FIXA" },
      { objective: "RESERVA_EMERGENCIA", goalId: null, currentValue: "300", assetClass: "RENDA_FIXA" },
      { objective: "LIBERDADE_FINANCEIRA", goalId: null, currentValue: "700", assetClass: "ACOES" },
    ];
    const r = await getPortfolioByObjective(ctx);
    expect(r.outro.currentValue).toBe(2000);
    expect(r.totalPortfolio).toBe(4000);
    expect(r.reserva.currentValue + r.liberdade.currentValue + r.outro.currentValue + 1000).toBe(r.totalPortfolio);
    expect(r.metas[0].achievementPercent).toBeCloseTo(0.1);
  });
});
