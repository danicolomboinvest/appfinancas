import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * O livre do mês é UM número só, igual em todas as telas (decisão da dona, 15/10/2026): o plano
 * do mês menos o que já saiu, contando o "a vencer". Aqui a fonte única (lib/planning/livre-do-mes)
 * e o mesmo mês passando por cada tela que mostra o livre.
 */

const banco = vi.hoisted(() => ({ planejado: 0, gasto: 0, plano: null as null | { plannedIncome: number; plannedInvestment: number } }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    budget: { aggregate: vi.fn(async () => ({ _sum: { plannedAmount: banco.planejado } })) },
    monthlyEntry: { aggregate: vi.fn(async () => ({ _sum: { amount: banco.gasto } })) },
    monthlyPlan: { findUnique: vi.fn(async () => banco.plano) },
  },
}));

import { avisoDaRenda, calcularLivreDoMes, monteOPlano, valorDoLivre, type LivreDoMes } from "../livre-do-mes";
import { carregarLivreDoMes } from "@/lib/repositories/livre-do-mes.repo";
import { pilulaDaPergunta, type DadosDasPilulas } from "@/lib/decisoes/esferas";
import { numerosDoWidget } from "@/lib/widget/numeros";
import { avaliarCompra, type CompraBase } from "@/lib/decisoes/posso-comprar";
import { montarRevelacao } from "@/lib/import/revelacao";
import type { AuthContext } from "@/lib/auth/session";

const money = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const ctx = { userId: "u1", profileId: "p1", role: "USER", profileTheme: "girly", profileKind: "PESSOAL" } as unknown as AuthContext;

/** O número que cada tela escreve, a partir do mesmo mês. */
async function numerosNasTelas(): Promise<{ livre: LivreDoMes; telas: Record<string, string | null> }> {
  const livre = await carregarLivreDoMes(ctx, { ano: 2026, mes: 10 });
  const valor = livre.tipo === "plano" ? livre.valor : null;
  // Orçamento e Recorrentes: money(|valor|) + "livres"/"Livre" (ou "acima do plano").
  const orcamento = valor === null ? null : money(Math.abs(valor));
  // Decidir: a pílula do Posso comprar.
  const pilula = pilulaDaPergunta("compra", { money, livreMes: valor } as DadosDasPilulas)?.texto.replace(/ (livres|acima do plano)$/, "") ?? null;
  // Widget: o campo `mes`.
  const w = numerosDoWidget({ livre: { tipo: "semOrcamento" }, livreDoMes: livre, agora: new Date(2026, 9, 15), instante: new Date(), moeda: "BRL", tema: "girly", modo: "auto", metas: [] });
  const widget = w.mes?.valor === null || w.mes === undefined ? null : money(w.mes.valor);
  // Posso comprar: a linha "Livre no mês" da resposta (a página passa o mesmo valor em sobraDoMes).
  let comprar: string | null = null;
  if (livre.tipo === "plano" && livre.valor >= 0) {
    const base: CompraBase = { renda: 20000, gastoPlanejado: livre.planejado, sobraDoMes: livre.valor, diasRestantes: 17, metas: [], taxaReferencia: 0.008, gastoDoMesAtual: livre.gasto };
    const r = avaliarCompra(base, { valor: 1, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, { money, mesDaqui: () => "" });
    comprar = "erro" in r ? null : (r.linhas.find((l) => l.rotulo === "Livre no mês")?.hoje ?? null);
  }
  // A tela depois de importar: o mesmo mês todo como linhas.
  const rev = montarRevelacao([{ category: "EXPENSE", chave: "X", rotulo: "X", valor: livre.tipo === "plano" ? livre.gasto : 0 }], [{ chave: "X", planejado: livre.tipo === "plano" ? livre.planejado : 0 }]);
  const revelacao = rev.livre === null ? null : money(Math.abs(rev.livre));
  return { livre, telas: { orcamento, pilula, widget, comprar, revelacao } };
}

describe("livre do mês: a conta", () => {
  it("é o plano menos o que saiu, em reais inteiros", () => {
    expect(valorDoLivre(7300, 4059.4)).toBe(3241);
    expect(valorDoLivre(7300, 4058.5)).toBe(3242);
    const l = calcularLivreDoMes({ ano: 2026, mes: 10, planejado: 7300, gasto: 4059 });
    expect(l).toMatchObject({ tipo: "plano", valor: 3241, passaDaRenda: null });
  });

  it("passou do plano: negativo, a tela diz acima do plano", () => {
    expect(calcularLivreDoMes({ ano: 2026, mes: 10, planejado: 1000, gasto: 1300 })).toMatchObject({ valor: -300 });
  });

  it("sem plano: nenhum número, e o convite tem o nome do mês", () => {
    const l = calcularLivreDoMes({ ano: 2026, mes: 11, planejado: 0, gasto: 0 });
    expect(l.tipo).toBe("semPlano");
    expect(monteOPlano(l)).toBe("Monte o plano de novembro");
  });

  it("a renda não muda o livre: vira aviso à parte", () => {
    const l = calcularLivreDoMes({ ano: 2026, mes: 10, planejado: 7300, gasto: 4059, renda: 7700, guardar: 700 });
    expect(l).toMatchObject({ valor: 3241, passaDaRenda: 300 });
    expect(avisoDaRenda(l, money)).toBe("Seu plano passa da sua renda em R$ 300");
    expect(avisoDaRenda(calcularLivreDoMes({ ano: 2026, mes: 10, planejado: 7300, gasto: 0, renda: 9000, guardar: 700 }), money)).toBeNull();
  });
});

describe("livre do mês: mesmo número em todas as telas", () => {
  beforeEach(() => {
    banco.planejado = 7300;
    banco.gasto = 4059.35;
    banco.plano = { plannedIncome: 7700, plannedInvestment: 700 };
  });

  it("15/10: Orçamento, Recorrentes, Decidir, Posso comprar, widget e importação dizem R$ 3.241", async () => {
    const { livre, telas } = await numerosNasTelas();
    expect(livre).toMatchObject({ tipo: "plano", valor: 3241, passaDaRenda: 300 });
    for (const [tela, n] of Object.entries(telas)) expect([tela, n]).toEqual([tela, "R$ 3.241"]);
  });

  it("depois do lápis (+R$ 100 no plano): todas sobem R$ 100, mesmo com o plano passando da renda", async () => {
    banco.planejado += 100;
    const { telas } = await numerosNasTelas();
    for (const [tela, n] of Object.entries(telas)) expect([tela, n]).toEqual([tela, "R$ 3.341"]);
  });

  it("02/11 com o plano de novembro e nada lançado: o livre é o plano inteiro, nunca R$ 0", async () => {
    banco.gasto = 0;
    const { telas } = await numerosNasTelas();
    for (const [tela, n] of Object.entries(telas)) expect([tela, n]).toEqual([tela, "R$ 7.300"]);
  });

  it("sem plano no mês: nenhuma tela inventa número", async () => {
    banco.planejado = 0;
    const { livre, telas } = await numerosNasTelas();
    expect(livre.tipo).toBe("semPlano");
    for (const [tela, n] of Object.entries(telas)) expect([tela, n]).toEqual([tela, null]);
  });

  it("passou do plano: o Decidir diz o mesmo acima do plano que o Orçamento", async () => {
    banco.gasto = 7600;
    const { livre } = await numerosNasTelas();
    expect(livre).toMatchObject({ valor: -300 });
    expect(pilulaDaPergunta("compra", { money, livreMes: -300 } as DadosDasPilulas)?.texto).toBe("R$ 300 acima do plano");
  });
});

describe("livre do mês: nenhuma tela refaz a conta", () => {
  // As telas que dizem "livre do mês" leem a fonte única (carregarLivreDoMes direto, ou o
  // d.livreDoMes que o carregarFoco entrega).
  const telas: Record<string, RegExp> = {
    "src/app/(app)/orcamento/[year]/page.tsx": /carregarLivreDoMes\(/,
    "src/app/(app)/orcamento/contas/page.tsx": /carregarLivreDoMes\(/,
    "src/app/(app)/mensal/foco/dados.ts": /carregarLivreDoMes\(/,
    "src/app/(app)/decidir/dados.ts": /livreMes: d\.livreDoMes/,
    "src/app/(app)/decidir/comprar/page.tsx": /foco\.livreDoMes/,
    "src/app/(app)/decidir/pergunta/[slug]/page.tsx": /livreDoMes/,
    "src/app/api/widget/route.ts": /livreDoMes: d\.livreDoMes/,
    // O aviso do dia lê o livre pela carga da fonte única, com o contexto da casa (15/10/2026).
    "src/app/api/cron/alerts/route.ts": /carregarLivreDoMes\(ctx/,
    "src/lib/import/revelacao.ts": /valorDoLivre\(/,
  };
  it.each(Object.entries(telas))("%s usa a fonte única", (arquivo, padrao) => {
    expect(readFileSync(arquivo, "utf-8")).toMatch(padrao);
  });

  it("ninguém mostra a sobra do dia a dia (livre.restante) como livre do mês", () => {
    for (const arquivo of ["src/app/(app)/decidir/dados.ts", "src/app/(app)/decidir/comprar/page.tsx", "src/app/(app)/mensal/foco/page.tsx", "src/app/(app)/decidir/pergunta/[slug]/page.tsx"]) {
      expect([arquivo, /livre\.restante/.test(readFileSync(arquivo, "utf-8"))]).toEqual([arquivo, false]);
    }
  });
});
