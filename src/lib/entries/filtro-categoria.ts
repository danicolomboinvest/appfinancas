/**
 * O filtro "Categoria" das Transações com subcategoria (18/10/2026, a Dani, pedido de uma
 * cliente). A folha "Categorias" guarda chaves: a categoria ("ALIMENTACAO", o id da criada por
 * ela, "SEM" para gasto sem categoria) ou a subcategoria dela ("ALIMENTACAO|Delivery").
 * Marcar só a categoria mostra tudo dela; marcar subcategorias dela mostra só essas. Só a regra,
 * sem tela: para testar.
 */

export const SEPARADOR = "|";

export type LinhaFiltravel = {
  category: string;
  parentCategory: string | null;
  customCategoryId: string | null;
  subcategory: string | null;
};

/** A chave da categoria da linha, como o filtro já usava ("SEM" = gasto sem categoria). */
export function chaveDaCategoria(e: LinhaFiltravel): string {
  return e.customCategoryId ?? e.parentCategory ?? (e.category === "EXPENSE" ? "SEM" : "");
}

export const chaveDaSub = (categoria: string, sub: string) => `${categoria}${SEPARADOR}${sub}`;

/** "ALIMENTACAO|Delivery" → { categoria: "ALIMENTACAO", sub: "Delivery" }; sem "|", sub null. */
export function lerChave(chave: string): { categoria: string; sub: string | null } {
  const i = chave.indexOf(SEPARADOR);
  return i < 0 ? { categoria: chave, sub: null } : { categoria: chave.slice(0, i), sub: chave.slice(i + 1) };
}

/** A linha passa no filtro? Sem nada marcado, passa tudo. */
export function passaNoFiltro(e: LinhaFiltravel, filtros: readonly string[]): boolean {
  if (filtros.length === 0) return true;
  const cat = chaveDaCategoria(e);
  const subsDaCat = filtros.filter((f) => lerChave(f).categoria === cat && lerChave(f).sub !== null);
  if (subsDaCat.length > 0) return Boolean(e.subcategory) && subsDaCat.includes(chaveDaSub(cat, e.subcategory!.trim()));
  return filtros.includes(cat);
}

/**
 * As subcategorias de cada categoria que aparecem nos lançamentos do período (os chips da folha),
 * as mais usadas primeiro e, no empate, em ordem alfabética.
 */
export function subcategoriasDoPeriodo(linhas: readonly LinhaFiltravel[]): Record<string, string[]> {
  const contagem = new Map<string, Map<string, number>>();
  for (const e of linhas) {
    if (e.category !== "EXPENSE") continue;
    const sub = e.subcategory?.trim();
    if (!sub) continue;
    const cat = chaveDaCategoria(e);
    const m = contagem.get(cat) ?? new Map<string, number>();
    m.set(sub, (m.get(sub) ?? 0) + 1);
    contagem.set(cat, m);
  }
  const out: Record<string, string[]> = {};
  for (const [cat, m] of contagem) out[cat] = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")).map(([s]) => s);
  return out;
}

/** Desmarcar a categoria tira junto as subcategorias dela. */
export function tirarCategoria(filtros: readonly string[], categoria: string): string[] {
  return filtros.filter((f) => lerChave(f).categoria !== categoria);
}
