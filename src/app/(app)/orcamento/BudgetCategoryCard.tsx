"use client";

import { useState } from "react";
import type { ParentCategory } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { PARENT_CATEGORY_ICON, PARENT_CATEGORY_COLOR } from "@/lib/categories";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Cartão de planejamento de uma categoria padrão, sem form/submit próprio, os campos fazem
 * parte do form único de OrcamentoForm.tsx ("Salvar tudo"). */
export function BudgetCategoryCard({
  parentCategory,
  label,
  description,
  defaultValue,
}: {
  parentCategory: ParentCategory;
  label: string;
  description: string;
  defaultValue: number;
}) {
  const [monthly, setMonthly] = useState(defaultValue);
  const Icon = PARENT_CATEGORY_ICON[parentCategory];
  const color = PARENT_CATEGORY_COLOR[parentCategory];

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <CategoryIcon icon={Icon} color={color} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="text-xs text-ink-faint">{description}</p>
        </div>
      </div>

      <CurrencyField
        label="Quanto pretende gastar por mês?"
        name={`plannedAmount_${parentCategory}`}
        defaultValue={defaultValue}
        onValueChange={setMonthly}
      />

      <p className="text-xs text-ink-muted">
        = <span className="font-medium text-ink">{formatBRL(monthly * 12)}</span> por ano
      </p>
    </Card>
  );
}
