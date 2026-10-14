import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Metas e aportes: o que ela digita (com centavos) é o que fica salvo (14/10/2026). */
const goalCreate = vi.fn<(args: { data: Record<string, unknown> }) => Promise<{ id: string }>>(async () => ({ id: "m1" }));
const createMonthlyEntry = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/components/money/MoneyProvider", () => ({ useCurrency: () => "BRL" }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "p1" })), doDono: () => ({ userId: "u1", profileId: "p1" }) }));
vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => new Date(2026, 9, 14, 12) }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { goal: { create: (args: { data: Record<string, unknown> }) => goalCreate(args), updateMany: vi.fn() }, fotoDaMeta: { count: vi.fn(async () => 0) } },
}));
vi.mock("@/lib/repositories/monthly-entry.repo", () => ({ createMonthlyEntry: (...a: unknown[]) => createMonthlyEntry(...a) }));
vi.mock("@/lib/repositories/goal.repo", () => ({ apagarMeta: vi.fn(), restaurarMeta: vi.fn() }));
vi.mock("@/lib/desfazer/recibo", () => ({ criarRecibo: vi.fn(), lerRecibo: vi.fn() }));
vi.mock("@/lib/repositories/metas.repo", () => ({ lerMetaDaTela: vi.fn(async () => ({ id: "m1", nome: "Viagem", guardado: 5000 })) }));

import { criarMetaAction, guardarNaMetaAction, marcarAporteAction } from "../acoes";
import { digitar } from "@/components/ui/__tests__/digitar-no-campo";

beforeEach(() => {
  goalCreate.mockClear();
  createMonthlyEntry.mockClear();
});

describe("meta: quanto você precisa", () => {
  it("1234,56 vira targetAmount 1234.56", async () => {
    const alvo = digitar("1234,56") ?? 0;
    const r = await criarMetaAction({ nome: "Viagem", tipo: "VIAGEM", alvo, prazo: null, porMes: 500, foto: null });
    expect(r.ok).toBe(true);
    expect(goalCreate.mock.calls[0][0]).toMatchObject({ data: { targetAmount: 1234.56 } });
  });
});

describe("meta: adicionar e retirar", () => {
  it("adicionar 0,99 lança 0.99; retirar 1.234,56 lança -1234.56", async () => {
    await guardarNaMetaAction("m1", digitar("0,99") ?? 0, "adicionar");
    await guardarNaMetaAction("m1", digitar("123456") ?? 0, "retirar");
    expect(createMonthlyEntry.mock.calls[0][1]).toMatchObject({ amount: 0.99 });
    expect(createMonthlyEntry.mock.calls[1][1]).toMatchObject({ amount: -1234.56 });
  });
});

describe("aporte do mês", () => {
  it("1234,56 vira o lançamento de 1234.56", async () => {
    const r = await marcarAporteAction("m1", digitar("1234,56") ?? 0, "pix", "2026-10-14");
    expect(r).toEqual({ ok: true });
    expect(createMonthlyEntry.mock.calls[0][1]).toMatchObject({ amount: 1234.56, category: "INVESTMENT_CONTRIBUTION" });
  });
});

describe("os formulários usam o campo de dinheiro", () => {
  const ler = (...p: string[]) => readFileSync(join(__dirname, "..", ...p), "utf8");
  it.each([
    ["FolhaDaMeta.tsx", "Quanto você precisa"],
    [join("[id]", "AcoesDaMeta.tsx"), "Valor"],
    [join("[id]", "CartaoDoAporte.tsx"), "Valor do aporte"],
  ])("%s", (arquivo, rotulo) => {
    const fonte = ler(arquivo);
    expect(fonte).toMatch(new RegExp(`<CampoDeDinheiro[^>]*aria-label="${rotulo}"`));
    expect(fonte).not.toMatch(/Number\(ev\.target\.value\.replace\(\/\\D\/g/);
  });
});
