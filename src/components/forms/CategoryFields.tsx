"use client";

import { useId, useState } from "react";
import type { ParentCategory } from "@prisma/client";
import { PARENT_CATEGORIES, PARENT_CATEGORY_LABEL, SUBCATEGORIES, OUTRO_SUBCATEGORY_LABEL } from "@/lib/categories";
import { CONTROL_CLASSES } from "@/components/ui/Field";

const CATEGORY_OPTIONS = [
  { value: "INCOME", label: "Renda" },
  { value: "EXPENSE", label: "Gasto" },
  { value: "INVESTMENT_CONTRIBUTION", label: "Aporte" },
];

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-gold bg-gold-soft text-gold-strong"
          : "border-border-strong bg-surface-2 text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Campos de categorização de um lançamento: nível 1 (Renda/Gasto/Aporte, select) e, quando
 * "Gasto" é selecionado, o nível 2 (categoria-mãe + subcategoria) via chips clicáveis em vez
 * de dropdown — inclui sugestão das subcategorias mais usadas recentemente e um chip "Outro"
 * com texto livre. Publica os valores via inputs escondidos (category/parentCategory/subcategory)
 * para funcionar dentro de um <form action={serverAction}> nativo.
 */
export function CategoryFields({
  recentSubcategories = [],
  stacked = false,
  defaultCategory = "EXPENSE",
  defaultParentCategory,
  defaultSubcategory,
}: {
  recentSubcategories?: string[];
  stacked?: boolean;
  defaultCategory?: string;
  defaultParentCategory?: ParentCategory;
  defaultSubcategory?: string;
}) {
  const selectId = useId();
  const [category, setCategory] = useState(defaultCategory);
  const [parentCategory, setParentCategory] = useState<ParentCategory | undefined>(defaultParentCategory);
  const initialIsOutro =
    defaultSubcategory !== undefined &&
    defaultParentCategory !== undefined &&
    !SUBCATEGORIES[defaultParentCategory]?.includes(defaultSubcategory);
  const [subcategory, setSubcategory] = useState<string | undefined>(
    initialIsOutro ? undefined : defaultSubcategory,
  );
  const [isOutro, setIsOutro] = useState(initialIsOutro);
  const [customText, setCustomText] = useState(initialIsOutro ? (defaultSubcategory ?? "") : "");

  const isExpense = category === "EXPENSE";
  const [freeSubcategory, setFreeSubcategory] = useState(!isExpense ? (defaultSubcategory ?? "") : "");
  const finalSubcategory = isOutro ? customText : subcategory;

  return (
    <div className={stacked ? "flex w-full flex-col gap-3" : "flex flex-wrap items-start gap-3"}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-xs font-medium text-ink-muted">
          Categoria
        </label>
        <select
          id={selectId}
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`${CONTROL_CLASSES} ${stacked ? "w-full" : ""}`}
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isExpense && (
        <div className={`flex flex-col gap-2 ${stacked ? "w-full" : ""}`}>
          <span className="text-xs font-medium text-ink-muted">Categoria-mãe</span>
          <div className="flex flex-wrap gap-1.5">
            {PARENT_CATEGORIES.map((pc) => (
              <Chip
                key={pc}
                label={PARENT_CATEGORY_LABEL[pc]}
                active={parentCategory === pc}
                onClick={() => {
                  setParentCategory(pc);
                  setSubcategory(undefined);
                  setIsOutro(false);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {isExpense && parentCategory && (
        <div className={`flex flex-col gap-2 ${stacked ? "w-full" : ""}`}>
          <span className="text-xs font-medium text-ink-muted">Subcategoria</span>
          {recentSubcategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-ink-faint">Usadas recentemente:</span>
              {recentSubcategories.map((s) => (
                <Chip
                  key={`recent-${s}`}
                  label={s}
                  active={!isOutro && subcategory === s}
                  onClick={() => {
                    setSubcategory(s);
                    setIsOutro(false);
                  }}
                />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {SUBCATEGORIES[parentCategory].map((s) => (
              <Chip
                key={s}
                label={s}
                active={!isOutro && subcategory === s}
                onClick={() => {
                  setSubcategory(s);
                  setIsOutro(false);
                }}
              />
            ))}
            <Chip label={OUTRO_SUBCATEGORY_LABEL} active={isOutro} onClick={() => setIsOutro(true)} />
          </div>
          {isOutro && (
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Descreva a subcategoria"
              className={`${CONTROL_CLASSES} ${stacked ? "w-full" : "w-48"}`}
            />
          )}
        </div>
      )}

      {!isExpense && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-muted">Subcategoria</label>
          <input
            type="text"
            value={freeSubcategory}
            onChange={(e) => setFreeSubcategory(e.target.value)}
            placeholder="Ex.: Salário"
            className={`${CONTROL_CLASSES} ${stacked ? "w-full" : ""}`}
          />
        </div>
      )}

      <input type="hidden" name="parentCategory" value={isExpense ? (parentCategory ?? "") : ""} />
      <input type="hidden" name="subcategory" value={isExpense ? (finalSubcategory ?? "") : freeSubcategory} />
    </div>
  );
}
