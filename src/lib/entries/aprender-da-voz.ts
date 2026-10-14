import type { ParentCategory } from "@prisma/client";
import { padraoAprendivel } from "@/lib/import/classify";
import { chaveParaAprender } from "./vocabulario-falado";

/**
 * Aprender com a correção da voz (14/10/2026). Ela fala "50 reais de ração da Mel", a voz sugere
 * Outros › Pet e ela escolhe "Mel" (a categoria que criou para a cachorra): a regra "racao" →
 * "Mel" fica guardada e a próxima fala com ração já vem certa. Também quando a voz não sugeriu
 * nada e ela escolheu.
 *
 * É a mesma regra da importação (TransactionCategoryRule), então vale também no próximo extrato.
 * Só para termos específicos: "compra", "coisa", "gasto" nunca viram regra (chaveParaAprender e
 * padraoAprendivel). Aceitou a sugestão: nada é gravado.
 */
export type RegraDaVoz = { pattern: string; parentCategory: ParentCategory; subcategory?: string; customCategoryId?: string };

export function regraDaCorrecaoDaVoz(entrada: {
  /** A palavra-chave que o parser tirou da fala (ParsedVoiceEntry.chaveDaFala). */
  chave: string | null | undefined;
  /** O que a voz sugeriu: o id da categoria dela ou a categoria-mãe; vazio quando não sugeriu nada. */
  sugestao: string | null | undefined;
  /** O que ela salvou. */
  parentCategory: ParentCategory | null;
  customCategoryId: string | null;
  subcategory?: string | null;
}): RegraDaVoz | null {
  const escolhida = entrada.customCategoryId || entrada.parentCategory;
  if (!escolhida || escolhida === (entrada.sugestao || null)) return null;
  // A chave vem do aparelho: passa de novo pelo mesmo filtro (genérica não vira regra).
  const pattern = chaveParaAprender(String(entrada.chave ?? "").slice(0, 60));
  if (!pattern || !padraoAprendivel(pattern)) return null;
  if (entrada.customCategoryId) return { pattern, parentCategory: "OUTROS", customCategoryId: entrada.customCategoryId };
  if (!entrada.parentCategory) return null;
  return { pattern, parentCategory: entrada.parentCategory, ...(entrada.subcategory ? { subcategory: entrada.subcategory } : {}) };
}
