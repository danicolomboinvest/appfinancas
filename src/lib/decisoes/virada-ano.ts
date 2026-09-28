/**
 * A virada do ano: fecha o ano que passou e sugere como começar o próximo.
 *
 * Sem isso, em 1º de janeiro todo mundo começava zerado: o orçamento, o plano do mês e as contas
 * fixas eram gravados por ano e não passavam pro ano novo. A Dani pediu o contrário de zerar
 * calado: mostrar o ano, sugerir o próximo com base no que a pessoa viveu, e perguntar se ela
 * quer começar assim ou do zero.
 *
 * A sugestão segue a aula: o plano de cada categoria vem do que ela planejou, a não ser que o
 * gasto de verdade tenha ficado bem acima (aí o plano estava baixo e ia estourar de novo); guardar
 * é no mínimo 10% da renda (a fatia de liberdade financeira); e os gastos cabem em 90% da renda.
 *
 * Puro, sem banco.
 */

export type ViradaCategoria = {
  key: string;
  label: string;
  /** O que estava planejado no último mês do ano. */
  planejado: number;
  /** Média do que foi gasto de fato nos últimos meses do ano. */
  realMedio: number;
  /** Categoria-mãe (true) ou personalizada. */
  mae: boolean;
};

export type ViradaEntrada = {
  ano: number;
  renda: { planejada: number | null; mediana: number | null };
  guardarPlanejado: number | null;
  categorias: ViradaCategoria[];
};

export type ViradaSugestao = {
  renda: number;
  guardar: number;
  categorias: (ViradaCategoria & { sugerido: number; motivo: "plano" | "real" | "novo" })[];
  totalGastos: number;
  /** Renda − guardar − gastos: o que fica sem destino. Negativo = a sugestão não fecha. */
  semDestino: number;
  avisos: string[];
};

const PISO_GUARDAR = 0.1;
const LIMITE_GASTO = 0.9;
/** Gasto real 10% acima do plano: o plano estava baixo. Abaixo disso é variação normal. */
const FOLGA_PLANO = 1.1;

const arredonda10 = (v: number) => Math.ceil(v / 10) * 10;

export function sugerirAno(e: ViradaEntrada, money: (v: number) => string): ViradaSugestao {
  const renda = e.renda.planejada && e.renda.planejada > 0 ? e.renda.planejada : (e.renda.mediana ?? 0);
  const minimoGuardar = arredonda10(renda * PISO_GUARDAR);
  const guardar = Math.max(e.guardarPlanejado ?? 0, minimoGuardar);

  const categorias = e.categorias
    .filter((c) => c.planejado > 0 || c.realMedio >= 1)
    .map((c) => {
      if (c.planejado <= 0) return { ...c, sugerido: arredonda10(c.realMedio), motivo: "novo" as const };
      if (c.realMedio > c.planejado * FOLGA_PLANO) return { ...c, sugerido: arredonda10(c.realMedio), motivo: "real" as const };
      return { ...c, sugerido: c.planejado, motivo: "plano" as const };
    });
  const totalGastos = categorias.reduce((s, c) => s + c.sugerido, 0);
  const semDestino = renda - guardar - totalGastos;

  const avisos: string[] = [];
  if (!(renda > 0)) avisos.push("Não achei sua renda do ano passado. Preencha a renda do mês pra sugestão ficar completa.");
  if ((e.guardarPlanejado ?? 0) < minimoGuardar && renda > 0) {
    avisos.push(`Pra guardar pelo menos 10% da renda, a sugestão é ${money(guardar)} por mês.`);
  }
  if (renda > 0 && totalGastos > renda * LIMITE_GASTO) {
    avisos.push(`Os gastos sugeridos (${money(totalGastos)}) passam de 90% da renda (${money(renda * LIMITE_GASTO)}). Vale escolher onde cortar antes de começar.`);
  } else if (renda > 0 && semDestino < 0) {
    avisos.push(`Com ${money(guardar)} guardados por mês, a conta não fecha: faltam ${money(-semDestino)}. Vale ajustar alguma categoria.`);
  }
  return { renda, guardar, categorias, totalGastos, semDestino, avisos };
}
