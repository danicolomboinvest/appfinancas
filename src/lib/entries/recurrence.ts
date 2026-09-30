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

/**
 * "3/10", "03/10", "parcela 3 de 10" numa descrição de fatura → { current: 3, total: 10 }.
 *
 * `confident` diz se dá pra AGIR: "POSTO SHELL 03/09" é a data da compra (3 de setembro), não
 * parcela 3 de 9 — e criar as 6 parcelas seguintes inventaria seis gastos que não existem.
 * Só é certeza quando a descrição diz "parcela"/"parc", quando o separador é " de " ("2 de 6"),
 * ou quando o total passa de 12 (mês nenhum é 18). Nos casos ambíguos o lançamento entra
 * normalmente, sem criar nada no futuro: a parcela do mês que vem chega na fatura do mês que vem.
 */
export function parseInstallment(
  description: string | null,
): { current: number; total: number; confident: boolean } | null {
  if (!description) return null;
  const m = findInstallment(description);
  if (!m) return null;
  const { current, total } = m;
  if (!(current >= 1 && total >= 2 && current <= total && total <= 48)) return null;
  const hasWord = /parc(?:ela)?\b|presta[çc][ãa]o/i.test(description);
  const confident = hasWord || /de/i.test(m.sep) || total > 12;
  return { current, total, confident };
}

const INSTALLMENT_RE = /(^|\D)(\d{1,2})(\s*(?:\/|de)\s*)(\d{1,2})(?!\d)/gi;
/** O "N/T" vem logo depois da palavra: "PARCELA 2/10", "PARC 01 DE 12", "Prestação 3/6". */
const WORD_BEFORE_RE = /(?:parc(?:ela)?|presta[çc][ãa]o)\.?:?\s*$/i;

type InstallmentMatch = { index: number; length: number; before: string; c: string; sep: string; t: string; current: number; total: number };

/**
 * QUAL "N/T" da descrição é a parcela. A fatura costuma trazer a data da compra antes
 * ("LOJA 03/09 PARCELA 2/10"): pegar o primeiro lia "3 de 9" com certeza (a palavra "parcela"
 * está lá) e inventava seis parcelas; com "09/06" antes (9 > 6) a parcela de verdade sumia.
 * Ordem: o número logo depois de "parcela"/"parc"; senão o primeiro que É uma parcela possível;
 * senão o primeiro (só pra reescrita, que nunca roda sem parcela válida).
 */
function findInstallment(description: string): InstallmentMatch | null {
  const all: InstallmentMatch[] = [...description.matchAll(INSTALLMENT_RE)].map((m) => ({
    index: m.index,
    length: m[0].length,
    before: m[1],
    c: m[2],
    sep: m[3],
    t: m[4],
    current: Number(m[2]),
    total: Number(m[4]),
  }));
  if (all.length === 0) return null;
  const valid = all.filter((m) => m.current >= 1 && m.total >= 2 && m.current <= m.total && m.total <= 48);
  const afterWord = valid.find((m) => WORD_BEFORE_RE.test(description.slice(0, m.index + m.before.length)));
  return afterWord ?? valid[0] ?? all[0];
}

/** Troca só o "N/T" que é a parcela (o mesmo que parseInstallment leu), sem mexer na data. */
function replaceInstallment(description: string, render: (m: InstallmentMatch) => string): string {
  const m = findInstallment(description);
  if (!m) return description;
  return description.slice(0, m.index) + render(m) + description.slice(m.index + m.length);
}

/**
 * Reescreve "3/10" como "4/10" na descrição da parcela seguinte, no MESMO formato que o banco
 * escreveu: "PARC 03/06" → "PARC 04/06", "Parcela 3/6" → "Parcela 4/6", "2 DE 6" → "3 DE 6".
 * Antes o número atual ganhava sempre zero à esquerda e o total nunca ("PARC 04/6"), e a linha
 * da fatura do mês seguinte ("PARC 04/06") não batia com a parcela já lançada: entrava de novo e
 * recriava as seguintes, uma cópia a mais a cada fatura importada.
 */
export function installmentDescription(description: string, current: number, total: number): string {
  return replaceInstallment(description, ({ before, c, sep, t }) =>
    `${before}${String(current).padStart(c.length, "0")}${sep}${String(total).padStart(t.length, "0")}`,
  );
}

/**
 * A descrição com o "N/T" da parcela escrito de um jeito só ("PARC 04/06" e "PARC 4/6" viram
 * "PARC 4/6"; "04 DE 6" vira "4 de 6"), pra comparar parcelas sem depender de como cada fatura
 * (ou uma versão antiga do app) escreveu os números. O separador continua "/" ou "de" porque é
 * ele que decide se parseInstallment tem certeza — duas descrições iguais aqui têm a mesma
 * certeza. Não mexe no resto do texto.
 */
export function installmentCanonical(description: string): string {
  return replaceInstallment(description, ({ before, c, sep, t }) =>
    `${before}${Number(c)}${/de/i.test(sep) ? " de " : "/"}${Number(t)}`,
  );
}
