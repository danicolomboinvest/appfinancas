import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Decisão da Dani (15/10/2026): o gasto lançado à mão num cartão cadastrado conta no mês da fatura
 * (o do vencimento), como a fatura importada. A data da compra fica no entryDate. Na edição, só
 * mudar a data ou o cartão muda o mês; editar outra coisa deixa o mês que estava gravado.
 */

type Entrada = { year: number; month: number; entryDate?: Date; cartaoId?: string | null; noCartao?: boolean | null; category: string };
const criados: Entrada[] = [];
const recorrentes: { input: Entrada; mesQueConta?: (d: Date) => { year: number; month: number } | null }[] = [];
const editados: Entrada[] = [];
let gravado: { cartaoId: string | null; entryDate: Date | null; year: number; month: number; category: string } | null = null;

const NUBANK = { id: "c1", banco: "nubank", apelido: null, diaFechamento: 15, diaVencimento: 22, final: null };

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "pessoal", profileKind: "PESSOAL", profileTheme: "girly" })) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { monthlyEntry: { findFirst: vi.fn(async () => gravado), findMany: vi.fn(async () => []) } } }));
vi.mock("@/lib/repositories/cartao.repo", () => ({ cartaoDoPerfil: vi.fn(async (_ctx: unknown, id: string) => (id === "c1" ? NUBANK : null)) }));
vi.mock("@/lib/repositories/monthly-entry.repo", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createMonthlyEntry: vi.fn(async (_ctx: unknown, input: Entrada) => void criados.push(input)),
  createRecurringMonthlyEntries: vi.fn(async (_ctx: unknown, input: Entrada, mesQueConta?: (d: Date) => { year: number; month: number } | null) => void recorrentes.push({ input, mesQueConta })),
  updateOwnMonthlyEntry: vi.fn(async (_ctx: unknown, _id: string, input: Entrada) => (editados.push(input), { count: 1 })),
}));
vi.mock("@/lib/repositories/limite-cartao.repo", () => ({ situacaoDoCartao: vi.fn(async () => null) }));
vi.mock("@/lib/cartao/agendar", () => ({ agendarAvisoDoCartao: vi.fn(async () => undefined) }));
vi.mock("@/lib/money-server", () => ({ getUserCurrency: vi.fn(async () => "BRL"), serverMoney: vi.fn(async () => (n: number) => String(n)) }));
vi.mock("@/lib/repositories/transaction-rule.repo", () => ({ linhasAntesDaCorrecao: vi.fn(async () => []), aprenderComCorrecao: vi.fn(async () => undefined), upsertTransactionRule: vi.fn(async () => undefined) }));
vi.mock("@/lib/erros/registrar-falha", () => ({ registrarFalhaDaAcao: vi.fn(async () => undefined) }));

const { createMonthlyEntryAction, updateMonthlyEntryAction } = await import("../[year]/[month]/actions");
const { mesDoGastoNoCartao } = await import("@/lib/cartao/fatura");

function formulario(extra: Record<string, string> = {}) {
  const f = new FormData();
  const campos: Record<string, string> = { year: "2026", month: "10", category: "EXPENSE", amount: "89.90", parentCategory: "LAZER", subcategory: "", description: "", entryDate: "2026-10-15", ...extra };
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}
const dia = (d: Date | undefined | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null);

beforeEach(() => {
  criados.length = 0;
  recorrentes.length = 0;
  editados.length = 0;
  gravado = null;
});

describe("mesDoGastoNoCartao", () => {
  const c = { diaFechamento: 15, diaVencimento: 22 };
  it("no dia do fechamento: o mês seguinte; na véspera: o mesmo mês", () => {
    expect(mesDoGastoNoCartao("2026-10-15", c)).toEqual({ year: 2026, month: 11 });
    expect(mesDoGastoNoCartao("2026-10-14", c)).toEqual({ year: 2026, month: 10 });
  });
  it("vencimento menor que o fechamento: dois meses depois da compra feita no fechamento", () => {
    expect(mesDoGastoNoCartao("2026-10-28", { diaFechamento: 28, diaVencimento: 5 })).toEqual({ year: 2026, month: 12 });
  });
  it("dezembro vira janeiro do ano seguinte; data do formulário (meio-dia local) também vale", () => {
    expect(mesDoGastoNoCartao(new Date("2026-12-20T12:00:00"), c)).toEqual({ year: 2027, month: 1 });
  });
  it("sem os dias do cartão ou sem data: null", () => {
    expect(mesDoGastoNoCartao("2026-10-15", { diaFechamento: null, diaVencimento: 22 })).toBeNull();
    expect(mesDoGastoNoCartao(null, c)).toBeNull();
  });
});

describe("lançar no cartão cadastrado", () => {
  it("a compra do dia do fechamento conta em novembro e guarda o dia 15/10", async () => {
    const r = await createMonthlyEntryAction({}, formulario({ cartaoId: "c1" }));
    expect(r.error).toBeUndefined();
    expect(criados).toHaveLength(1);
    expect(criados[0]).toMatchObject({ year: 2026, month: 11, cartaoId: "c1", noCartao: true });
    expect(dia(criados[0].entryDate)).toBe("2026-10-15");
  });

  it("sem cartão (ou cartão de outra pessoa) fica no mês da compra, como sempre", async () => {
    await createMonthlyEntryAction({}, formulario());
    await createMonthlyEntryAction({}, formulario({ cartaoId: "de-outra" }));
    expect(criados.map((e) => [e.year, e.month, e.cartaoId])).toEqual([
      [2026, 10, undefined],
      [2026, 10, undefined],
    ]);
  });

  it("despesa fixa no cartão: a série começa no mês da compra e cada cópia conta no da fatura dela", async () => {
    await createMonthlyEntryAction({}, formulario({ cartaoId: "c1", repeatMonthly: "on" }));
    expect(recorrentes).toHaveLength(1);
    expect(recorrentes[0].input).toMatchObject({ year: 2026, month: 10, cartaoId: "c1" });
    expect(recorrentes[0].mesQueConta?.(new Date("2026-11-15T12:00:00"))).toEqual({ year: 2026, month: 12 });
  });
});

describe("editar o gasto no cartão", () => {
  it("mudou a data: o mês acompanha a fatura", async () => {
    gravado = { cartaoId: "c1", entryDate: new Date("2026-10-15T00:00:00Z"), year: 2026, month: 11, category: "EXPENSE" };
    await updateMonthlyEntryAction({}, formulario({ entryId: "e1", entryDate: "2026-10-14" }));
    expect(editados[0]).toMatchObject({ year: 2026, month: 10 });
  });

  it("mudou só a categoria: o mês gravado fica (inclusive o de antes desta regra)", async () => {
    gravado = { cartaoId: "c1", entryDate: new Date("2026-10-15T00:00:00Z"), year: 2026, month: 10, category: "EXPENSE" };
    await updateMonthlyEntryAction({}, formulario({ entryId: "e1", parentCategory: "ALIMENTACAO" }));
    expect(editados[0]).toMatchObject({ year: 2026, month: 10 });
  });

  it("escolheu o cartão na edição: vai para o mês da fatura; tirou o cartão: volta ao mês da compra", async () => {
    gravado = { cartaoId: null, entryDate: new Date("2026-10-15T00:00:00Z"), year: 2026, month: 10, category: "EXPENSE" };
    await updateMonthlyEntryAction({}, formulario({ entryId: "e1", cartaoId: "c1" }));
    expect(editados[0]).toMatchObject({ year: 2026, month: 11, cartaoId: "c1", noCartao: true });
    gravado = { cartaoId: "c1", entryDate: new Date("2026-10-15T00:00:00Z"), year: 2026, month: 11, category: "EXPENSE" };
    await updateMonthlyEntryAction({}, formulario({ entryId: "e1", cartaoId: "" }));
    expect(editados[1]).toMatchObject({ year: 2026, month: 10, cartaoId: null });
  });
});
