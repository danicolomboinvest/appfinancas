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

import { getAllocationByClass } from "../portfolio";

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
