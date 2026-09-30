import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * "Quanto custa um mês da sua vida" e "renda típica", com banco de mentira e "hoje" fixo.
 * Bordas: janeiro (os 3 meses fechados são do ano anterior), mês sem dados, mês em que o
 * "não é gasto" come o gasto inteiro, mês só com cópias automáticas, mediana par e ímpar.
 */
type Soma = { year: number; month: number; _sum: { amount: number | null } };
type Args = { where: Record<string, unknown> & { category: string; AND?: unknown[]; OR?: { year: number; month: number }[] }; _count?: unknown };

const banco = vi.hoisted(() => ({
  hoje: new Date(2027, 0, 15, 12),
  gasto: [] as Soma[],
  naoGasto: [] as Soma[],
  reais: [] as { year: number; month: number }[],
  renda: [] as Soma[],
  naoRenda: [] as Soma[],
  chamadas: [] as Args[],
}));

vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => banco.hoje }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    monthlyEntry: {
      groupBy: async (args: Args) => {
        banco.chamadas.push(args);
        if (args._count) return banco.reais.map((r) => ({ ...r, _count: { _all: 1 } }));
        if (args.where.category === "INCOME") return args.where.AND ? banco.naoRenda : banco.renda;
        return args.where.AND ? banco.naoGasto : banco.gasto;
      },
    },
  },
}));

import { getRendaTipica, getTypicalMonthlyExpense } from "../typical-expense";

const ctx = { userId: "u1", profileId: "p1", profileKind: "PESSOAL" } as unknown as AuthContext;
const s = (year: number, month: number, amount: number | null): Soma => ({ year, month, _sum: { amount } });

beforeEach(() => {
  banco.hoje = new Date(2027, 0, 15, 12);
  banco.gasto = [];
  banco.naoGasto = [];
  banco.reais = [];
  banco.renda = [];
  banco.naoRenda = [];
  banco.chamadas = [];
});

describe("getTypicalMonthlyExpense", () => {
  it("em janeiro, os 3 meses fechados são outubro, novembro e dezembro do ano ANTERIOR", async () => {
    await getTypicalMonthlyExpense(ctx);
    expect(banco.chamadas[0].where.OR).toEqual([
      { year: 2026, month: 12 },
      { year: 2026, month: 11 },
      { year: 2026, month: 10 },
    ]);
  });

  it("sem nenhum gasto nos meses fechados: null (não sugere reserva de R$ 0)", async () => {
    expect(await getTypicalMonthlyExpense(ctx)).toBeNull();
  });

  it("média só dos meses com gasto de verdade", async () => {
    banco.gasto = [s(2026, 12, 3000), s(2026, 11, 2000)];
    banco.reais = [{ year: 2026, month: 12 }, { year: 2026, month: 11 }];
    expect(await getTypicalMonthlyExpense(ctx)).toEqual({ monthlyAverage: 2500, monthsUsed: 2 });
  });

  it("aplicação e fatura saem do gasto; mês em que isso come tudo não entra na média (sem dividir por mês vazio)", async () => {
    banco.gasto = [s(2026, 12, 5000), s(2026, 11, 1500)];
    banco.naoGasto = [s(2026, 12, 2000), s(2026, 11, 1500)];
    banco.reais = [{ year: 2026, month: 12 }, { year: 2026, month: 11 }];
    expect(await getTypicalMonthlyExpense(ctx)).toEqual({ monthlyAverage: 3000, monthsUsed: 1 });
  });

  it("mês que só tem as cópias automáticas da despesa fixa não puxa a média pra baixo", async () => {
    banco.gasto = [s(2026, 12, 4000), s(2026, 11, 800)];
    banco.reais = [{ year: 2026, month: 12 }];
    expect(await getTypicalMonthlyExpense(ctx)).toEqual({ monthlyAverage: 4000, monthsUsed: 1 });
  });

  it("soma nula do banco conta como zero e o mês fica de fora", async () => {
    banco.gasto = [s(2026, 12, null)];
    banco.reais = [{ year: 2026, month: 12 }];
    expect(await getTypicalMonthlyExpense(ctx)).toBeNull();
  });

  it("o 'mês de verdade' começa à meia-noite de Brasília (03h UTC) do dia 1", async () => {
    await getTypicalMonthlyExpense(ctx);
    const reais = banco.chamadas.find((c) => c._count)!;
    const dez = (reais.where.OR as unknown as { year: number; month: number; createdAt: { gte: Date } }[])[0];
    expect(dez.createdAt.gte.toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });
});

describe("getRendaTipica", () => {
  it("sem renda nos meses fechados: null", async () => {
    expect(await getRendaTipica(ctx)).toBeNull();
  });

  it("mediana de 3 meses ignora o mês do 13º", async () => {
    banco.renda = [s(2026, 12, 9000), s(2026, 11, 4000), s(2026, 10, 4200)];
    expect(await getRendaTipica(ctx)).toEqual({ valor: 4200, meses: 3 });
  });

  it("mediana de 2 meses é a média dos dois", async () => {
    banco.renda = [s(2026, 12, 4000), s(2026, 11, 5000)];
    expect(await getRendaTipica(ctx)).toEqual({ valor: 4500, meses: 2 });
  });

  it("resgate de aplicação não é renda: mês que só teve resgate some da conta", async () => {
    banco.renda = [s(2026, 12, 4000), s(2026, 11, 10000)];
    banco.naoRenda = [s(2026, 11, 10000)];
    expect(await getRendaTipica(ctx)).toEqual({ valor: 4000, meses: 1 });
  });
});
