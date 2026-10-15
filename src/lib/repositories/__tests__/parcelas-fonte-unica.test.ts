import { describe, expect, it, vi } from "vitest";
import { chaveNaoParcela, serieDaParcela, type LancamentoParcelavel } from "@/lib/contas/parcelas-do-mes";

/**
 * Parcelas: um número só (15/10/2026, "as coisas precisam bater certinho"). O Decidir ("Posso
 * comprar?") e o Money Reset (missões 2 e 4) leem carregarParcelasDoMes, a mesma conta de
 * Recorrentes, do Foco e da Previsão (lib/contas/parcelas-do-mes). Antes o Decidir ignorava o
 * "Não é parcela" e o Casal e somava o maior entre este mês e o passado; o Money Reset contava
 * qualquer gasto importado do mês seguinte como parcela.
 */

// Outubro de 2026, perfil Casal: a Ana olha, o Lucas é o outro.
const lancamentos: LancamentoParcelavel[] = [
  { id: "loja", year: 2026, month: 10, descricao: "LOJA X PARC 03/10", valor: 100, dia: null, categoria: "OUTROS" },
  // Do Lucas, visível no Casal: conta no total da casa.
  { id: "sofa", year: 2026, month: 10, descricao: "SOFA (2/5)", valor: 200, dia: "2026-10-08", categoria: "MORADIA", meu: false },
  // "Não é parcela": a academia escreve o mês no nome.
  { id: "academia", year: 2026, month: 10, descricao: "ACADEMIA PARC 05/12", valor: 90, dia: null, categoria: "SAUDE" },
  // Setembro: a TV 4/10 continua em outubro, mas a fatura de outubro ainda não chegou.
  { id: "tv", year: 2026, month: 9, descricao: "TV PARC 04/10", valor: 50, dia: null, categoria: "LAZER" },
  // Compra à vista lançada em novembro (fechou a fatura): não é parcela.
  { id: "mercado", year: 2026, month: 11, descricao: "MERCADO 12/11", valor: 500, dia: "2026-11-12", categoria: "ALIMENTACAO" },
];
const recusas = [chaveNaoParcela(serieDaParcela("ACADEMIA PARC 05/12", 12))];

vi.mock("@/lib/auth/session", () => ({ doDono: (c: { userId: string; profileId: string }) => ({ userId: c.userId, profileId: c.profileId }) }));
vi.mock("@/lib/repositories/monthly-entry.repo", () => ({ listarLancamentosParcelaveis: vi.fn(async () => lancamentos) }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    contaRecusada: { findMany: vi.fn(async () => recusas.map((chave) => ({ chave }))) },
    contaAPagar: {
      findMany: vi.fn(async () => [
        // A geladeira em 10x cadastrada à mão em Recorrentes, 2ª parcela em outubro.
        { id: "geladeira", nome: "Geladeira", valor: 300, parcelas: 10, parcelaAtual: 2, categoria: "MORADIA", diaDoMes: 15, vencimento: new Date("2026-10-15T12:00:00Z") },
      ]),
    },
  },
}));

const { carregarParcelasDoMes } = await import("../parcelas.repo");
const ctx = { userId: "ana", profileId: "casal" } as Parameters<typeof carregarParcelasDoMes>[0];

describe("carregarParcelasDoMes", () => {
  it("este mês: as lançadas (também as do outro no Casal), a que continua e a conta parcelada, sem a recusada", async () => {
    const r = await carregarParcelasDoMes(ctx, { year: 2026, month: 10 });
    expect(r.itens.map((i) => i.nome).sort()).toEqual(["Geladeira", "LOJA X", "SOFA", "TV"]);
    expect(r.total).toBe(650);
  });

  it("o mês que vem: as mesmas compras andam uma parcela, e a compra à vista não vira parcela", async () => {
    const r = await carregarParcelasDoMes(ctx, { year: 2026, month: 11 });
    expect(r.itens.map((i) => `${i.nome} ${i.atual}/${i.total}`).sort()).toEqual(["Geladeira 3/10", "LOJA X 4/10", "SOFA 3/5", "TV 6/10"]);
    expect(r.total).toBe(650);
  });
});
