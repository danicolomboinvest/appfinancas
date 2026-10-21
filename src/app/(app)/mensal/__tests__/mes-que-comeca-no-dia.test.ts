import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pedido de cliente (21/10/2026): quem recebe do meio ao fim do mês e paga o mês seguinte com esse
 * dinheiro fecha o mês do dia 15 ao 14. O lançamento novo cai no mês da pessoa pela data; sem a
 * escolha, tudo como sempre; cartão e "para o mês seguinte" não passam por essa regra.
 */

type Entrada = { year: number; month: number; entryDate?: Date; cartaoId?: string | null; category: string };
const criados: Entrada[] = [];
const editados: Entrada[] = [];
let diaDoMes: number | null = 15;
let gravado: { cartaoId: string | null; entryDate: Date | null } | null = null;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "pessoal", profileKind: "PESSOAL", profileTheme: "girly" })) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { monthlyEntry: { findFirst: vi.fn(async () => gravado), findMany: vi.fn(async () => []) } } }));
vi.mock("@/lib/repositories/user.repo", async (original) => ({ ...(await original<Record<string, unknown>>()), getDiaInicioMes: vi.fn(async () => diaDoMes) }));
vi.mock("@/lib/repositories/cartao.repo", () => ({ cartaoDoPerfil: vi.fn(async () => null) }));
vi.mock("@/lib/repositories/monthly-entry.repo", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createMonthlyEntry: vi.fn(async (_ctx: unknown, input: Entrada) => void criados.push(input)),
  updateOwnMonthlyEntry: vi.fn(async (_ctx: unknown, _id: string, input: Entrada) => (editados.push(input), { count: 1 })),
}));
vi.mock("@/lib/repositories/limite-cartao.repo", () => ({ situacaoDoCartao: vi.fn(async () => null) }));
vi.mock("@/lib/cartao/agendar", () => ({ agendarAvisoDoCartao: vi.fn(async () => undefined) }));
vi.mock("@/lib/money-server", () => ({ getUserCurrency: vi.fn(async () => "BRL"), serverMoney: vi.fn(async () => (n: number) => String(n)) }));
vi.mock("@/lib/repositories/transaction-rule.repo", () => ({ linhasAntesDaCorrecao: vi.fn(async () => []), aprenderComCorrecao: vi.fn(async () => undefined), upsertTransactionRule: vi.fn(async () => undefined) }));
vi.mock("@/lib/erros/registrar-falha", () => ({ registrarFalhaDaAcao: vi.fn(async () => undefined) }));

const { createMonthlyEntryAction, updateMonthlyEntryAction } = await import("../[year]/[month]/actions");

function formulario(extra: Record<string, string> = {}) {
  const f = new FormData();
  const campos: Record<string, string> = { year: "2026", month: "10", category: "EXPENSE", amount: "89.90", parentCategory: "LAZER", subcategory: "", description: "", entryDate: "2026-11-03", ...extra };
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

beforeEach(() => {
  criados.length = 0;
  editados.length = 0;
  diaDoMes = 15;
  gravado = null;
});

describe("mês que começa no dia da pessoa (lançar à mão)", () => {
  it("dia 15: o gasto de 3/11 é de outubro e o de 20/11 é de novembro", async () => {
    await createMonthlyEntryAction({}, formulario({ entryDate: "2026-11-03" }));
    await createMonthlyEntryAction({}, formulario({ entryDate: "2026-11-20" }));
    expect(criados[0]).toMatchObject({ year: 2026, month: 10 });
    expect(criados[1]).toMatchObject({ year: 2026, month: 11 });
  });

  it("a entrada de 18/10 é de outubro; a de 10/10, de setembro", async () => {
    await createMonthlyEntryAction({}, formulario({ category: "INCOME", entryDate: "2026-10-18" }));
    await createMonthlyEntryAction({}, formulario({ category: "INCOME", entryDate: "2026-10-10" }));
    expect(criados[0]).toMatchObject({ year: 2026, month: 10 });
    expect(criados[1]).toMatchObject({ year: 2026, month: 9 });
  });

  it("sem a escolha, o mês é o da data, como sempre", async () => {
    diaDoMes = null;
    await createMonthlyEntryAction({}, formulario({ entryDate: "2026-11-03" }));
    expect(criados[0]).toMatchObject({ year: 2026, month: 11 });
  });

  it("'para o mês seguinte' continua sendo escolha dela", async () => {
    await createMonthlyEntryAction({}, formulario({ category: "INCOME", entryDate: "2026-10-18", paraMesSeguinte: "on" }));
    expect(criados[0]).toMatchObject({ year: 2026, month: 11 });
  });
});

describe("mês que começa no dia da pessoa (editar)", () => {
  it("mudar a data muda o mês; editar outra coisa deixa o mês que estava", async () => {
    gravado = { cartaoId: null, entryDate: new Date("2026-10-20T00:00:00Z") };
    await updateMonthlyEntryAction({}, formulario({ entryId: "e1", entryDate: "2026-10-10" }));
    expect(editados[0]).toMatchObject({ year: 2026, month: 9 });
    await updateMonthlyEntryAction({}, formulario({ entryId: "e1", entryDate: "2026-10-20" }));
    expect(editados[1]).toMatchObject({ year: 2026, month: 10 });
  });

  it("gasto de cartão não passa por essa regra", async () => {
    gravado = { cartaoId: "c1", entryDate: new Date("2026-10-20T00:00:00Z") };
    await updateMonthlyEntryAction({}, formulario({ entryId: "e1", entryDate: "2026-10-10" }));
    expect(editados[0]).toMatchObject({ year: 2026, month: 10 });
  });
});
