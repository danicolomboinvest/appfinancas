/** Leitura de dinheiro do jeito que as telas escrevem ("R$ 2.666", "−R$ 28,00", "R$ 1,2 mil"). */
export function reais(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const t = texto.replace(/ /g, " ");
  const m = t.match(/([-−–])?\s*R\$\s*([-−])?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(\s*mil)?/);
  if (!m) return null;
  let v = Number(m[3].replace(/\./g, "").replace(",", "."));
  if (m[4]) v *= 1000;
  return m[1] || m[2] ? -v : v;
}

/** Todos os valores em reais de um texto, na ordem. */
export function todosOsReais(texto: string): number[] {
  const r: number[] = [];
  const re = /([-−–])?\s*R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g;
  for (const m of texto.replace(/ /g, " ").matchAll(re)) r.push((m[1] ? -1 : 1) * Number(m[2].replace(/\./g, "").replace(",", ".")));
  return r;
}

/** Iguais, dado que uma tela arredonda para reais e outra mostra centavos. */
export function bate(a: number | null | undefined, b: number | null | undefined, folga = 1): boolean {
  if (a == null || b == null) return a == b;
  return Math.abs(a - b) <= folga;
}

export const brl = (v: number | null | undefined) =>
  v == null ? "(nada)" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
