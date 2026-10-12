import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LancamentoParaCacar } from "@/lib/dinheiro-perdido/detectar";

/**
 * Contas do histórico gravando de verdade (num banco de mentira): cadastra a Vivo sozinha, não
 * duplica a que ela já tinha, não recria a que ela apagou, não sobrescreve a que ela editou, e
 * nunca olha outro perfil.
 */

type Conta = {
  id: string; userId: string; profileId: string; nome: string; valor: number | null; vencimento: Date; diaDoMes: number | null;
  chaveDoHistorico: string | null; editadaPelaPessoa: boolean; quitada: boolean; aproximado: boolean; origem: string | null; avisadaEm: Date | null;
};
const banco = vi.hoisted(() => ({ contas: [] as Conta[], recusas: [] as { userId: string; profileId: string; chave: string; nome?: string; valor?: number | null }[], lancamentos: [] as LancamentoParaCacar[] }));
const doDono = (w: { userId: string; profileId: string }) => (c: { userId: string; profileId: string }) => c.userId === w.userId && c.profileId === w.profileId;

vi.mock("@/lib/auth/session", () => ({ doDono: (c: { userId: string; profileId: string }) => ({ userId: c.userId, profileId: c.profileId }) }));
vi.mock("@/lib/repositories/dinheiro-perdido.repo", () => ({ lancamentosParaCacar: vi.fn(async () => banco.lancamentos) }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    contaAPagar: {
      findMany: vi.fn(async ({ where }: { where: Conta }) => banco.contas.filter(doDono(where)).filter((c) => (where.origem ? c.origem === where.origem : true))),
      findFirst: vi.fn(async ({ where }: { where: Conta }) => banco.contas.filter(doDono(where)).find((c) => c.id === where.id) ?? null),
      create: vi.fn(async ({ data }: { data: Partial<Conta> }) => {
        const c = { id: `c${banco.contas.length + 1}`, editadaPelaPessoa: false, quitada: false, aproximado: false, origem: null, chaveDoHistorico: null, avisadaEm: null, diaDoMes: null, ...data } as Conta;
        banco.contas.push(c);
        return c;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Partial<Conta> & { userId: string; profileId: string }; data: Partial<Conta> }) => {
        const alvo = banco.contas.filter(doDono(where)).filter((c) => (!where.id || c.id === where.id) && (where.editadaPelaPessoa === undefined || c.editadaPelaPessoa === where.editadaPelaPessoa));
        alvo.forEach((c) => Object.assign(c, data));
        return { count: alvo.length };
      }),
      deleteMany: vi.fn(async ({ where }: { where: Conta }) => {
        const antes = banco.contas.length;
        banco.contas = banco.contas.filter((c) => !(doDono(where)(c) && c.id === where.id));
        return { count: antes - banco.contas.length };
      }),
    },
    contaRecusada: {
      findMany: vi.fn(async ({ where }: { where: Conta }) => banco.recusas.filter(doDono(where))),
      createMany: vi.fn(async ({ data }: { data: { userId: string; profileId: string; chave: string; nome?: string; valor?: number | null }[] }) => {
        banco.recusas.push(...data);
        return { count: data.length };
      }),
    },
  },
}));

const { sincronizarContasDoHistorico } = await import("../contas-do-historico.repo");
const { apagarContaAPagar, editarContaAPagar } = await import("../conta-a-pagar.repo");

const ctx = { userId: "u1", profileId: "pessoal" };
const hoje = new Date(Date.UTC(2026, 9, 12));
let seq = 0;
const vivo = () =>
  [5, 6, 7, 8, 9].map((m) => ({ id: `l${++seq}`, descricao: "VIVO SP", valor: 89.99, data: `2026-${String(m).padStart(2, "0")}-10`, ano: 2026, mes: m, tipo: "EXPENSE" as const, categoria: "MORADIA", subcategoria: null }));

beforeEach(() => {
  banco.contas = [];
  banco.recusas = [];
  banco.lancamentos = vivo();
});

describe("contas do histórico no banco", () => {
  it("cadastra a Vivo sozinha, todo dia 10, com o selo do extrato", async () => {
    const r = await sincronizarContasDoHistorico(ctx, hoje);
    expect(r.criadas).toBe(1);
    expect(banco.contas[0]).toMatchObject({ nome: "Vivo", valor: 89.99, diaDoMes: 10, repete: true, origem: "historico", chaveDoHistorico: "m:vivo", profileId: "pessoal" });
    expect(banco.contas[0].vencimento.toISOString().slice(0, 10)).toBe("2026-11-10");
  });

  it("rodar de novo não duplica", async () => {
    await sincronizarContasDoHistorico(ctx, hoje);
    const r = await sincronizarContasDoHistorico(ctx, hoje);
    expect(r.criadas).toBe(0);
    expect(banco.contas).toHaveLength(1);
  });

  it("a que ela já tinha cadastrado não duplica", async () => {
    banco.contas.push({ id: "minha", userId: "u1", profileId: "pessoal", nome: "Celular", valor: 90, vencimento: hoje, diaDoMes: 12, chaveDoHistorico: null, editadaPelaPessoa: false, quitada: false, aproximado: false, origem: null, avisadaEm: null });
    const r = await sincronizarContasDoHistorico(ctx, hoje);
    expect(r.criadas).toBe(0);
    expect(banco.contas).toHaveLength(1);
  });

  it("apagada não volta", async () => {
    await sincronizarContasDoHistorico(ctx, hoje);
    await apagarContaAPagar({ ...ctx } as never, banco.contas[0].id);
    expect(banco.contas).toHaveLength(0);
    expect(banco.recusas).toEqual([{ userId: "u1", profileId: "pessoal", chave: "m:vivo", nome: "Vivo", valor: 89.99 }]);
    const r = await sincronizarContasDoHistorico(ctx, hoje);
    expect(r.criadas).toBe(0);
    expect(banco.contas).toHaveLength(0);
  });

  it("apagada segura a parecida achada por outro caminho", async () => {
    const aluguel = (descricao: string, extra: object) =>
      [5, 6, 7, 8, 9].map((m) => ({ id: `a${++seq}`, descricao, valor: 2200, data: `2026-0${m}-05`, ano: 2026, mes: m, tipo: "EXPENSE" as const, categoria: "MORADIA", subcategoria: "Aluguel", ...extra }));
    banco.lancamentos = [...aluguel("Aluguel", {}), ...aluguel("Pix enviado - Carlos Mendes - •••.321.654-••", { valor: 2190 })];
    await sincronizarContasDoHistorico(ctx, hoje);
    expect(banco.contas.map((c) => c.nome)).toEqual(["Aluguel"]);
    await apagarContaAPagar({ ...ctx } as never, banco.contas[0].id);
    await sincronizarContasDoHistorico(ctx, hoje);
    expect(banco.contas).toHaveLength(0);
  });

  it("editada não é sobrescrita", async () => {
    await sincronizarContasDoHistorico(ctx, hoje);
    await editarContaAPagar({ ...ctx } as never, banco.contas[0].id, { nome: "Vivo da casa", valor: 50, vencimento: new Date(Date.UTC(2026, 10, 15)), repete: true, lembrar: true });
    banco.lancamentos = banco.lancamentos.map((l) => ({ ...l, valor: 120 }));
    await sincronizarContasDoHistorico(ctx, hoje);
    expect(banco.contas[0]).toMatchObject({ nome: "Vivo da casa", valor: 50, editadaPelaPessoa: true });
  });

  it("a que ela não mexeu acompanha o extrato", async () => {
    await sincronizarContasDoHistorico(ctx, hoje);
    banco.lancamentos = [...banco.lancamentos, { ...banco.lancamentos[0], id: "nova", data: "2026-10-10", mes: 10, valor: 99.99 }, ...banco.lancamentos.slice(-1).map((l) => ({ ...l, id: "x", data: "2026-09-10", mes: 9, valor: 99.99 }))];
    banco.lancamentos = banco.lancamentos.filter((l) => !(l.mes === 9 && l.valor === 89.99));
    await sincronizarContasDoHistorico(ctx, hoje);
    expect(banco.contas[0].valor).toBe(99.99);
  });

  it("o perfil Empresa não vê nem segura a conta do Pessoal", async () => {
    await sincronizarContasDoHistorico(ctx, hoje);
    await sincronizarContasDoHistorico({ userId: "u1", profileId: "empresa" }, hoje);
    expect(banco.contas.map((c) => c.profileId).sort()).toEqual(["empresa", "pessoal"]);
  });
});
