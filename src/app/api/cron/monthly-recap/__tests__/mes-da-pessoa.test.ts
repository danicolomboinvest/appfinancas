import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O resumo do mês sai no dia seguinte ao fim do mês DA PESSOA (30/10/2026). Quem não escolheu dia
 * recebe nos dias 1 a 3, como sempre; quem tem o mês começando dia 15 recebe de 15 a 17/11 o resumo
 * de outubro (15/10 a 14/11). A trava recapEmailSentMonth usa a chave do mês dela ("2026-10").
 */

const banco = vi.hoisted(() => ({
  hoje: new Date(2026, 10, 1, 12),
  usuarios: [] as Record<string, unknown>[],
  mesesPedidos: [] as { year: number; month: number; createdAt: { gte: Date } }[],
}));

vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => banco.hoje, brazilTodayUtc: () => new Date(Date.UTC(banco.hoje.getFullYear(), banco.hoje.getMonth(), banco.hoje.getDate())) }));
vi.mock("@/lib/auth/auth.config", () => ({ auth: async () => null }));
vi.mock("@/lib/repositories/casal-login.repo", () => ({ perfilDoPar: async () => null }));
vi.mock("@/lib/repositories/profile.repo", () => ({
  getOrCreateActiveProfile: async (userId: string) => ({ id: `p-${userId}`, name: "Pessoal", theme: "padrao", kind: "PESSOAL", categorias: null }),
}));
vi.mock("@/lib/repositories/casa.repo", () => ({ casaDoUsuario: async () => null }));
vi.mock("@/lib/repositories/allowedEmail.repo", () => ({
  contasQueUsamOApp: async (us: { email: string }[]) => new Set(us.map((u) => u.email)),
  normalizeEmail: (e: string) => e,
}));
vi.mock("@/lib/email/send", () => ({ abrirEnvioEmLote: () => ({ enviar: async () => ({ ok: true }), fechar: () => {} }) }));
vi.mock("@/lib/email/templates", () => ({ monthlyRecapEmail: () => ({ subject: "", html: "" }), monthlyNudgeEmail: () => ({ subject: "", html: "" }) }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findMany: async ({ where }: { where: { email?: string } }) => banco.usuarios.filter((u) => !where.email || u.email === where.email),
      update: async () => ({}),
    },
    monthlyEntry: {
      groupBy: async ({ where }: { where: { OR: { year: number; month: number; createdAt: { gte: Date } }[] } }) => {
        banco.mesesPedidos.push(...where.OR);
        return [];
      },
    },
  },
}));

import { GET } from "../route";

const usuario = (id: string, diaInicioMes: number | null, recapEmailSentMonth: string | null = null) => ({
  id,
  email: `${id}@exemplo.com`,
  name: id,
  role: "CLIENT",
  currency: "BRL",
  createdAt: new Date(2026, 0, 1),
  recapNudgeCount: 0,
  recapEmailSentMonth,
  diaInicioMes,
  _count: { financialProfiles: 1 },
});

async function rodar(hoje: Date) {
  banco.hoje = hoje;
  banco.mesesPedidos = [];
  const res = await GET(new Request("https://app.test/api/cron/monthly-recap", { headers: { authorization: "Bearer segredo" } }));
  expect(res.status).toBe(200);
  return (await res.json()) as { skipped?: boolean; candidates?: number; convites?: number };
}

beforeEach(() => {
  process.env.CRON_SECRET = "segredo";
  banco.usuarios = [usuario("um", null), usuario("quinze", 15)];
});

describe("cron do resumo mensal: o mês fechado de cada pessoa", () => {
  it("em 01/11 só quem não escolheu dia está na virada: fecha outubro do calendário", async () => {
    const r = await rodar(new Date(2026, 10, 1, 12));
    expect(r.candidates).toBe(1);
    expect(r.convites).toBe(1);
    expect(banco.mesesPedidos).toEqual([{ year: 2026, month: 10, createdAt: { gte: new Date("2026-10-01T03:00:00.000Z") } }]);
  });

  it("em 15/11 só quem tem o dia 15 está na virada: fecha outubro dela, de 15/10 a 14/11", async () => {
    const r = await rodar(new Date(2026, 10, 15, 12));
    expect(r.candidates).toBe(1);
    expect(r.convites).toBe(1);
    expect(banco.mesesPedidos).toEqual([{ year: 2026, month: 10, createdAt: { gte: new Date("2026-10-15T03:00:00.000Z") } }]);
  });

  it("em 02/11 e em 17/11 ainda é virada (dias 1 a 3); em 05/11 e em 18/11 ninguém recebe", async () => {
    expect((await rodar(new Date(2026, 10, 2, 12))).candidates).toBe(1);
    expect((await rodar(new Date(2026, 10, 17, 12))).candidates).toBe(1);
    expect((await rodar(new Date(2026, 10, 5, 12))).skipped).toBe(true);
    expect((await rodar(new Date(2026, 10, 18, 12))).skipped).toBe(true);
  });

  it("a trava do mês usa a chave do mês da pessoa: quem já recebeu 2026-10 não recebe de novo", async () => {
    banco.usuarios = [usuario("quinze", 15, "2026-10")];
    expect((await rodar(new Date(2026, 10, 15, 12))).skipped).toBe(true);
    banco.usuarios = [usuario("quinze", 15, "2026-09")];
    expect((await rodar(new Date(2026, 10, 15, 12))).candidates).toBe(1);
  });
});
