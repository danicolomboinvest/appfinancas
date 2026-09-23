"use client";

import { useId, useState, useTransition } from "react";
import type { ParentCategory } from "@prisma/client";
import { PARENT_CATEGORIES, OUTRO_SUBCATEGORY_LABEL, categoryLabel, subcategoriesFor, incomeTypesFor, investmentTypesFor } from "@/lib/categories";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { CONTROL_CLASSES } from "@/components/ui/Field";
import { createCategoryAction } from "@/lib/actions/category";
import { classify } from "@/lib/import/classify";

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
          ? "border-accent bg-accent-soft text-accent-strong"
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
 * de dropdown, inclui sugestão das subcategorias mais usadas recentemente e um chip "Outro"
 * com texto livre. Publica os valores via inputs escondidos (category/parentCategory/subcategory)
 * para funcionar dentro de um <form action={serverAction}> nativo.
 */
export function CategoryFields({
  recentSubcategories = {},
  customCategories = [],
  stacked = false,
  defaultCategory = "EXPENSE",
  defaultParentCategory,
  defaultSubcategory,
  descriptionHint = "",
}: {
  /** Subcategorias mais usadas recentemente, por categoria-mãe, só as da categoria-mãe
   * selecionada no momento são exibidas, pra não sugerir algo de outra categoria. */
  recentSubcategories?: Partial<Record<ParentCategory, string[]>>;
  /** Categorias personalizadas do usuário, exibidas como chips extras ao lado das 7 padrão. */
  customCategories?: { id: string; name: string }[];
  stacked?: boolean;
  defaultCategory?: string;
  defaultParentCategory?: ParentCategory;
  defaultSubcategory?: string;
  /** O que a pessoa digitou na descrição: "ifood" já marca Alimentação › Delivery sozinho. */
  descriptionHint?: string;
}) {
  const selectId = useId();
  // Os rótulos, subcategorias e chips de tipo mudam com o perfil: numa Empresa, MORADIA é
  // "Estrutura" e a renda é "Vendas", não "Salário". A chave gravada no banco é a mesma.
  const { kind } = useProfileTheme();
  const [category, setCategory] = useState(defaultCategory);
  const [parentCategory, setParentCategory] = useState<ParentCategory | undefined>(defaultParentCategory);
  const [customCategoryId, setCustomCategoryId] = useState<string | undefined>(undefined);
  const initialIsOutro =
    defaultSubcategory !== undefined &&
    defaultParentCategory !== undefined &&
    !subcategoriesFor(kind, defaultParentCategory)?.includes(defaultSubcategory);
  const [subcategory, setSubcategory] = useState<string | undefined>(
    initialIsOutro ? undefined : defaultSubcategory,
  );
  const [isOutro, setIsOutro] = useState(initialIsOutro);
  const [customText, setCustomText] = useState(initialIsOutro ? (defaultSubcategory ?? "") : "");

  const isExpense = category === "EXPENSE";
  const [freeSubcategory, setFreeSubcategory] = useState(!isExpense ? (defaultSubcategory ?? "") : "");
  const freeTypes = category === "INCOME" ? incomeTypesFor(kind) : investmentTypesFor(kind);

  // Adivinha a categoria pela descrição enquanto a pessoa digita, com o mesmo classificador
  // do extrato importado. Só preenche o que ela ainda não escolheu com o dedo: um toque em
  // qualquer chip apaga a marca de "sugerido" e o app para de mexer.
  const [guessed, setGuessed] = useState(false);
  const [lastHint, setLastHint] = useState("");
  if (descriptionHint !== lastHint) {
    setLastHint(descriptionHint);
    const untouched = isExpense && !customCategoryId && (parentCategory === undefined || guessed);
    if (untouched) {
      const hit = descriptionHint.trim().length >= 3 ? classify(descriptionHint) : null;
      if (hit) {
        setParentCategory(hit.parentCategory);
        setSubcategory(hit.subcategory);
        setIsOutro(false);
        setGuessed(true);
      } else if (guessed) {
        setParentCategory(undefined);
        setSubcategory(undefined);
        setGuessed(false);
      }
    }
  }
  const finalSubcategory = customCategoryId ? customText : isOutro ? customText : subcategory;

  // Item 5, criar a categoria-mãe na hora, quando a que a pessoa quer ainda não existe.
  const [extraCategories, setExtraCategories] = useState<{ id: string; name: string }[]>([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();
  const allCustomCategories = [...customCategories, ...extraCategories];

  function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreateError(null);
    startCreate(async () => {
      const res = await createCategoryAction(name);
      if (!res.ok) {
        setCreateError(res.error);
        return;
      }
      setExtraCategories((prev) =>
        prev.some((c) => c.id === res.id) ? prev : [...prev, { id: res.id, name: res.name }],
      );
      // Já seleciona a categoria recém-criada pra a pessoa seguir o lançamento.
      setCustomCategoryId(res.id);
      setParentCategory(undefined);
      setSubcategory(undefined);
      setIsOutro(false);
      setCustomText("");
      setNewCategoryName("");
      setAddingCategory(false);
    });
  }

  return (
    <div className={stacked ? "flex w-full flex-col gap-3" : "flex flex-wrap items-start gap-3"}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-xs font-medium text-ink-muted">
          O que é
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
          <span className="text-xs font-medium text-ink-muted">
            Categoria
            {guessed && parentCategory && <span className="ml-2 font-normal text-accent-strong">sugerida pela descrição</span>}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PARENT_CATEGORIES.map((pc) => (
              <Chip
                key={pc}
                label={categoryLabel(kind, pc)}
                active={parentCategory === pc}
                onClick={() => {
                  setParentCategory(pc);
                  setCustomCategoryId(undefined);
                  setSubcategory(undefined);
                  setIsOutro(false);
                  setGuessed(false);
                }}
              />
            ))}
            {allCustomCategories.map((cc) => (
              <Chip
                key={cc.id}
                label={cc.name}
                active={customCategoryId === cc.id}
                onClick={() => {
                  setCustomCategoryId(cc.id);
                  setParentCategory(undefined);
                  setSubcategory(undefined);
                  setIsOutro(false);
                  setCustomText("");
                  setGuessed(false);
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                setAddingCategory((v) => !v);
                setCreateError(null);
              }}
              className="rounded-full border border-dashed border-border-strong bg-transparent px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
            >
              + Nova
            </button>
          </div>
          {addingCategory && (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateCategory();
                    }
                  }}
                  placeholder="Nome da nova categoria"
                  autoFocus
                  className={`${CONTROL_CLASSES} ${stacked ? "w-full" : "w-56"}`}
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={creating || !newCategoryName.trim()}
                  className="shrink-0 rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-strong transition-opacity disabled:opacity-50"
                >
                  {creating ? "Criando…" : "Criar"}
                </button>
              </div>
              {createError && <span className="text-[11px] text-danger">{createError}</span>}
            </div>
          )}
        </div>
      )}

      {isExpense && customCategoryId && (
        <div className={`flex flex-col gap-1.5 ${stacked ? "w-full" : ""}`}>
          <label className="text-xs font-medium text-ink-muted">Tipo (opcional)</label>
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Ex.: ração, banho e tosa"
            className={`${CONTROL_CLASSES} ${stacked ? "w-full" : "w-48"}`}
          />
        </div>
      )}

      {/* "Tipo", não "subcategoria": é o que o gasto É (restaurante, delivery, padaria).
          O nome do lugar vai na descrição, que é livre e opcional. */}
      {isExpense && parentCategory && (
        <div className={`flex flex-col gap-2 ${stacked ? "w-full" : ""}`}>
          <span className="text-xs font-medium text-ink-muted">Tipo</span>
          {(recentSubcategories[parentCategory]?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-ink-faint">Usadas recentemente:</span>
              {recentSubcategories[parentCategory]!.map((s) => (
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
            {subcategoriesFor(kind, parentCategory).map((s) => (
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
              placeholder="Que tipo de gasto é?"
              className={`${CONTROL_CLASSES} ${stacked ? "w-full" : "w-48"}`}
            />
          )}
        </div>
      )}

      {!isExpense && (
        <div className={`flex flex-col gap-2 ${stacked ? "w-full" : ""}`}>
          <span className="text-xs font-medium text-ink-muted">Tipo</span>
          <div className="flex flex-wrap gap-1.5">
            {freeTypes.map((t) => (
              <Chip key={t} label={t} active={freeSubcategory === t} onClick={() => setFreeSubcategory(t)} />
            ))}
            <Chip
              label={OUTRO_SUBCATEGORY_LABEL}
              active={freeSubcategory !== "" && !freeTypes.includes(freeSubcategory)}
              onClick={() => setFreeSubcategory(" ")}
            />
          </div>
          {freeSubcategory !== "" && !freeTypes.includes(freeSubcategory) && (
            <input
              type="text"
              value={freeSubcategory.trim()}
              onChange={(e) => setFreeSubcategory(e.target.value || " ")}
              placeholder={category === "INCOME" ? "Ex.: venda de um móvel" : "Ex.: consórcio"}
              autoFocus
              className={`${CONTROL_CLASSES} ${stacked ? "w-full" : ""}`}
            />
          )}
        </div>
      )}

      <input type="hidden" name="parentCategory" value={isExpense ? (parentCategory ?? "") : ""} />
      <input type="hidden" name="customCategoryId" value={isExpense ? (customCategoryId ?? "") : ""} />
      <input type="hidden" name="subcategory" value={isExpense ? (finalSubcategory ?? "") : freeSubcategory.trim()} />
    </div>
  );
}
