import type { ParentCategory } from "@prisma/client";

export type InitialCategoryState = {
  parentCategory: ParentCategory | undefined;
  customCategoryId: string | undefined;
  subcategory: string | undefined;
  isOutro: boolean;
  customText: string;
};

/**
 * Estado inicial dos chips de categoria de um gasto, a partir do lançamento que está sendo
 * editado (ou do que veio pré-preenchido pela voz).
 *
 * Gasto de categoria personalizada ("Pet") é gravado com parentCategory nulo e o tipo
 * ("ração") na subcategoria. Sem trazer a categoria personalizada pra cá, a edição abria sem
 * nada marcado: o classificador da descrição "ifood ração" movia o gasto pra Alimentação em
 * silêncio, ou o salvar falhava com "Escolha uma categoria", e o tipo se perdia.
 */
export function initialCategoryState({
  defaultParentCategory,
  defaultCustomCategoryId,
  defaultSubcategory,
  standardSubcategories,
}: {
  defaultParentCategory?: ParentCategory;
  defaultCustomCategoryId?: string;
  defaultSubcategory?: string;
  /** Tipos padrão da categoria-mãe (os chips); o que não estiver aqui é um "Outro" digitado. */
  standardSubcategories?: string[];
}): InitialCategoryState {
  if (defaultCustomCategoryId) {
    return {
      parentCategory: undefined,
      customCategoryId: defaultCustomCategoryId,
      subcategory: undefined,
      isOutro: false,
      customText: defaultSubcategory ?? "",
    };
  }
  const isOutro =
    defaultSubcategory !== undefined &&
    defaultParentCategory !== undefined &&
    !standardSubcategories?.includes(defaultSubcategory);
  return {
    parentCategory: defaultParentCategory,
    customCategoryId: undefined,
    subcategory: isOutro ? undefined : defaultSubcategory,
    isOutro,
    customText: isOutro ? (defaultSubcategory ?? "") : "",
  };
}
