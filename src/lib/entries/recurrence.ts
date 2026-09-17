import type { EntryCategory, ParentCategory } from "@prisma/client";

export type RecurrenceEntry = {
  year: number;
  month: number;
  category: EntryCategory;
  parentCategory: ParentCategory | null;
  customCategoryId: string | null;
  subcategory: string | null;
  description: string | null;
  amount: number;
  entryDate: Date | null;
};

export type RecurringCandidate = {
  key: string;
  category: EntryCategory;
  parentCategory: ParentCategory | null;
  customCategoryId: string | null;
  subcategory: string | null;
  description: string | null;
  amount: number;
  /** Dia do mês em que costuma cair (mediana dos meses anteriores), ou null sem data. */
  typicalDay: number | null;
  /** Em quantos dos meses olhados apareceu. */
  seenInMonths: number;
};

function norm(s: string | null): string {
  return (s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function recurrenceKey(e: Omit<RecurrenceEntry, "year" | "month" | "entryDate">): string {
  return [e.category, e.parentCategory ?? "", e.customCategoryId ?? "", norm(e.subcategory), norm(e.description), Math.round(e.amount)].join("|");
}

/**
 * O que parece se repetir todo mês e ainda não foi lançado neste: mesma categoria, mesmo
 * tipo, mesma descrição e o mesmo valor (arredondado ao real) em pelo menos dois dos últimos
 * três meses. Aluguel, academia, streaming, salário. O app sugere; a pessoa confirma.
 */
export function detectRecurring(previous: RecurrenceEntry[], current: RecurrenceEntry[], minMonths = 2): RecurringCandidate[] {
  const currentKeys = new Set(current.map(recurrenceKey));
  const groups = new Map<string, { months: Set<string>; days: number[]; sample: RecurrenceEntry }>();
  for (const e of previous) {
    const key = recurrenceKey(e);
    const g = groups.get(key) ?? { months: new Set<string>(), days: [], sample: e };
    g.months.add(`${e.year}-${e.month}`);
    if (e.entryDate) g.days.push(e.entryDate.getDate());
    g.sample = e;
    groups.set(key, g);
  }
  const out: RecurringCandidate[] = [];
  for (const [key, g] of groups) {
    if (g.months.size < minMonths || currentKeys.has(key)) continue;
    const days = [...g.days].sort((a, b) => a - b);
    out.push({
      key,
      category: g.sample.category,
      parentCategory: g.sample.parentCategory,
      customCategoryId: g.sample.customCategoryId,
      subcategory: g.sample.subcategory,
      description: g.sample.description,
      amount: g.sample.amount,
      typicalDay: days.length ? days[Math.floor(days.length / 2)] : null,
      seenInMonths: g.months.size,
    });
  }
  return out.sort((a, b) => b.seenInMonths - a.seenInMonths || b.amount - a.amount).slice(0, 6);
}

/** "3/10", "03/10", "parcela 3 de 10" numa descrição de fatura → { current: 3, total: 10 }. */
export function parseInstallment(description: string | null): { current: number; total: number } | null {
  if (!description) return null;
  const m = description.match(/(?:^|\D)(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})(?!\d)/i);
  if (!m) return null;
  const current = Number(m[1]);
  const total = Number(m[2]);
  if (!(current >= 1 && total >= 2 && current <= total && total <= 48)) return null;
  return { current, total };
}

/** Reescreve "3/10" como "4/10" na descrição da parcela seguinte. */
export function installmentDescription(description: string, current: number, total: number): string {
  return description.replace(/(?:^|\D)(\d{1,2})\s*(\/|de)\s*(\d{1,2})(?!\d)/i, (whole, _c, sep) =>
    whole.replace(/\d{1,2}\s*(\/|de)\s*\d{1,2}/i, `${String(current).padStart(2, "0")}${sep === "/" ? "/" : " de "}${total}`),
  );
}
