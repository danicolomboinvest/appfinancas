import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";
import type { CasaNaSessao } from "@/lib/casa/regras";

/**
 * O cartão "Acerto do mês" do Casal simples contra um banco de mentira: o mesmo acerto nos dois
 * logins (um manda, o outro recebe), e nada escondido entra na conta, nem o "Só meu" nem a conta
 * desligada, de nenhum dos dois.
 */

type Linha = {
  id: string;
  userId: string;
  profileId: string;
  year: number;
  month: number;
  category: "INCOME" | "EXPENSE";
  amount: number;
  doCasal: boolean | null;
  soMeu: boolean;
  description: string | null;
  subcategory: string | null;
  parentCategory: string | null;
  importBatchId: string | null;
  importBatch: { ocultoDoPar: boolean } | null;
};

const db = vi.hoisted(() => ({ linhas: [] as Linha[], config: {} as unknown }));

vi.mock("@/lib/db/prisma", async () => {
  const { bate } = await import("@/lib/casa/__tests__/avaliador");
  return {
    prisma: {
      financialProfile: { findUnique: async () => ({ casal: db.config }) },
      fechamentoCasal: { findUnique: async () => null },
      monthlyEntry: {
        findMany: async ({ where }: { where: Record<string, unknown> }) =>
          db.linhas.filter((l) => {
            // O avaliador não conhece { in }: o filtro de categoria é conferido à parte.
            const { AND } = where as { AND: Record<string, unknown>[] };
            const [regra, resto] = AND;
            const r = resto as { year: number; month: number; category: { in: string[] } };
            return bate(l as unknown as Record<string, unknown>, regra) && l.year === r.year && l.month === r.month && r.category.in.includes(l.category);
          }),
      },
    },
  };
});

const { acertoDaCasa } = await import("@/lib/repositories/casa.repo");

const ANA = { userId: "ana", profileId: "pessoal-ana", letra: "A" as const, nome: "Ana", papel: "titular" as const };
const LUCAS = { userId: "lucas", profileId: "pessoal-lucas", letra: "B" as const, nome: "Lucas", papel: "par" as const };
const casaDe = (eu: typeof ANA | typeof LUCAS, outro: typeof ANA | typeof LUCAS): CasaNaSessao => ({ membroId: "m", casalProfileId: "casal", eu, outro });
const ctx = (eu: typeof ANA | typeof LUCAS, outro: typeof ANA | typeof LUCAS): AuthContext =>
  ({ userId: eu.userId, profileId: eu.profileId, role: "CLIENT", profileTheme: "padrao", profileKind: "PESSOAL", casa: casaDe(eu, outro) }) as AuthContext;

let n = 0;
const L = (dono: typeof ANA | typeof LUCAS, o: Partial<Linha>): Linha => ({
  id: `l${++n}`,
  userId: dono.userId,
  profileId: dono.profileId,
  year: 2026,
  month: 10,
  category: "EXPENSE",
  amount: 0,
  doCasal: null,
  soMeu: false,
  description: null,
  subcategory: null,
  parentCategory: "MORADIA",
  importBatchId: null,
  importBatch: null,
  ...o,
});

describe("Acerto do mês no Casal simples", () => {
  it("meio a meio: a Ana pagou 2.400 e o Lucas 600; o Lucas manda 900, nos dois logins", async () => {
    db.config = { nomeA: "Ana", nomeB: "Lucas", divisao: "meio", acertos: [] };
    db.linhas = [
      L(ANA, { amount: 2400, description: "Aluguel" }),
      L(LUCAS, { amount: 600, description: "Mercado", parentCategory: "ALIMENTACAO" }),
      // Escondidos: não entram, de ninguém.
      L(ANA, { amount: 250, description: "Consulta", soMeu: true }),
      L(LUCAS, { amount: 999, description: "Presente", soMeu: true }),
      L(ANA, { amount: 5000, description: "Inter", importBatchId: "b1", importBatch: { ocultoDoPar: true } }),
      // "Da pessoa" do Nós dois de antes (doCasal false): continua fora do acerto.
      L(LUCAS, { amount: 60, description: "Barbearia", doCasal: false }),
      // Outro mês e outra pessoa: fora.
      L(ANA, { amount: 700, month: 9 }),
      L({ ...ANA, userId: "estranha", profileId: "x" }, { amount: 800 }),
    ];
    const daAna = await acertoDaCasa(ctx(ANA, LUCAS), 2026, 10);
    const doLucas = await acertoDaCasa(ctx(LUCAS, ANA), 2026, 10);
    expect(daAna?.totalDaCasa).toBe(3000);
    expect(daAna?.pagou).toEqual({ A: 2400, B: 600 });
    expect(daAna?.euMando).toBe(-900);
    expect(doLucas?.euMando).toBe(900);
    expect(doLucas?.totalDaCasa).toBe(daAna?.totalDaCasa);
  });

  it("pela renda: só a renda visível conta; com o salário da Ana no Só meu, cai para meio a meio", async () => {
    db.config = { nomeA: "Ana", nomeB: "Lucas", divisao: "renda", acertos: ["2026-10"] };
    db.linhas = [
      L(ANA, { category: "INCOME", amount: 7700, parentCategory: null }),
      L(LUCAS, { category: "INCOME", amount: 6300, parentCategory: null }),
      L(ANA, { amount: 2400 }),
      L(LUCAS, { amount: 1000 }),
    ];
    const pelaRenda = await acertoDaCasa(ctx(LUCAS, ANA), 2026, 10);
    expect(pelaRenda?.fracaoA).toBeCloseTo(0.55, 2);
    expect(pelaRenda?.acertado).toBe(true);
    db.linhas[0].soMeu = true;
    const semRenda = await acertoDaCasa(ctx(LUCAS, ANA), 2026, 10);
    expect(semRenda?.caiuParaMeio).toBe(true);
    expect(semRenda?.rendas.A).toBe(0);
  });

  it("sem casa não há acerto", async () => {
    const semCasa = { ...ctx(ANA, LUCAS), casa: null } as AuthContext;
    expect(await acertoDaCasa(semCasa, 2026, 10)).toBeNull();
  });
});
