import type { ParentCategory } from "@prisma/client";
import { PARENT_CATEGORIES } from "@/lib/categories";

/**
 * Divisão de referência do que sobra pra gastar, por categoria.
 *
 * O "Sugerir pra mim" antes só sabia repetir a média dos meses anteriores da própria pessoa —
 * inútil para quem está começando (não tem histórico) e circular para quem já gasta demais
 * numa categoria (sugeria gastar demais de novo). Aqui a referência é externa: a proporção
 * que uma família brasileira gasta em cada coisa, ajustada pelo que a pessoa ganha.
 *
 * Por que muda com a renda: quem ganha menos compromete uma fatia maior com moradia e comida
 * (não dá pra comprar meia cesta básica), e sobra menos para lazer e educação. Aplicar a mesma
 * régua para quem ganha R$ 3.000 e para quem ganha R$ 16.000 daria um número irreal nos dois.
 *
 * Os percentuais são o ponto de partida do app e ficam TODOS aqui, nesta tabela, pra Dani
 * trocar pelos números do curso sem mexer em mais nada. Cada faixa soma 100%.
 */
export type IdealShares = Record<ParentCategory, number>;

type Band = { upTo: number; label: string; shares: IdealShares };

const BANDS: Band[] = [
  {
    upTo: 5_000,
    label: "até R$ 5.000",
    shares: { MORADIA: 0.33, ALIMENTACAO: 0.24, TRANSPORTE: 0.14, SAUDE: 0.09, EDUCACAO: 0.06, LAZER: 0.09, FINANCEIRO: 0.05 },
  },
  {
    upTo: 15_000,
    label: "R$ 5.000 a R$ 15.000",
    shares: { MORADIA: 0.3, ALIMENTACAO: 0.2, TRANSPORTE: 0.15, SAUDE: 0.1, EDUCACAO: 0.08, LAZER: 0.12, FINANCEIRO: 0.05 },
  },
  {
    upTo: Infinity,
    label: "acima de R$ 15.000",
    shares: { MORADIA: 0.28, ALIMENTACAO: 0.17, TRANSPORTE: 0.13, SAUDE: 0.11, EDUCACAO: 0.11, LAZER: 0.15, FINANCEIRO: 0.05 },
  },
];

export function bandForIncome(monthlyIncome: number): Band {
  return BANDS.find((b) => monthlyIncome <= b.upTo) ?? BANDS[BANDS.length - 1];
}

/** Rótulo da faixa, pra tela dizer em cima de que referência a sugestão foi feita. */
export function idealBandLabel(monthlyIncome: number): string {
  return bandForIncome(monthlyIncome).label;
}

/**
 * Divide `toSpend` entre as sete categorias na proporção de referência da faixa de renda.
 *
 * - `reserved`: o que já está comprometido com categorias que a própria pessoa criou (elas
 *   não entram na tabela); sai do bolo antes, pra soma final continuar batendo com o que sobra.
 * - `step`: arredondamento (R$ 50 no app). A diferença do arredondamento vai pra maior fatia,
 *   então a soma fecha EXATAMENTE em `toSpend` — sem "sobra R$ 30" sem dono.
 */
export function idealBudgetSplit(
  toSpend: number,
  monthlyIncome: number,
  options: { reserved?: number; step?: number } = {},
): IdealShares {
  const { reserved = 0, step = 50 } = options;
  const pot = Math.max(0, toSpend - Math.max(0, reserved));
  const empty = Object.fromEntries(PARENT_CATEGORIES.map((c) => [c, 0])) as IdealShares;
  if (pot <= 0) return empty;

  const { shares } = bandForIncome(monthlyIncome);
  const out = { ...empty };
  for (const c of PARENT_CATEGORIES) out[c] = Math.max(0, Math.round((pot * shares[c]) / step) * step);

  // Sobra (ou excesso) do arredondamento na categoria de maior fatia: a soma tem que fechar.
  const diff = Math.round((pot - PARENT_CATEGORIES.reduce((s, c) => s + out[c], 0)) * 100) / 100;
  if (diff !== 0) {
    const biggest = PARENT_CATEGORIES.reduce((m, c) => (out[c] > out[m] ? c : m), PARENT_CATEGORIES[0]);
    out[biggest] = Math.max(0, Math.round((out[biggest] + diff) * 100) / 100);
  }
  return out;
}
