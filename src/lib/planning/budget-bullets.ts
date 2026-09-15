import type { CategoryComparison } from "./budget-comparison";

/**
 * Transforma a comparação por categoria nas linhas da barra-bala, com a ORDEM sendo a parte
 * que importa.
 *
 * A lista era alfabética: Alimentação, Educação, Financeiro, Lazer... ou seja, a categoria
 * prestes a estourar podia estar em sexto lugar, embaixo de cinco que estão tranquilas. Aqui
 * o topo é sempre o que precisa de atenção — primeiro quem já passou do plano (do maior
 * estouro para o menor), depois quem está mais perto de passar, e por último quem nem tem
 * plano definido, que não é urgência, é cadastro faltando.
 */

export type BudgetBulletRow = {
  key: string;
  label: string;
  color: string;
  fillPercent: number;
  targetPercent: number | null;
  rightLabel: string;
  isOver: boolean;
  isUnplanned: boolean;
};

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Quanto do período já passou, de 0 a 1 — é onde o tracinho fica. */
export function elapsedRatioOfMonth(now: Date, year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  const isSameMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  if (!isSameMonth) {
    // Mês passado já acabou (tracinho no fim); mês futuro nem começou (sem tracinho útil).
    const isPast = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
    return isPast ? 1 : 0;
  }
  return now.getDate() / daysInMonth;
}

export type BulletLabelStyle = "de" | "restante";

export function buildBudgetBullets(
  categories: CategoryComparison[],
  options: {
    /** Onde a pessoa "deveria" estar; null tira o tracinho. */
    paceRatio: number | null;
    labelFor: (categoryKey: string) => string;
    colorFor: (categoryKey: string) => string;
    /** "de" → "R$ 2.531 de 3.000"; "restante" → "estourou R$ 18" / "falta R$ 469". */
    labelStyle?: BulletLabelStyle;
    /** Categorias sem plano E sem gasto não viram linha: é ruído, não informação. */
    hideEmpty?: boolean;
  },
): BudgetBulletRow[] {
  const { paceRatio, labelFor, colorFor, labelStyle = "de", hideEmpty = true } = options;

  const rows = categories
    .filter((c) => !hideEmpty || c.planned > 0 || c.spent > 0)
    .map((c) => {
      const isUnplanned = c.planned <= 0;
      const fillPercent = isUnplanned ? 0 : (c.spent / c.planned) * 100;
      const isOver = !isUnplanned && c.spent > c.planned;
      const restante = c.planned - c.spent;

      let rightLabel: string;
      if (isUnplanned) {
        rightLabel = `${formatBRL(c.spent)} · sem plano`;
      } else if (labelStyle === "de") {
        rightLabel = `${formatBRL(c.spent)} de ${formatBRL(c.planned)}`;
      } else {
        rightLabel = isOver ? `estourou ${formatBRL(-restante)}` : `falta ${formatBRL(restante)}`;
      }

      return {
        key: c.categoryKey,
        label: labelFor(c.categoryKey),
        color: colorFor(c.categoryKey),
        fillPercent,
        // Sem plano não tem tracinho: marcar "onde você deveria estar" num limite que não
        // existe é inventar uma régua.
        targetPercent: isUnplanned || paceRatio === null ? null : paceRatio * 100,
        rightLabel,
        isOver,
        isUnplanned,
      };
    });

  return rows.sort((a, b) => {
    // Sem plano sempre por último — não é risco, é cadastro faltando.
    if (a.isUnplanned !== b.isUnplanned) return a.isUnplanned ? 1 : -1;
    return b.fillPercent - a.fillPercent;
  });
}
