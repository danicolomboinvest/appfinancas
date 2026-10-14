import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O bug que gerou reembolso (14/10/2026): "na hora de registrar certas dívidas não dava pra
 * colocar os centavos". O que ela digita no cadastro é o que fica salvo, com centavos.
 */
const criarDivida = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/components/money/MoneyProvider", () => ({ useCurrency: () => "BRL" }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "p1" })), doDono: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/repositories/goal.repo", () => ({ createGoal: vi.fn() }));
vi.mock("@/lib/desfazer/recibo", () => ({ criarRecibo: vi.fn(), lerRecibo: vi.fn() }));
vi.mock("@/lib/repositories/divida.repo", () => ({
  criarDivida: (...a: unknown[]) => criarDivida(...a),
  editarDivida: vi.fn(),
  apagarDivida: vi.fn(),
  desfazerToque: vi.fn(),
  pagarParcela: vi.fn(),
  quitarDivida: vi.fn(),
  restaurarDivida: vi.fn(),
}));

import { salvarDividaAction } from "../actions";
import { digitar } from "@/components/ui/__tests__/digitar-no-campo";

beforeEach(() => criarDivida.mockReset());

const base = {
  tipo: "cartao_parcelado" as const,
  credor: "Nubank",
  apelido: "",
  paraQue: null,
  planejada: false,
  parcelasAbertas: 10,
  parcelasTotal: 12,
  semParcela: false,
  taxaMensal: null,
  diaVencimento: 10,
  atrasada: false,
};

describe("cadastro da dívida salva o valor digitado", () => {
  it("saldo 1234,56 e parcela 123,45 chegam ao banco como 1234.56 e 123.45", async () => {
    const saldo = digitar("1234,56");
    const porMes = digitar("123,45");
    const r = await salvarDividaAction({ ...base, saldo: saldo ?? 0, porMes: porMes ?? 0 });
    expect(r).toEqual({ ok: true });
    expect(criarDivida).toHaveBeenCalledTimes(1);
    expect(criarDivida.mock.calls[0][1]).toMatchObject({ saldo: 1234.56, porMes: 123.45 });
  });

  it("centavos sozinhos (0,99) também", async () => {
    await salvarDividaAction({ ...base, saldo: digitar("0,99") ?? 0, porMes: 0 });
    expect(criarDivida.mock.calls[0][1]).toMatchObject({ saldo: 0.99, porMes: 0 });
  });

  it("o formulário usa o campo de dinheiro, não mais os dígitos como reais", () => {
    const fonte = readFileSync(join(__dirname, "..", "CadastroDaDivida.tsx"), "utf8");
    expect(fonte).toMatch(/<CampoDeDinheiro[^>]*aria-label="Valor total hoje"/);
    expect(fonte).toMatch(/<CampoDeDinheiro[^>]*"Parcela por mês"/);
    expect(fonte).not.toMatch(/saldo: soDigitos/);
    expect(fonte).not.toMatch(/porMes: soDigitos/);
  });
});
