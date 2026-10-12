/**
 * "Dividir com alguém" (protótipo, folha da transação). Três jeitos:
 * - Metade: metade fica no orçamento dela, a outra metade a pessoa deve;
 * - Uma parte: ela escolhe quanto é dela (10% a 90%);
 * - É de outra pessoa: se a pessoa vai devolver, nada fica no orçamento dela e o total é a
 *   receber; se foi um presente ("Não, eu dei"), o gasto inteiro fica com ela.
 * Tudo em centavos inteiros, para a soma das partes sempre bater com o total.
 */
export type ModoDaDivisao = "metade" | "parte" | "outra";

export function contaDaDivisao(total: number, modo: ModoDaDivisao, pctMeu = 50, volta = true): { minha: number; dela: number; presente: boolean } {
  const c = Math.round(total * 100);
  if (modo === "outra") return volta ? { minha: 0, dela: c / 100, presente: false } : { minha: c / 100, dela: 0, presente: true };
  const pct = modo === "metade" ? 50 : Math.min(90, Math.max(10, Math.round(pctMeu)));
  const minha = Math.round((c * pct) / 100);
  return { minha: minha / 100, dela: (c - minha) / 100, presente: false };
}

/** Quanto cada pessoa ainda deve (só o que não foi marcado "Recebi"), do maior para o menor. */
export function aReceberPorPessoa(linhas: { divididoCom: string | null; parteDeOutro: unknown; devolvidoEm: Date | null }[]) {
  const soma = new Map<string, number>();
  for (const l of linhas) {
    const v = Number(l.parteDeOutro ?? 0);
    if (!l.divididoCom || l.devolvidoEm || !(v > 0)) continue;
    soma.set(l.divididoCom, Math.round(((soma.get(l.divididoCom) ?? 0) + v) * 100) / 100);
  }
  return [...soma.entries()].map(([pessoa, valor]) => ({ pessoa, valor })).sort((a, b) => b.valor - a.valor);
}

/** "Separar em categorias": a primeira parte (limitada ao total) e o resto. */
export function contaDaSeparacao(total: number, primeira: number): { v1: number; v2: number } {
  const c = Math.round(total * 100);
  const p = Math.min(c, Math.max(0, Math.round(primeira * 100)));
  return { v1: p / 100, v2: (c - p) / 100 };
}
