import type { ParentCategory, ProfileKind } from "@prisma/client";
import { categoryLabel } from "@/lib/categories";

export type Alert = { key: string; title: string; body: string; url: string };

type Money = (v: number) => string;

/**
 * Avisos de orçamento no meio do mês. Dois tipos, um aviso por categoria por mês em cada:
 * - 80% do planejado gasto com pelo menos 5 dias pela frente ("vai estourar se seguir assim");
 * - estourou (passou do planejado).
 * A chave leva ano-mês, categoria e nível: o cron pode rodar todo dia sem repetir.
 *
 * "Estourou" é gasto MAIOR que o plano, igual ao resto do app (compareCategoryBudget marca
 * DENTRO quando bate exato, e Análises usa percent > 1). Com `>=`, o aluguel de R$ 2.000 num
 * orçamento de R$ 2.000 mandava "Moradia estourou" no dia 1 enquanto o painel dizia DENTRO.
 *
 * O nível de 80% desconta dos dois lados o que já estava lançado ANTES do mês começar (o
 * aluguel com "Repetir até dezembro", as parcelas criadas pela importação da fatura): é conta
 * marcada, não ritmo de gasto — a mesma regra de ritmoDoMes e do Foco. Sem isso, o aluguel de
 * R$ 1.800 num plano de R$ 2.000 dava "Moradia já usou 90%" no dia 1.
 */
export function buildBudgetAlerts(input: {
  year: number;
  month: number;
  today: Date;
  planned: { parentCategory: ParentCategory; planned: number }[];
  spent: { parentCategory: ParentCategory; spent: number }[];
  /** Parte de `spent` criada antes do mês começar (conta fixa pré-lançada), por categoria. */
  preCriado?: { parentCategory: ParentCategory; spent: number }[];
  money: Money;
  /** Tipo do perfil de quem recebe: numa Empresa o aviso fala de "Estrutura", não de "Moradia". */
  kind?: ProfileKind | string | null;
}): Alert[] {
  const ym = `${input.year}-${String(input.month).padStart(2, "0")}`;
  const daysInMonth = new Date(input.year, input.month, 0).getDate();
  const daysLeft = daysInMonth - input.today.getDate();
  const spentBy = new Map(input.spent.map((s) => [s.parentCategory, s.spent]));
  const preCriadoBy = new Map((input.preCriado ?? []).map((s) => [s.parentCategory, s.spent]));
  const out: Alert[] = [];
  for (const p of input.planned) {
    if (p.planned <= 0) continue;
    const spent = spentBy.get(p.parentCategory) ?? 0;
    const label = categoryLabel(input.kind, p.parentCategory);
    const url = `/mensal/${input.year}/${input.month}`;
    // Ritmo do 80%: só o que correu DENTRO do mês contra o que sobrou do plano depois das contas
    // marcadas. Se as contas marcadas já tomam o plano inteiro, não há ritmo pra medir.
    const fixo = Math.max(0, Math.min(preCriadoBy.get(p.parentCategory) ?? 0, spent));
    const planoVariavel = p.planned - fixo;
    const ritmo = planoVariavel > 0 ? (spent - fixo) / planoVariavel : 0;
    if (spent > p.planned) {
      out.push({
        key: `${ym}:${p.parentCategory}:100`,
        title: `${label} estourou`,
        body: `${input.money(spent)} de ${input.money(p.planned)} planejados${daysLeft > 0 ? `, e ainda faltam ${daysLeft} dias` : ""}.`,
        url,
      });
    } else if (ritmo >= 0.8 && daysLeft >= 5) {
      out.push({
        key: `${ym}:${p.parentCategory}:80`,
        // A porcentagem do título é a do plano inteiro (a que aparece nas outras telas); o
        // desconto das contas marcadas só decide SE avisa.
        title: `${label} já usou ${Math.round((spent / p.planned) * 100)}%`,
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
