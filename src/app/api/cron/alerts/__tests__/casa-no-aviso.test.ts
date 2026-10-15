import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CasaNaSessao } from "@/lib/casa/regras";

/**
 * O aviso do dia (cron de alertas) com os números das telas (15/10/2026).
 *
 * Antes o cron lia só { userId, profileId } de quem recebe: o plano DELA e os gastos DELA. No
 * casal, o plano que vale é o da casa (o da titular) e os gastos são os dos dois. A Ana (titular)
 * planejou Alimentação em R$ 1.000; ela gastou R$ 500 e o Caio (par) R$ 600. O Orçamento dos dois
 * diz "Alimentação passou do plano" e livre de −R$ 100. O cron não dizia nada a nenhum dos dois:
 * para a Ana, R$ 500 de R$ 1.000; para o Caio, nenhum plano.
 *
 * Aqui o cron roda de verdade (contexto, budget.repo, livre-do-mes.repo e as regras da casa) num
 * banco de mentira, e o que ele passa ao aviso é comparado com o que a tela lê.
 */

const banco = vi.hoisted(() => ({
  lancamentos: [] as Record<string, unknown>[],
  planos: [] as Record<string, unknown>[],
  entradasDoAviso: [] as { planned: unknown; spent: unknown; livre: unknown }[],
  ctxDasRespostas: [] as unknown[],
}));

const ANA = { userId: "u-ana", profileId: "p-ana" };
const CAIO = { userId: "u-caio", profileId: "p-caio" };
const CASA_DA_ANA: CasaNaSessao = {
  membroId: "m1",
  casalProfileId: "casal-ana",
  eu: { ...ANA, letra: "A", nome: "Ana", papel: "titular" },
  outro: { ...CAIO, letra: "B", nome: "Caio", papel: "par" },
};
const CASA_DO_CAIO: CasaNaSessao = { ...CASA_DA_ANA, eu: CASA_DA_ANA.outro, outro: CASA_DA_ANA.eu };

vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => new Date(2026, 9, 20, 12), brazilTodayUtc: () => new Date(Date.UTC(2026, 9, 20)) }));
vi.mock("@/lib/auth/auth.config", () => ({ auth: async () => null }));
vi.mock("@/lib/repositories/casal-login.repo", () => ({ perfilDoPar: async () => null }));
vi.mock("@/lib/repositories/profile.repo", () => ({
  getOrCreateActiveProfile: async (userId: string) => ({ id: userId === "u-ana" ? "p-ana" : "p-caio", theme: "padrao", kind: "PESSOAL", categorias: null }),
}));
vi.mock("@/lib/repositories/casa.repo", () => ({ casaDoUsuario: async (userId: string) => (userId === "u-ana" ? CASA_DA_ANA : CASA_DO_CAIO) }));
vi.mock("@/lib/repositories/monthly-plan.repo", () => ({ getMonthlyPlan: async () => null }));
vi.mock("@/lib/repositories/allowedEmail.repo", () => ({
  contasQueUsamOApp: async (us: { email: string }[]) => new Set(us.map((u) => u.email)),
  normalizeEmail: (e: string) => e,
}));
vi.mock("@/lib/repositories/goal.repo", () => ({ listGoalsWithProgress: async () => [] }));
vi.mock("@/lib/avisos/respostas", () => ({
  carregarRespostasDoMes: async (ctx: unknown) => {
    banco.ctxDasRespostas.push(ctx);
    return {};
  },
  alertaResolvido: () => false,
}));
vi.mock("@/lib/push/send", () => ({ isPushConfigured: () => false, sendPushToUser: async () => 0 }));
vi.mock("@/lib/email/send", () => ({ isEmailConfigured: () => false, sendEmail: async () => ({ ok: false }) }));
vi.mock("@/lib/email/templates", () => ({ alertEmail: () => ({}), metaAtingidaEmail: () => ({}) }));
vi.mock("@/lib/cancelar/avisos", () => ({ enviarAvisosAntesDeCancelar: async () => 0, lembrarEstenderNaHubla: async () => 0 }));
vi.mock("@/lib/assinatura/cancelamento", () => ({ desligarCanceladosVencidos: async () => 0 }));
vi.mock("@/lib/insights/alerts", async (original) => {
  const real = await original<typeof import("@/lib/insights/alerts")>();
  return {
    ...real,
    buildBudgetAlerts: (input: Parameters<typeof real.buildBudgetAlerts>[0]) => {
      banco.entradasDoAviso.push({ planned: input.planned, spent: input.spent, livre: input.livre });
      return real.buildBudgetAlerts(input);
    },
  };
});
vi.mock("@/lib/db/prisma", async () => {
  const { bate } = await import("@/lib/casa/__tests__/avaliador");
  const filtra = (linhas: Record<string, unknown>[], where: Record<string, unknown> = {}) => linhas.filter((l) => bate(l, where));
  const soma = (linhas: Record<string, unknown>[], campo: string) => linhas.reduce((t, l) => t + (l[campo] as number), 0);
  return {
    prisma: {
      user: {
        findMany: async ({ where }: { where: { email?: string } }) =>
          [
            { id: "u-ana", email: "ana@exemplo.com", name: "Ana", role: "CLIENT", currency: "BRL", notifyBudgetAlerts: true, notifyLateGoals: false, createdAt: new Date(2026, 0, 1) },
            { id: "u-caio", email: "caio@exemplo.com", name: "Caio", role: "CLIENT", currency: "BRL", notifyBudgetAlerts: true, notifyLateGoals: false, createdAt: new Date(2026, 0, 1) },
          ].filter((u) => !where.email || u.email === where.email),
      },
      notificationLog: { findMany: async () => [], createMany: async () => ({}) },
      budget: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => filtra(banco.planos, where),
        aggregate: async ({ where }: { where: Record<string, unknown> }) => ({ _sum: { plannedAmount: soma(filtra(banco.planos, where), "plannedAmount") } }),
      },
      monthlyEntry: {
        aggregate: async ({ where }: { where: Record<string, unknown> }) => ({ _sum: { amount: soma(filtra(banco.lancamentos, where), "amount") } }),
        groupBy: async ({ by, where }: { by: string[]; where: Record<string, unknown> }) => {
          const grupos = new Map<string, Record<string, unknown> & { _sum: { amount: number } }>();
          for (const l of filtra(banco.lancamentos, where)) {
            const chave = by.map((k) => String(l[k])).join("|");
            const g = grupos.get(chave) ?? { ...Object.fromEntries(by.map((k) => [k, l[k]])), _sum: { amount: 0 } };
            g._sum.amount += l.amount as number;
            grupos.set(chave, g);
          }
          return [...grupos.values()];
        },
      },
      customCategory: { findMany: async () => [] },
    },
  };
});

import { GET } from "../route";
import { carregarLivreDoMes } from "@/lib/repositories/livre-do-mes.repo";
import { sumExpensesByParentCategory } from "@/lib/repositories/budget.repo";
import { contextoDoPerfil } from "@/lib/auth/session";

const lancamento = (dono: { userId: string; profileId: string }, amount: number, extra: Record<string, unknown> = {}) => ({
  ...dono,
  year: 2026,
  month: 10,
  category: "EXPENSE",
  parentCategory: "ALIMENTACAO",
  customCategoryId: null,
  amount,
  soMeu: false,
  importBatchId: null,
  importBatch: null,
  createdAt: new Date(Date.UTC(2026, 9, 10, 15)),
  ...extra,
});

async function rodar(email: string) {
  banco.entradasDoAviso = [];
  const res = await GET(new Request(`https://app.test/api/cron/alerts?dryRun=1&onlyEmail=${email}`, { headers: { authorization: "Bearer segredo" } }));
  return (await res.json()) as { preview: { email: string; alerts: string[] }[] };
}

beforeEach(() => {
  process.env.CRON_SECRET = "segredo";
  banco.ctxDasRespostas = [];
  banco.planos = [{ ...ANA, year: 2026, month: 10, parentCategory: "ALIMENTACAO", customCategoryId: null, plannedAmount: 1000 }];
  banco.lancamentos = [
    lancamento(ANA, 500),
    lancamento(CAIO, 600),
    // O "Só meu" do Caio nunca entra nos números da Ana.
    lancamento(CAIO, 200, { soMeu: true }),
  ];
});

describe("cron de alertas: o mesmo plano e os mesmos gastos do Orçamento", () => {
  it("titular: plano da casa, gastos dos dois, livre da fonte única", async () => {
    const r = await rodar("ana@exemplo.com");
    const ctx = await contextoDoPerfil({ id: "u-ana", role: "CLIENT" }, { id: "p-ana", theme: "padrao", kind: "PESSOAL" });
    const [entrada] = banco.entradasDoAviso;
    expect(entrada.planned).toEqual([{ parentCategory: "ALIMENTACAO", planned: 1000 }]);
    expect(entrada.spent).toEqual(await sumExpensesByParentCategory(ctx, 2026, 10));
    expect(entrada.spent).toEqual([{ parentCategory: "ALIMENTACAO", spent: 1100 }]);
    const livre = await carregarLivreDoMes(ctx, { ano: 2026, mes: 10 });
    expect(livre).toMatchObject({ tipo: "plano", valor: -100 });
    expect(entrada.livre).toBe(-100);
    expect(r.preview[0].alerts.some((t) => t.includes("Alimentação"))).toBe(true);
  });

  it("par: o plano que vale é o da casa (antes não havia plano nenhum e não saía aviso)", async () => {
    const r = await rodar("caio@exemplo.com");
    const ctx = await contextoDoPerfil({ id: "u-caio", role: "CLIENT" }, { id: "p-caio", theme: "padrao", kind: "PESSOAL" });
    const [entrada] = banco.entradasDoAviso;
    expect(entrada.planned).toEqual([{ parentCategory: "ALIMENTACAO", planned: 1000 }]);
    // Para ele, o "Só meu" dele conta (é dinheiro dele), como no Orçamento dele.
    expect(entrada.spent).toEqual(await sumExpensesByParentCategory(ctx, 2026, 10));
    expect(entrada.spent).toEqual([{ parentCategory: "ALIMENTACAO", spent: 1300 }]);
    expect(await carregarLivreDoMes(ctx, { ano: 2026, mes: 10 })).toMatchObject({ tipo: "plano", valor: -300 });
    expect(entrada.livre).toBe(-300);
    expect(r.preview[0].alerts.some((t) => t.includes("Alimentação"))).toBe(true);
    // Antes: { userId, profileId } do Caio não acha plano nenhum.
    expect(banco.planos.filter((p) => p.userId === "u-caio")).toEqual([]);
  });

  it("as respostas aos avisos são lidas com o contexto da casa (como nas telas)", async () => {
    await rodar("caio@exemplo.com");
    expect(banco.ctxDasRespostas[0]).toMatchObject({ userId: "u-caio", profileId: "p-caio", casa: CASA_DO_CAIO });
  });
});
