/**
 * O orçamento que aprende com o padrão dela.
 *
 * Pedido da Dani (03/10/2026): quem sobe os últimos extratos e faturas deveria ter o orçamento
 * ajustado ao jeito dela de gastar, não a uma régua genérica. O app olha os últimos três meses
 * FECHADOS, acha o padrão de cada categoria e sugere: criar o plano que falta, subir o que vive
 * estourando, baixar o que sobra todo mês (e a diferença vai para guardar).
 *
 * Por que a MEDIANA e não a média: um mês fora da curva (a viagem, o conserto do carro) puxaria
 * a média e viraria plano. Com três meses, a mediana é o mês do meio: o normal dela.
 *
 * Por que não sugere sozinho em cima do curso: o "Sugerir para mim" (ideal-budget.ts) continua
 * existindo para quem está começando. Este é o outro lado: para quem já tem histórico, o plano
 * que cabe na vida real. As duas coisas aparecem, e ela escolhe.
 */

/** Mínimo de meses com dado para falar em "padrão". Um mês só é um retrato, não um padrão. */
export const MESES_MINIMOS_DO_PADRAO = 2;

/** Arredonda para cima, de 50 em 50: plano redondo e com uma folga pequena. */
export function arredondaPlano(valor: number): number {
  return valor <= 0 ? 0 : Math.ceil(valor / 50) * 50;
}

export function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

/**
 * Padrão por categoria a partir dos meses (um mapa categoria → gasto por mês). Só entram os meses
 * em que houve QUALQUER gasto: mês antes de ela começar a usar o app não é "gastou zero", é "não
 * tinha dado", e contaria como zero na mediana.
 */
export function padraoPorCategoria(meses: readonly Record<string, number>[]): { padrao: Record<string, number>; mesesComDado: number } {
  const comDado = meses.filter((m) => Object.values(m).some((v) => v > 0));
  const chaves = new Set(comDado.flatMap((m) => Object.keys(m)));
  const padrao: Record<string, number> = {};
  for (const k of chaves) padrao[k] = Math.round(mediana(comDado.map((m) => m[k] ?? 0)));
  return { padrao, mesesComDado: comDado.length };
}

export type TipoDeAjuste = "criar" | "subir" | "baixar";

export type AjusteDoPadrao = {
  chave: string;
  tipo: TipoDeAjuste;
  /** Plano de hoje (0 quando não tem). */
  planoAtual: number;
  /** O mês do meio dos últimos três: quanto ela costuma gastar. */
  padrao: number;
  /** O plano sugerido, redondo. */
  sugerido: number;
  /** Gasto de cada mês considerado, do mais antigo ao mais recente, para mostrar de onde veio. */
  meses: number[];
};

/** Subir só quando o padrão passa do plano em mais de 10%: abaixo disso é variação normal. */
const FOLGA_PARA_SUBIR = 1.1;
/** Baixar só quando o padrão fica abaixo de 80% do plano e a diferença vale a pena (R$ 100+). */
const FOLGA_PARA_BAIXAR = 0.8;
const DIFERENCA_MINIMA_PARA_BAIXAR = 100;
/** Mais de cinco sugestões de uma vez vira lista que ninguém lê. */
export const MAXIMO_DE_AJUSTES = 5;

export function ajustesDoPadrao(input: {
  meses: readonly Record<string, number>[];
  plano: Readonly<Record<string, number>>;
  /** Categorias que ela escondeu ou que não existem mais: não sugere nada nelas. */
  ignorar?: ReadonlySet<string>;
}): AjusteDoPadrao[] {
  const { padrao, mesesComDado } = padraoPorCategoria(input.meses);
  if (mesesComDado < MESES_MINIMOS_DO_PADRAO) return [];
  const comDado = input.meses.filter((m) => Object.values(m).some((v) => v > 0));

  const ajustes: AjusteDoPadrao[] = [];
  for (const [chave, p] of Object.entries(padrao)) {
    if (input.ignorar?.has(chave)) continue;
    const planoAtual = input.plano[chave] ?? 0;
    const sugerido = arredondaPlano(p);
    const meses = comDado.map((m) => Math.round(m[chave] ?? 0));
    if (sugerido < 50) continue;

    if (planoAtual <= 0) {
      ajustes.push({ chave, tipo: "criar", planoAtual: 0, padrao: p, sugerido, meses });
    } else if (p > planoAtual * FOLGA_PARA_SUBIR && sugerido > planoAtual) {
      ajustes.push({ chave, tipo: "subir", planoAtual, padrao: p, sugerido, meses });
    } else if (p < planoAtual * FOLGA_PARA_BAIXAR && planoAtual - sugerido >= DIFERENCA_MINIMA_PARA_BAIXAR) {
      ajustes.push({ chave, tipo: "baixar", planoAtual, padrao: p, sugerido, meses });
    }
  }

  return ajustes
    .sort((a, b) => Math.abs(b.sugerido - b.planoAtual) - Math.abs(a.sugerido - a.planoAtual))
    .slice(0, MAXIMO_DE_AJUSTES);
}
