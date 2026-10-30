import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O aviso de meta no mês da pessoa (30/10/2026). Em 05/11, para quem tem o mês começando dia 15 a
 * chave do "ficou para trás" é de outubro (15/10 a 14/11) e as metas são lidas com o dia dela; para
 * quem não escolheu dia, novembro, como sempre.
 */

const banco = vi.hoisted(() => ({
  entradasDasMetas: [] as { year: number; month: number }[],
  diasPedidos: [] as (number | null | undefined)[],
}));

vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => new Date(2026, 10, 5, 12), brazilTodayUtc: () => new Date(Date.UTC(2026, 10, 5)) }));
vi.mock("@/lib/auth/auth.config", () => ({ auth: async () => null }));
vi.mock("@/lib/repositories/casal-login.repo", () => ({ perfilDoPar: async () => null }));
vi.mock("@/lib/repositories/profile.repo", () => ({
  getOrCreateActiveProfile: async (userId: string) => ({ id: `p-${userId}`, theme: "padrao", kind: "PESSOAL", categorias: null }),
}));
vi.mock("@/lib/repositories/casa.repo", () => ({ casaDoUsuario: async () => null }));
vi.mock("@/lib/repositories/allowedEmail.repo", () => ({
  contasQueUsamOApp: async (us: { email: string }[]) => new Set(us.map((u) => u.email)),
  normalizeEmail: (e: string) => e,
}));
vi.mock("@/lib/repositories/goal.repo", () => ({
  listGoalsWithProgress: async (_ctx: unknown, dia?: number | null) => {
    banco.diasPedidos.push(dia);
    return [];
  },
}));
vi.mock("@/lib/avisos/respostas", () => ({ carregarRespostasDoMes: async () => ({}), alertaResolvido: () => false }));
vi.mock("@/lib/push/send", () => ({ isPushConfigured: () => false, sendPushToUser: async () => 0 }));
vi.mock("@/lib/email/send", () => ({ isEmailConfigured: () => false, sendEmail: async () => ({ ok: false }) }));
vi.mock("@/lib/email/templates", () => ({ alertEmail: () => ({}), metaAtingidaEmail: () => ({}) }));
vi.mock("@/lib/cancelar/avisos", () => ({ enviarAvisosAntesDeCancelar: async () => 0, lembrarEstenderNaHubla: async () => 0 }));
vi.mock("@/lib/assinatura/cancelamento", () => ({ desligarCanceladosVencidos: async () => 0 }));
vi.mock("@/lib/insights/alerts", async (original) => {
  const real = await original<typeof import("@/lib/insights/alerts")>();
  return {
    ...real,
    buildGoalAlerts: (input: Parameters<typeof real.buildGoalAlerts>[0]) => {
      banco.entradasDasMetas.push({ year: input.year, month: input.month });
      return real.buildGoalAlerts(input);
    },
  };
});
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findMany: async ({ where }: { where: { email?: string } }) =>
        [
          { id: "u-quinze", email: "quinze@exemplo.com", name: "Quinze", role: "CLIENT", currency: "BRL", notifyBudgetAlerts: false, notifyLateGoals: true, createdAt: new Date(2026, 0, 1), diaInicioMes: 15 },
          { id: "u-um", email: "um@exemplo.com", name: "Um", role: "CLIENT", currency: "BRL", notifyBudgetAlerts: false, notifyLateGoals: true, createdAt: new Date(2026, 0, 1), diaInicioMes: null },
        ].filter((u) => !where.email || u.email === where.email),
    },
    notificationLog: { findMany: async () => [], createMany: async () => ({}) },
  },
}));

import { GET } from "../route";

async function rodar(email: string) {
  banco.entradasDasMetas = [];
  banco.diasPedidos = [];
  const res = await GET(new Request(`https://app.test/api/cron/alerts?dryRun=1&onlyEmail=${email}`, { headers: { authorization: "Bearer segredo" } }));
  expect(res.status).toBe(200);
}

beforeEach(() => {
  process.env.CRON_SECRET = "segredo";
});

describe("cron de avisos: as metas no mês da pessoa", () => {
  it("sem dia escolhido, em 05/11 o aviso de meta é de novembro (como sempre)", async () => {
    await rodar("um@exemplo.com");
    expect(banco.entradasDasMetas).toEqual([{ year: 2026, month: 11 }]);
    expect(banco.diasPedidos).toEqual([null]);
  });

  it("dia 15, em 05/11 o aviso de meta é de outubro (15/10 a 14/11) e as metas são lidas com o dia dela", async () => {
    await rodar("quinze@exemplo.com");
    expect(banco.entradasDasMetas).toEqual([{ year: 2026, month: 10 }]);
    expect(banco.diasPedidos).toEqual([15]);
  });
});
