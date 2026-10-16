import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * "Quanto custa um mês da sua vida", com banco de mentira e "hoje" fixo. (A renda saiu daqui:
 * virou a média de 12 meses de `renda-media.ts`, com testes próprios.)
 * Bordas: janeiro (os 3 meses fechados são do ano anterior), mês sem dados, mês em que o
 * "não é gasto" come o gasto inteiro, mês só com cópias automáticas.
 */
type Soma = { year: number; month: number; _sum: { amount: number | null } };
type Linha = { year: number; month: number; amount: number; description: string | null; subcategory: string | null };
type Args = { where: Record<string, unknown> & { category: string; AND?: unknown[]; OR?: { year: number; month: number }[] }; _count?: unknown };

const banco = vi.hoisted(() => ({
  hoje: new Date(2027, 0, 15, 12),
  gasto: [] as Soma[],
  candidatos: [] as Linha[],
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
        return banco.gasto;
      },
      findMany: async (args: Args) => {
        banco.chamadas.push(args);
        return banco.candidatos;
      },
    },
  },
}));

import { getTypicalMonthlyExpense } from "../typical-expense";

const ctx = { userId: "u1", profileId: "p1", profileKind: "PESSOAL" } as unknown as AuthContext;
const s = (year: number, month: number, amount: number | null): Soma => ({ year, month, _sum: { amount } });
const l = (year: number, month: number, amount: number, description: string | null, subcategory: string | null = null): Linha =>
  ({ year, month, amount, description, subcategory });

beforeEach(() => {
  banco.hoje = new Date(2027, 0, 15, 12);
  banco.gasto = [];
  banco.candidatos = [];
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
    banco.candidatos = [l(2026, 12, 1500, "Pagamento de fatura"), l(2026, 12, 500, "Aplicação RDB"), l(2026, 11, 1500, "Fatura Nubank")];
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

  // 16/10/2026: o "contém" do SQL só busca; quem decide é ehNaoGasto. Antes "Pagamento cartão de
  // crédito" ficava no gasto (a fatura somava com as compras dela) e a conta do celular saía.
  it("o SQL traz candidatos e ehNaoGasto decide: a fatura sai, a conta do celular e a loja ficam", async () => {
    banco.gasto = [s(2026, 12, 5000)];
    banco.reais = [{ year: 2026, month: 12 }];
    banco.candidatos = [
      l(2026, 12, 1800, "Pagamento cartão de crédito"),
      l(2026, 12, 120, "Pagamento de fatura CLARO"),
      l(2026, 12, 90, "Caixinha de som JBL"),
      l(2026, 12, 300, "Transferência", "Investimento"),
    ];
    expect(await getTypicalMonthlyExpense(ctx)).toEqual({ monthlyAverage: 2900, monthsUsed: 1 });
  });

  it("a busca dos candidatos não usa NOT (lançamento sem descrição continua no gasto)", async () => {
    await getTypicalMonthlyExpense(ctx);
    const busca = banco.chamadas.find((c) => c.where.AND)!;
    expect(JSON.stringify(busca.where)).not.toMatch(/"NOT"/);
  });
});
