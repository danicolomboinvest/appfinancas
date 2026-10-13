/**
 * Um avaliador das formas de `where` do Prisma que a casa usa, para testar os filtros de verdade
 * num banco de mentira: igualdade, { not }, { in }, OR, AND, NOT e a relação opcional `{ is }`.
 * Forma desconhecida quebra o teste (melhor que passar calado).
 */
export function bate(linha: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([chave, cond]) => {
    if (chave === "OR") return (cond as Record<string, unknown>[]).some((w) => bate(linha, w));
    if (chave === "AND") return (Array.isArray(cond) ? cond : [cond]).every((w) => bate(linha, w as Record<string, unknown>));
    if (chave === "NOT") return !bate(linha, cond as Record<string, unknown>);
    const valor = linha[chave];
    if (cond !== null && typeof cond === "object" && !Array.isArray(cond)) {
      const c = cond as { not?: unknown; in?: unknown[]; equals?: unknown; is?: Record<string, unknown> | null };
      if ("is" in c) {
        if (c.is === null) return valor === null || valor === undefined;
        return valor !== null && valor !== undefined && bate(valor as Record<string, unknown>, c.is!);
      }
      if ("not" in c) return valor !== c.not;
      if ("in" in c) return (c.in ?? []).includes(valor);
      if ("equals" in c) return valor === c.equals;
      throw new Error(`forma de where que o avaliador não conhece: ${chave}`);
    }
    return valor === cond;
  });
}
