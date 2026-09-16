"use client";

import { Donut, type DonutSlice } from "./Donut";
import { colorForCategorySlice } from "@/lib/categories";

export type SpendingSlice = {
  name: string;
  value: number;
  /** Referência da categoria (para abrir os lançamentos ao clicar). */
  category?: { kind: "parent" | "custom"; value: string };
  /** Quanto essa categoria gastou no período ANTERIOR, quando fizer sentido comparar (só o mês). */
  previousValue?: number;
};

/**
 * Gastos por categoria. Hoje é só a rosca única do app vestida de gastos — a cor vem de
 * `colorForCategorySlice`, que é fixa por categoria em todas as telas: Moradia é a mesma cor
 * aqui, no orçamento e no resumo do mês, então a pessoa aprende a cor uma vez.
 */
export function SpendingPieChart({
  data,
  onSelect,
  selectedName,
}: {
  data: SpendingSlice[];
  /** Quando presente, cada fatia/linha vira clicável (abre os lançamentos da categoria). */
  onSelect?: (slice: SpendingSlice) => void;
  selectedName?: string | null;
}) {
  const slices: DonutSlice[] = data
    .filter((d) => d.value > 0)
    .map((d) => ({
      name: d.name,
      value: d.value,
      color: colorForCategorySlice(d.category),
      meta: d,
    }));

  return (
    <Donut
      slices={slices}
      centerLabel="Gastos"
      size={200}
      selectedName={selectedName}
      emptyMessage="Nenhum gasto neste período."
      onSelect={onSelect ? (slice) => onSelect(slice.meta as SpendingSlice) : undefined}
    />
  );
}
