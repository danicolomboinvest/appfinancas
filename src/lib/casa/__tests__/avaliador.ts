/**
 * Um avaliador das formas de `where` do Prisma que a casa usa, para testar os filtros de verdade
 * num banco de mentira: igualdade, { not }, { in }, { lt, lte, gt, gte }, OR, AND, NOT e a relação
 * opcional `{ is }`.
 * Forma desconhecida quebra o teste (melhor que passar calado).
 */
export function bate(linha: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([chave, cond]) => {
    if (chave === "OR") return (cond as Record<string, unknown>[]).some((w) => bate(linha, w));
    if (chave === "AND") return (Array.isArray(cond) ? cond : [cond]).every((w) => bate(linha, w as Record<string, unknown>));
    if (chave === "NOT") return !bate(linha, cond as Record<string, unknown>);
    const valor = linha[chave];
    if (cond !== null && typeof cond === "object" && !Array.isArray(cond)) {
      const c = cond as { not?: unknown; in?: unknown[]; equals?: unknown; is?: Record<string, unknown> | null; lt?: number | Date; lte?: number | Date; gt?: number | Date; gte?: number | Date };
      if ("is" in c) {
        if (c.is === null) return valor === null || valor === undefined;
        return valor !== null && valor !== undefined && bate(valor as Record<string, unknown>, c.is!);
      }
      if ("not" in c) return valor !== c.not;
      if ("in" in c) return (c.in ?? []).includes(valor);
      if ("equals" in c) return valor === c.equals;
      // Comparações de número e data (ano, mês, createdAt), todas as que vierem juntas.
      const comparaveis = (["lt", "lte", "gt", "gte"] as const).filter((k) => k in c);
      if (comparaveis.length > 0) {
        if (valor === null || valor === undefined) return false;
        const v = Number(valor instanceof Date ? valor.getTime() : valor);
        return comparaveis.every((k) => {
          const alvo = Number(c[k] instanceof Date ? (c[k] as Date).getTime() : c[k]);
          return k === "lt" ? v < alvo : k === "lte" ? v <= alvo : k === "gt" ? v > alvo : v >= alvo;
        });
      }
      throw new Error(`forma de where que o avaliador não conhece: ${chave}`);
    }
    return valor === cond;
  });
}
