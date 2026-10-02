import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

/**
 * Os números da página de Orçamento no formato do Copilot (01/10/2026): o gasto acumulado dia a
 * dia (deste mês e do anterior, para a curva), o que já saiu e o que ainda vai vencer em cada
 * categoria, os maiores gastos de cada uma e os últimos 6 meses (para o detalhe).
 *
 * A chave de categoria é a categoria-mãe ("ALIMENTACAO") ou o id da categoria dela.
 */
export type DetalheDoOrcamento = {
  /** Acumulado até cada dia (índice 0 = dia 1), só até hoje. */
  acumulado: number[];
  /** Acumulado do mês anterior, mês inteiro. */
  acumuladoAnterior: number[];
  /** O dia em que o gasto mais saltou e o maior gasto daquele dia. */
  marco: { dia: number; descricao: string; valor: number } | null;
  porCategoria: Record<string, { gasto: number; aVencer: number; maiores: { descricao: string; valor: number; vezes: number }[] }>;
  /** Últimos 6 meses (o atual por último), gasto e planejado por categoria. */
  historico: { ano: number; mes: number; porCategoria: Record<string, { gasto: number; planejado: number }> }[];
};

const chave = (e: { parentCategory: string | null; customCategoryId: string | null }) => e.customCategoryId ?? e.parentCategory ?? "SEM";

export async function carregarDetalheDoOrcamento(ctx: AuthContext, ano: number, mes: number, hoje: Date): Promise<DetalheDoOrcamento> {
  const anterior = new Date(ano, mes - 2, 1);
  const meses = Array.from({ length: 6 }, (_, i) => new Date(ano, mes - 6 + i, 1)).map((d) => ({ ano: d.getFullYear(), mes: d.getMonth() + 1 }));
  const [doMes, doAnterior, gastos6, planos6] = await Promise.all([
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, year: ano, month: mes, category: "EXPENSE" },
      select: { amount: true, entryDate: true, parentCategory: true, customCategoryId: true, description: true },
    }),
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, year: anterior.getFullYear(), month: anterior.getMonth() + 1, category: "EXPENSE" },
      select: { amount: true, entryDate: true },
    }),
    prisma.monthlyEntry.groupBy({
      by: ["year", "month", "parentCategory", "customCategoryId"],
      where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", OR: meses.map((m) => ({ year: m.ano, month: m.mes })) },
      _sum: { amount: true },
    }),
    prisma.budget.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, OR: meses.map((m) => ({ year: m.ano, month: m.mes })) },
      select: { year: true, month: true, parentCategory: true, customCategoryId: true, plannedAmount: true },
    }),
  ]);

  const mesCorrente = hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes;
  const diaDeHoje = mesCorrente ? hoje.getDate() : new Date(ano, mes, 0).getDate();
  const diasNoMes = new Date(ano, mes, 0).getDate();
  // Sem data (compra de fatura, lançamento "do mês"): conta no dia 1, é gasto que já existe.
  const diaDe = (d: Date | null) => (d ? d.getUTCDate() : 1);

  const porDia = new Array(diasNoMes).fill(0);
  const maiorDoDia = new Map<number, { descricao: string; valor: number }>();
  const porCategoria: DetalheDoOrcamento["porCategoria"] = {};
  const agrupado = new Map<string, Map<string, { valor: number; vezes: number }>>();
  for (const e of doMes) {
    const valor = Number(e.amount);
    const dia = diaDe(e.entryDate);
    const k = chave(e);
    const cat = (porCategoria[k] ??= { gasto: 0, aVencer: 0, maiores: [] });
    if (dia > diaDeHoje) {
      cat.aVencer += valor;
      continue;
    }
    cat.gasto += valor;
    porDia[dia - 1] += valor;
    const desc = (e.description ?? "Sem descrição").trim();
    if (valor > (maiorDoDia.get(dia)?.valor ?? 0)) maiorDoDia.set(dia, { descricao: desc, valor });
    const g = agrupado.get(k) ?? new Map();
    const atual = g.get(desc) ?? { valor: 0, vezes: 0 };
    g.set(desc, { valor: atual.valor + valor, vezes: atual.vezes + 1 });
    agrupado.set(k, g);
  }
  for (const [k, g] of agrupado) {
    porCategoria[k].maiores = [...g.entries()]
      .map(([descricao, v]) => ({ descricao, valor: Math.round(v.valor * 100) / 100, vezes: v.vezes }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 3);
  }

  const acumulado: number[] = [];
  let soma = 0;
  for (let i = 0; i < diaDeHoje; i++) acumulado.push((soma += porDia[i]));

  const porDiaAnterior = new Array(new Date(anterior.getFullYear(), anterior.getMonth() + 1, 0).getDate()).fill(0);
  for (const e of doAnterior) porDiaAnterior[Math.min(diaDe(e.entryDate), porDiaAnterior.length) - 1] += Number(e.amount);
  let somaAnt = 0;
  const acumuladoAnterior = porDiaAnterior.map((v) => (somaAnt += v));

  // O dia em que o gasto mais saltou (fora o dia 1, que junta o que não tem data).
  let marco: DetalheDoOrcamento["marco"] = null;
  for (let d = 2; d <= diaDeHoje; d++) {
    if (porDia[d - 1] > (marco ? porDia[marco.dia - 1] : 0)) {
      const maior = maiorDoDia.get(d);
      if (maior) marco = { dia: d, descricao: maior.descricao, valor: maior.valor };
    }
  }

  const historico = meses.map((m) => {
    const cats: Record<string, { gasto: number; planejado: number }> = {};
    for (const g of gastos6) if (g.year === m.ano && g.month === m.mes) (cats[chave(g)] ??= { gasto: 0, planejado: 0 }).gasto += Number(g._sum.amount ?? 0);
    for (const b of planos6) if (b.year === m.ano && b.month === m.mes) (cats[chave(b)] ??= { gasto: 0, planejado: 0 }).planejado += Number(b.plannedAmount);
    return { ano: m.ano, mes: m.mes, porCategoria: cats };
  });

  return { acumulado, acumuladoAnterior, marco, porCategoria, historico };
}
