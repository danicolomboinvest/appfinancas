import type { StrategyAssetClass } from "@prisma/client";

const ORDEM: StrategyAssetClass[] = ["RENDA_FIXA_POS_FIXADA", "RENDA_FIXA_IPCA", "PREFIXADO", "ACOES_BRASIL", "FIIS", "EXTERIOR", "OUTROS"];

/** Mexer em uma classe: as outras se ajustam na proporção e a soma fica em 100. */
export function redistribuir(aj: Record<StrategyAssetClass, number>, k: StrategyAssetClass, v: number): Record<StrategyAssetClass, number> {
  const novo = { ...aj, [k]: v };
  const outras = ORDEM.filter((c) => c !== k);
  const soma = outras.reduce((s, c) => s + aj[c], 0);
  const resto = 100 - v;
  if (soma <= 0) {
    outras.forEach((c, i) => (novo[c] = i === 0 ? resto : 0));
    return novo;
  }
  const bruto = Object.fromEntries(outras.map((c) => [c, (aj[c] * resto) / soma])) as Record<StrategyAssetClass, number>;
  let base = 0;
  for (const c of outras) {
    novo[c] = Math.floor(bruto[c]);
    base += novo[c];
  }
  let falta = resto - base;
  for (const c of [...outras].sort((a, b) => bruto[b] - Math.floor(bruto[b]) - (bruto[a] - Math.floor(bruto[a])))) {
    if (falta <= 0) break;
    novo[c] += 1;
    falta -= 1;
  }
  return novo;
}
