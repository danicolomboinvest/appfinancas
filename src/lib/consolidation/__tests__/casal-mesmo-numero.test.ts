import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";
import type { CasaNaSessao } from "@/lib/casa/regras";
import { bate } from "@/lib/casa/__tests__/avaliador";

/**
 * "As coisas precisam bater certinho" (15/10/2026): no casal, o mesmo número em todas as telas.
 *
 * Um banco de mentira com a casa da Ana (titular) e do Caio (par), e os filtros de verdade rodando
 * pelo avaliador. Antes o Resumo (getMonthlySummary) somava os dois e o ranking por categoria, a
 * curva do dia a dia, o ano e os stories somavam só quem estava logada: o Gastou de setembro era
 * R$ 4.300 no Resumo e R$ 2.800 no resto. Cada teste mostra a conta de antes e a de agora.
 */

type Linha = {
  id: string;
  userId: string;
  profileId: string;
  year: number;
  month: number;
  category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";
  amount: number;
  entryDate: Date | null;
  createdAt: Date;
  importBatchId: string | null;
  importBatch: { ocultoDoPar: boolean } | null;
  soMeu: boolean;
  parentCategory: string | null;
  customCategoryId: string | null;
};

const banco = vi.hoisted(() => ({
  linhas: [] as Record<string, unknown>[],
  personalizadas: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/db/prisma", async () => {
  const { bate: avalia } = await import("@/lib/casa/__tests__/avaliador");
  const filtra = (where: Record<string, unknown> = {}) => banco.linhas.filter((l) => avalia(l, where));
  return {
    prisma: {
      monthlyEntry: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => filtra(where),
        findFirst: async ({ where }: { where: Record<string, unknown> }) =>
          [...filtra(where)].sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime())[0] ?? null,
        aggregate: async ({ where }: { where: Record<string, unknown> }) => ({ _sum: { amount: filtra(where).reduce((t, l) => t + (l.amount as number), 0) } }),
        groupBy: async ({ by, where }: { by: string[]; where: Record<string, unknown> }) => {
          const grupos = new Map<string, Record<string, unknown> & { _sum: { amount: number }; _count: number }>();
          for (const l of filtra(where)) {
            const chave = by.map((k) => String(l[k])).join("|");
            const g = grupos.get(chave) ?? { ...Object.fromEntries(by.map((k) => [k, l[k]])), _sum: { amount: 0 }, _count: 0 };
            g._sum.amount += l.amount as number;
            g._count += 1;
            grupos.set(chave, g);
          }
          return [...grupos.values()];
        },
      },
      customCategory: { findMany: async ({ where }: { where: Record<string, unknown> }) => banco.personalizadas.filter((c) => avalia(c, where)) },
    },
  };
});

import { getAnnualSummary, getMonthlySummary } from "../monthly";
import { getYearlySummary } from "../yearly";
import { gastoAteHoje, getCategorySpending, getDailyFlow } from "../month-analysis";
import { computeMonthlyRecap } from "@/lib/recap/monthly";
import { sobrouDoResumo } from "../sobrou";
import { somarPorMesETipo } from "../escopo";
import { resumoDasSomas } from "../monthly";
import { mesesDoGrafico, serieDoGrafico } from "@/lib/recap/email-do-resumo";
import { readFileSync } from "node:fs";

const ANA = { userId: "u-ana", profileId: "p-ana" };
const CAIO = { userId: "u-caio", profileId: "p-caio" };
const CASA_DA_ANA: CasaNaSessao = {
  membroId: "m1",
  casalProfileId: "casal-ana",
  eu: { ...ANA, letra: "A", nome: "Ana", papel: "titular" },
  outro: { ...CAIO, letra: "B", nome: "Caio", papel: "par" },
};
const CASA_DO_CAIO: CasaNaSessao = { ...CASA_DA_ANA, eu: CASA_DA_ANA.outro, outro: CASA_DA_ANA.eu };

const ctxAna = { ...ANA, role: "CLIENT", profileTheme: "padrao", profileKind: "PESSOAL", casa: CASA_DA_ANA } as AuthContext;
const ctxCaio = { ...CAIO, role: "CLIENT", profileTheme: "padrao", profileKind: "PESSOAL", casa: CASA_DO_CAIO } as AuthContext;

const dia = (m: number, d: number) => new Date(Date.UTC(2025, m - 1, d));
let n = 0;
const L = (o: Partial<Linha>): Linha => ({
  id: `l${++n}`,
  ...ANA,
  year: 2025,
  month: 9,
  category: "EXPENSE",
  amount: 0,
  entryDate: dia(o.month ?? 9, 10),
  createdAt: dia(o.month ?? 9, 10),
  importBatchId: null,
  importBatch: null,
  soMeu: false,
  parentCategory: null,
  customCategoryId: null,
  ...o,
});

/** A conta de ANTES: { userId, profileId } de quem está logada, sem a casa. */
const soDeQuemOlha = (ctx: AuthContext, resto: Record<string, unknown>) =>
  banco.linhas.filter((l) => bate(l, { userId: ctx.userId, profileId: ctx.profileId, ...resto })).reduce((t, l) => t + (l.amount as number), 0);

const rotulos = { MORADIA: "Moradia", ALIMENTACAO: "Alimentação" };

beforeEach(() => {
  n = 0;
  banco.personalizadas = [{ id: "cc-pet", ...CAIO, name: "Pet", icon: "pata" }];
  banco.linhas = [
    // Setembro da Ana: salário, aluguel, mercado, um aporte e um resgate.
    L({ category: "INCOME", amount: 7000, entryDate: dia(9, 5) }),
    L({ amount: 2000, parentCategory: "MORADIA", entryDate: dia(9, 2) }),
    L({ amount: 800, parentCategory: "ALIMENTACAO", entryDate: dia(9, 10) }),
    L({ category: "INVESTMENT_CONTRIBUTION", amount: 1000, entryDate: dia(9, 6) }),
    L({ category: "INVESTMENT_CONTRIBUTION", amount: -400, entryDate: dia(9, 20) }),
    // Setembro do Caio: salário, mercado, o Pet (categoria dele), o "Só meu" e a conta escondida.
    L({ ...CAIO, category: "INCOME", amount: 3000, entryDate: dia(9, 5) }),
    L({ ...CAIO, amount: 600, parentCategory: "ALIMENTACAO", entryDate: dia(9, 12) }),
    L({ ...CAIO, amount: 900, customCategoryId: "cc-pet", entryDate: dia(9, 15) }),
    L({ ...CAIO, amount: 500, parentCategory: "ALIMENTACAO", soMeu: true, entryDate: dia(9, 16) }),
    L({ ...CAIO, amount: 300, parentCategory: "MORADIA", importBatchId: "lote-c6", importBatch: { ocultoDoPar: true }, entryDate: dia(9, 17) }),
    // Agosto dos dois.
    L({ month: 8, category: "INCOME", amount: 7000 }),
    L({ month: 8, amount: 1500, parentCategory: "MORADIA" }),
    L({ ...CAIO, month: 8, amount: 1000, parentCategory: "ALIMENTACAO" }),
  ];
});

describe("casal: o Gastou do Resumo é o mesmo em todas as telas", () => {
  it("Resumo de setembro da Ana: os dois, sem o 'Só meu' e a conta escondida do Caio", async () => {
    const r = await getMonthlySummary(ctxAna, 2025, 9);
    expect(r.totalExpense).toBe(2000 + 800 + 600 + 900);
    expect(r.totalIncome).toBe(10000);
    // Antes: as outras telas somavam só a Ana.
    expect(soDeQuemOlha(ctxAna, { year: 2025, month: 9, category: "EXPENSE" })).toBe(2800);
  });

  it("ranking por categoria (getCategorySpending): soma e fatias do mesmo Gastou, o Pet do Caio com o nome dele", async () => {
    const resumo = await getMonthlySummary(ctxAna, 2025, 9);
    const ranking = await getCategorySpending(ctxAna, 2025, 9, rotulos);
    expect(ranking.reduce((t, c) => t + c.amount, 0)).toBe(resumo.totalExpense);
    expect(ranking.find((c) => c.key === "cc-pet")).toMatchObject({ label: "Pet", amount: 900 });
    // Alimentação: os 800 da Ana e os 600 do Caio; o "Só meu" dele (500) nunca entra.
    expect(ranking.find((c) => c.key === "ALIMENTACAO")).toMatchObject({ amount: 1400, previousAmount: 1000 });
    expect(ranking.reduce((t, c) => t + c.share, 0)).toBeCloseTo(1);
  });

  it("curva do dia a dia (getDailyFlow): o último ponto fecha com o Gastou e o Guardou do Resumo", async () => {
    const resumo = await getMonthlySummary(ctxAna, 2025, 9);
    const fluxo = await getDailyFlow(ctxAna, 2025, 9);
    expect(gastoAteHoje(fluxo)).toBe(resumo.totalExpense);
    expect(fluxo.points.at(-1)).toMatchObject({ income: resumo.totalIncome, investment: resumo.totalInvestment });
  });

  it("ano (getYearlySummary e getAnnualSummary): cada mês igual ao Resumo do mês", async () => {
    const ano = await getYearlySummary(ctxAna, 2025);
    const setembro = await getMonthlySummary(ctxAna, 2025, 9);
    const agosto = await getMonthlySummary(ctxAna, 2025, 8);
    expect(ano.months[8]).toMatchObject({ totalExpense: setembro.totalExpense, totalIncome: setembro.totalIncome, totalInvestment: setembro.totalInvestment });
    expect(ano.months[7].totalExpense).toBe(agosto.totalExpense);
    expect(ano.months[7].totalExpense).toBe(2500);
    const anual = await getAnnualSummary(ctxAna, 2025);
    expect(anual.totalExpense).toBe(setembro.totalExpense + agosto.totalExpense);
    // Antes: o ano somava só a Ana, e agosto dava 1.500 contra 2.500 no Resumo.
    expect(soDeQuemOlha(ctxAna, { year: 2025, month: 8, category: "EXPENSE" })).toBe(1500);
  });

  it("stories (computeMonthlyRecap): o gasto do mês e do anterior são os do Resumo", async () => {
    const recap = await computeMonthlyRecap(ctxAna, 2025, 9);
    expect(recap.monthSpent).toBe((await getMonthlySummary(ctxAna, 2025, 9)).totalExpense);
    expect(recap.prevMonthSpent).toBe((await getMonthlySummary(ctxAna, 2025, 8)).totalExpense);
    expect(recap.topCategory).toEqual({ label: "Moradia", value: 2000 });
  });

  it("o par vê o mesmo plano de números: os dele inteiros e os da Ana visíveis, em todas as telas", async () => {
    const resumo = await getMonthlySummary(ctxCaio, 2025, 9);
    // O "Só meu" e a conta escondida do Caio são dinheiro dele: contam para ele.
    expect(resumo.totalExpense).toBe(2000 + 800 + 600 + 900 + 500 + 300);
    const ranking = await getCategorySpending(ctxCaio, 2025, 9, rotulos);
    expect(ranking.reduce((t, c) => t + c.amount, 0)).toBe(resumo.totalExpense);
    expect(gastoAteHoje(await getDailyFlow(ctxCaio, 2025, 9))).toBe(resumo.totalExpense);
    expect((await getYearlySummary(ctxCaio, 2025)).months[8].totalExpense).toBe(resumo.totalExpense);
    expect((await computeMonthlyRecap(ctxCaio, 2025, 9)).monthSpent).toBe(resumo.totalExpense);
  });

  it("sem casa, nada muda: só o Pessoal de quem olha", async () => {
    const sozinha = { ...ctxAna, casa: null } as AuthContext;
    expect((await getMonthlySummary(sozinha, 2025, 9)).totalExpense).toBe(2800);
    expect(gastoAteHoje(await getDailyFlow(sozinha, 2025, 9))).toBe(2800);
    expect((await getCategorySpending(sozinha, 2025, 9, rotulos)).find((c) => c.key === "cc-pet")).toBeUndefined();
  });
});

describe("e-mail do resumo: os números do Resumo, pela mesma carga", () => {
  it("o mês, o anterior e o gráfico saem da carga única e batem com o Resumo de cada mês", async () => {
    const meses = mesesDoGrafico(2025, 9);
    const somas = await somarPorMesETipo(ctxAna, { OR: meses.map((m) => ({ year: m.year, month: m.month })) });
    const doMes = (m: number) => resumoDasSomas(somas.filter((g) => g.year === 2025 && g.month === m));
    expect(doMes(9)).toEqual(await getMonthlySummary(ctxAna, 2025, 9));
    expect(doMes(8).totalExpense).toBe((await getMonthlySummary(ctxAna, 2025, 8)).totalExpense);
    expect(serieDoGrafico(meses, somas).at(-1)).toEqual({ rotulo: "set", entrou: 10000, gastou: 4300 });
  });

  it("a rota do e-mail monta o contexto como a sessão e lê pela carga única", () => {
    const rota = readFileSync("src/app/api/cron/monthly-recap/route.ts", "utf-8");
    expect(rota).toMatch(/contextoDoPerfil\(user, perfilDoEmail\)/);
    expect(rota).toMatch(/somarPorMesETipo\(ctx,/);
    expect(rota).toMatch(/listBudgets\(ctx, year, month\)/);
    // Nenhuma soma de lançamento com { userId, profileId } na mão.
    expect(rota).not.toMatch(/where: \{ userId: user\.id, profileId: perfilDoEmail\.id/);
  });
});

describe("Foco: 'gastando X% menos que no mês passado' compara o mesmo escopo", () => {
  it("o lado de hoje (gastoAteHoje) e o do mês passado (Resumo) somam os mesmos lançamentos", async () => {
    // Mês fechado: o 'até hoje' é o mês inteiro, e tem que ser exatamente o Gastou do Resumo.
    const fluxoDeAgosto = await getDailyFlow(ctxAna, 2025, 8);
    expect(gastoAteHoje(fluxoDeAgosto)).toBe((await getMonthlySummary(ctxAna, 2025, 8)).totalExpense);
    // Antes: hoje só a Ana (1.500), mês passado os dois (2.500). "40% menos" sem ninguém ter
    // gastado menos.
    expect(soDeQuemOlha(ctxAna, { year: 2025, month: 8, category: "EXPENSE" })).toBe(1500);
  });
});

describe("stories: 'ficou no seu bolso' é o sobrou da regra única", () => {
  it("allTimeSaved = soma do sobrou (entrou − gastou − guardou) de cada mês, o mesmo do Resumo", async () => {
    const recap = await computeMonthlyRecap(ctxAna, 2025, 9);
    const sobrouSetembro = sobrouDoResumo(await getMonthlySummary(ctxAna, 2025, 9));
    const sobrouAgosto = sobrouDoResumo(await getMonthlySummary(ctxAna, 2025, 8));
    expect(recap.allTimeSaved).toBe(sobrouSetembro + sobrouAgosto);
    // Setembro: 10.000 − 4.300 − 600 (aporte de 1.000 menos o resgate de 400) = 5.100.
    expect(sobrouSetembro).toBe(5100);
    // Antes: entrou − gastou, com o aporte contado como "no bolso" (600 a mais).
    expect(recap.allTimeSaved).toBe(10000 + 7000 - 4300 - 2500 - 600);
  });

  it("a projeção 'de uma vez' parte do mesmo sobrou acumulado (nunca do entrou − gastou)", async () => {
    const recap = await computeMonthlyRecap(ctxAna, 2025, 9);
    const { fv } = await import("@/lib/finance/fv");
    const { annualToMonthly } = await import("@/lib/finance/rate-conversion");
    expect(recap.lumpSumProjection10y).toBe(fv(annualToMonthly(0.1), 120, 0, recap.allTimeSaved).toNumber());
  });

  it("poupança média do ano: o que não virou gasto (guardou + sobrou) ÷ meses com lançamento", async () => {
    const recap = await computeMonthlyRecap(ctxAna, 2025, 9);
    const set = await getMonthlySummary(ctxAna, 2025, 9);
    const ago = await getMonthlySummary(ctxAna, 2025, 8);
    expect(recap.avgMonthlySaving).toBe((sobrouDoResumo(set) + set.totalInvestment + sobrouDoResumo(ago) + ago.totalInvestment) / 2);
  });
});
