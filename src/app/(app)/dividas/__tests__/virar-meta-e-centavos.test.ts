import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMoneyFormatter } from "@/lib/money";

/** QA de 14/10/2026 nas Dívidas: o mês da meta "Sair das dívidas" e os centavos da parcela. */
const createGoal = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "p1" })), doDono: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { goal: { findFirst: vi.fn(async () => null) } } }));
vi.mock("@/lib/repositories/goal.repo", () => ({ createGoal: (...a: unknown[]) => createGoal(...a) }));
vi.mock("@/lib/desfazer/recibo", () => ({ criarRecibo: vi.fn(), lerRecibo: vi.fn() }));
vi.mock("@/lib/repositories/divida.repo", () => ({}));

import { virarMetaAction } from "../actions";
import { valorDigitado } from "../partes";

beforeEach(() => createGoal.mockReset());

describe("Virar meta", () => {
  it("o plano livre em set/2027 vira meta com prazo em setembro de 2027 (não agosto)", async () => {
    const r = await virarMetaAction({ total: 17284, meses: 11, ano: 2027, mes: 9 });
    expect(r).toEqual({ ok: true, jaExistia: false });
    const prazo = createGoal.mock.calls[0][1].targetDate as Date;
    // Lido como a tela lê (getMonth no fuso do servidor) e também em UTC: setembro nos dois.
    expect(prazo.getMonth()).toBe(8);
    expect(prazo.getUTCMonth()).toBe(8);
    expect(prazo.getFullYear()).toBe(2027);
  });
});

describe("a parcela aparece como foi digitada", () => {
  const money = makeMoneyFormatter("BRL");
  const limpo = (s: string) => s.replace(/\s/g, " ");
  it("123,45 com centavos; 500 redondo", () => {
    expect(limpo(valorDigitado(money, 123.45))).toBe("R$ 123,45");
    expect(limpo(valorDigitado(money, 500))).toBe("R$ 500");
  });
  it("o detalhe usa esse valor no Por mês", () => {
    const fonte = readFileSync(join(__dirname, "..", "DetalheDaDivida.tsx"), "utf8");
    expect(fonte).toMatch(/fato\("Por mês"[^\n]*valorDigitado\(money, d\.porMes\)/);
  });
});

describe("Paguei uma parcela", () => {
  it("só aparece quando há valor por mês (sem ele, o toque só somava juros)", () => {
    const fonte = readFileSync(join(__dirname, "..", "DetalheDaDivida.tsx"), "utf8");
    expect(fonte).toMatch(/\{d\.porMes > 0 && \(\s*<button[^>]*onClick=\{paguei\}/);
  });
});
