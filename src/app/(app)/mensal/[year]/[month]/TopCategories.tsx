import { Receipt } from "lucide-react";
import type { CategorySpending } from "@/lib/consolidation/month-analysis";
import { Card } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import {
  PARENT_CATEGORY_ICON,
  CUSTOM_CATEGORY_ICON_MAP,
  colorForCategorySlice,
  isParentCategoryKey,
} from "@/lib/categories";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Ranking não precisa ser infinito: as 5 primeiras já explicam a maior parte do mês, e a lista
 * completa continua a um toque de distância em "Só gastos". */
const TOP_COUNT = 5;

/**
 * "Para onde foi o dinheiro", em ordem. A rosca ao lado mostra a proporção; esta lista mostra
 * o nome, o valor e — o que faltava — se cada categoria subiu ou caiu em relação ao mês
 * passado. Sem essa última coluna a pessoa vê onde gastou, mas não descobre o que mudou.
 */
export function TopCategories({ categories }: { categories: CategorySpending[] }) {
  if (categories.length === 0) return null;
  const top = categories.slice(0, TOP_COUNT);
  const rest = categories.length - top.length;
  const maxAmount = top[0].amount;

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-ink">Maiores gastos do mês</h2>
        {rest > 0 && <p className="text-caption text-ink-faint">+{rest} categoria{rest === 1 ? "" : "s"}</p>}
      </div>

      <ul className="flex flex-col">
        {top.map((category, index) => {
          const icon =
            category.kind === "parent" && isParentCategoryKey(category.key)
              ? PARENT_CATEGORY_ICON[category.key]
              : (CUSTOM_CATEGORY_ICON_MAP[category.iconKey ?? ""] ?? Receipt);
          const color = colorForCategorySlice({ kind: category.kind, value: category.key });
          return (
            <li key={`${category.kind}:${category.key}`} className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0">
              <span className="w-3 shrink-0 text-caption tabular-nums text-ink-faint">{index + 1}</span>
              <CategoryIcon icon={icon} color={color} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{category.label}</p>
                {/* Barra proporcional ao maior gasto: dá a comparação de relance, sem precisar
                    ler os números um por um. */}
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(category.amount / maxAmount) * 100}%`, backgroundColor: color }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium tabular-nums text-ink">{formatBRL(category.amount)}</p>
                <p className="text-caption tabular-nums text-ink-faint">
                  {Math.round(category.share * 100)}%
                  {category.changeRatio !== null && Math.abs(category.changeRatio) >= 0.08 && (
                    <span className={category.changeRatio > 0 ? " text-danger" : " text-success"}>
                      {" · "}
                      {category.changeRatio > 0 ? "↑" : "↓"}
                      {Math.round(Math.abs(category.changeRatio) * 100)}%
                    </span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-caption text-ink-faint">
        A seta compara com o mês passado. Variação abaixo de 8% não aparece — é oscilação normal.
      </p>
    </Card>
  );
}
