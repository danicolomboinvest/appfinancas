import type { ParentCategory } from "@prisma/client";
import { PARENT_CATEGORY_LABEL } from "@/lib/categories";

export type Alert = { key: string; title: string; body: string; url: string };

type Money = (v: number) => string;

/**
 * Avisos de orçamento no meio do mês. Dois tipos, um aviso por categoria por mês em cada:
 * - 80% do planejado gasto com pelo menos 5 dias pela frente ("vai estourar se seguir assim");
 * - estourou (100%+).
 * A chave leva ano-mês, categoria e nível: o cron pode rodar todo dia sem repetir.
 */
export function buildBudgetAlerts(input: {
  year: number;
  month: number;
  today: Date;
  planned: { parentCategory: ParentCategory; planned: number }[];
  spent: { parentCategory: ParentCategory; spent: number }[];
  money: Money;
}): Alert[] {
  const ym = `${input.year}-${String(input.month).padStart(2, "0")}`;
  const daysInMonth = new Date(input.year, input.month, 0).getDate();
  const daysLeft = daysInMonth - input.today.getDate();
  const spentBy = new Map(input.spent.map((s) => [s.parentCategory, s.spent]));
  const out: Alert[] = [];
  for (const p of input.planned) {
    if (p.planned <= 0) continue;
    const spent = spentBy.get(p.parentCategory) ?? 0;
    const ratio = spent / p.planned;
    const label = PARENT_CATEGORY_LABEL[p.parentCategory];
    const url = `/mensal/${input.year}/${input.month}`;
    if (ratio >= 1) {
      out.push({
        key: `${ym}:${p.parentCategory}:100`,
        title: `${label} estourou`,
        body: `${input.money(spent)} de ${input.money(p.planned)} planejados${daysLeft > 0 ? `, e ainda faltam ${daysLeft} dias` : ""}.`,
        url,
      });
    } else if (ratio >= 0.8 && daysLeft >= 5) {
      out.push({
        key: `${ym}:${p.parentCategory}:80`,
        title: `${label} já usou ${Math.round(ratio * 100)}%`,
        body: `Faltam ${daysLeft} dias e sobram ${input.money(p.planned - spent)} do planejado.`,
        url,
      });
    }
  }
  return out;
}

export function buildGoalAlerts(input: { year: number; month: number; goals: { id: string; name: string; behind: boolean; monthly: number }[]; money: Money }): Alert[] {
  const ym = `${input.year}-${String(input.month).padStart(2, "0")}`;
  return input.goals
    .filter((g) => g.behind)
    .map((g) => ({
      key: `${ym}:goal:${g.id}`,
      title: `"${g.name}" ficou pra trás`,
      body: g.monthly > 0 ? `Pra voltar ao ritmo, guarde ${input.money(g.monthly)} este mês.` : "Revise o prazo ou o valor da meta.",
      url: `/planejamento/metas/${g.id}`,
    }));
}
