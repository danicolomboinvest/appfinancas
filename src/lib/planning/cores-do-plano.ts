/**
 * A cor de cada fatia do "Seu plano" pela ordem (do maior plano para o menor), 12/10/2026. A paleta
 * do tema tem 7 cores (--color-plano-1..7); depois delas, as mesmas 7 clareadas e, depois, escurecidas,
 * para não repetir cor enquanto houver uma livre (antes da 8ª em diante saía tudo no mesmo marrom).
 */
export function corDoPlano(posicao: number): string {
  const base = `var(--color-plano-${(posicao % 7) + 1})`;
  const volta = Math.floor(posicao / 7);
  if (volta === 0) return base;
  if (volta === 1) return `color-mix(in srgb, ${base} 55%, var(--color-surface))`;
  return `color-mix(in srgb, ${base} 60%, var(--color-ink))`;
}

/** Pedaço menor que isto (em % do total) vira "Outras" na barra e na legenda. */
export const MENOR_FATIA_PCT = 2;

/**
 * As fatias do plano, já ordenadas e coloridas: sem as de 0, e as menores que 2% juntas em "Outras".
 */
export function fatiasDoPlano<T extends { k: string; n: string; v: number }>(itens: T[]): { k: string; n: string; v: number; cor: string }[] {
  const ordem = itens.filter((f) => f.v > 0).sort((a, b) => b.v - a.v);
  const total = ordem.reduce((s, f) => s + f.v, 0);
  if (total <= 0) return [];
  const grandes = ordem.filter((f) => (f.v / total) * 100 >= MENOR_FATIA_PCT);
  const pequenas = ordem.filter((f) => (f.v / total) * 100 < MENOR_FATIA_PCT);
  const out = grandes.map((f, i) => ({ k: f.k, n: f.n, v: f.v, cor: corDoPlano(i) }));
  if (pequenas.length === 1) out.push({ k: pequenas[0].k, n: pequenas[0].n, v: pequenas[0].v, cor: corDoPlano(grandes.length) });
  else if (pequenas.length > 1) out.push({ k: "outras", n: "Outras", v: pequenas.reduce((s, f) => s + f.v, 0), cor: "var(--color-border-strong)" });
  return out;
}
