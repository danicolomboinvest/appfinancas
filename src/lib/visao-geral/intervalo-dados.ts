import type { Dia, Intervalo } from "./periodo";
import { ultimoDia } from "./periodo";

/**
 * Que lançamentos entram num período que não é um mês (Últimos 7 dias, trimestre, personalizado).
 * Com dia: entra se o dia está dentro. Sem dia (lançamento só com mês): entra só se o mês inteiro
 * está dentro do período, porque não dá para saber em que dia caiu.
 */
type ComData = { year: number; month: number; entryDate: Date | null };

const ordem = (d: Dia) => d.ano * 10000 + d.mes * 100 + d.dia;

/** Os meses que o período toca, do primeiro ao último. */
export function mesesDoIntervalo(i: Intervalo): { year: number; month: number }[] {
  const r: { year: number; month: number }[] = [];
  let a = i.de.ano;
  let m = i.de.mes;
  while (a * 12 + m <= i.ate.ano * 12 + i.ate.mes) {
    r.push({ year: a, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return r;
}

function mesInteiroDentro(year: number, month: number, i: Intervalo): boolean {
  return ordem({ ano: year, mes: month, dia: 1 }) >= ordem(i.de) && ordem({ ano: year, mes: month, dia: ultimoDia(year, month) }) <= ordem(i.ate);
}

export function dentroDoIntervalo(e: ComData, i: Intervalo): boolean {
  if (!e.entryDate) return mesInteiroDentro(e.year, e.month, i);
  // entryDate é @db.Date: vem como meia-noite UTC.
  const lida = { ano: e.entryDate.getUTCFullYear(), mes: e.entryDate.getUTCMonth() + 1, dia: e.entryDate.getUTCDate() };
  // Data de um mês antes do mês em que conta (o salário de 30/09 que ela contou em outubro, a
  // compra de 29/09 na fatura de outubro): vale o dia 1 do mês dele. Antes sumia dos dois lados,
  // fora de "1 a 14 out" (a data é de setembro) e fora de setembro (está gravado em outubro).
  const d = lida.ano * 12 + lida.mes < e.year * 12 + e.month ? { ano: e.year, mes: e.month, dia: 1 } : lida;
  return ordem(d) >= ordem(i.de) && ordem(d) <= ordem(i.ate);
}

type ComValor = { category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION"; amount: unknown };

/** Entrou, Gastou e Guardou do período (a mesma conta do mês). */
export function somaDoIntervalo(entries: ComValor[]) {
  let totalIncome = 0;
  let totalExpense = 0;
  let totalInvestment = 0;
  for (const e of entries) {
    const v = Number(e.amount);
    if (e.category === "INCOME") totalIncome += v;
    else if (e.category === "EXPENSE") totalExpense += v;
    else totalInvestment += v;
  }
  const r = (v: number) => Math.round(v * 100) / 100;
  return { totalIncome: r(totalIncome), totalExpense: r(totalExpense), totalInvestment: r(totalInvestment), balance: r(totalIncome - totalExpense - totalInvestment) };
}

/** Gasto por categoria (a personalizada manda; sem nenhuma, "OTHER"), do maior para o menor. */
export function gastoPorCategoria(entries: { category: string; amount: unknown; parentCategory: string | null; customCategoryId: string | null }[]) {
  const soma = new Map<string, number>();
  for (const e of entries) {
    if (e.category !== "EXPENSE") continue;
    const k = e.customCategoryId ?? e.parentCategory ?? "OTHER";
    soma.set(k, (soma.get(k) ?? 0) + Number(e.amount));
  }
  return [...soma.entries()].map(([key, gasto]) => ({ key, gasto: Math.round(gasto * 100) / 100 })).filter((c) => c.gasto > 0).sort((a, b) => b.gasto - a.gasto);
}

/**
 * Plano e gasto de cada categoria somados nos meses do período (meses inteiros). Mês que não
 * tinha plano (antes de ela montar o orçamento) fica fora da comparação: o gasto dele não é
 * cobrado de um plano que não existia, e aparece à parte em `semPlano`.
 */
export function planoDoIntervalo(
  anos: { year: number; months: { month: number; categories: { categoryKey: string; planned: number; spent: number }[] }[] }[],
  meses: { year: number; month: number }[],
) {
  const porChave = new Map<string, { planejado: number; gasto: number }>();
  const semPlano: { year: number; month: number; gasto: number }[] = [];
  for (const { year, month } of meses) {
    const m = anos.find((a) => a.year === year)?.months.find((x) => x.month === month);
    const cats = m?.categories ?? [];
    if (!cats.some((c) => c.planned > 0)) {
      semPlano.push({ year, month, gasto: cats.reduce((s, c) => s + c.spent, 0) });
      continue;
    }
    for (const c of cats) {
      const atual = porChave.get(c.categoryKey) ?? { planejado: 0, gasto: 0 };
      porChave.set(c.categoryKey, { planejado: atual.planejado + c.planned, gasto: atual.gasto + c.spent });
    }
  }
  const categorias = [...porChave.entries()].map(([key, v]) => ({ key, ...v })).filter((c) => c.planejado > 0 || c.gasto > 0).sort((a, b) => b.planejado - a.planejado || b.gasto - a.gasto);
  return { categorias, planejado: categorias.reduce((s, c) => s + c.planejado, 0), gasto: categorias.reduce((s, c) => s + c.gasto, 0), semPlano, mesesComPlano: meses.length - semPlano.length };
}
