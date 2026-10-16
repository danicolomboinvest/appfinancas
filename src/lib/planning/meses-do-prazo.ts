/**
 * Quantos meses faltam até o prazo de uma meta: a fonte única de todo "por mês" de meta do app
 * (16/10/2026).
 *
 * Antes a conta dividia os milissegundos por 30,44 dias e arredondava, com a HORA junto: a mesma
 * meta (R$ 5.000 até out/2027, criada em 16/10/2026) dava 12 meses (R$ 400) de madrugada e 11
 * (R$ 440) depois do meio-dia. A folha "Nova meta" mostrava R$ 400 ("Faltam 12 meses") e o "Como
 * vou juntar?" e o servidor gravavam R$ 440.
 *
 * A regra:
 * - prazo de MÊS (dia 1, que é como a folha grava "out/2027"): meses do calendário, o mês de hoje
 *   como primeiro aporte. Outubro de 2026 até outubro de 2027 são 12, criada no dia 1 ou no 31.
 * - prazo de DATA (outro dia: a data da viagem, o fim do ano): os dias inteiros entre as duas
 *   datas, sem a hora, divididos pelo mês médio. 30/09 a 30/09 do ano seguinte são 12.
 * Puro, sem banco.
 */
const DIAS_POR_MES = 30.4375;
const DIA_MS = 86_400_000;

export function mesesAteOPrazo(prazo: Date, hoje: Date): number {
  if (prazo.getDate() === 1) {
    return Math.max(0, prazo.getFullYear() * 12 + prazo.getMonth() - (hoje.getFullYear() * 12 + hoje.getMonth()));
  }
  const dias = Math.round((Date.UTC(prazo.getFullYear(), prazo.getMonth(), prazo.getDate()) - Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / DIA_MS);
  return Math.max(0, Math.round(dias / DIAS_POR_MES));
}

/**
 * O "por mês" de uma meta com prazo, como TODA tela mostra (folha, cartão, detalhe, Combinado,
 * Decidir, widget): o aporte que fecha no prazo (rendendo como a meta rende), arredondado para
 * cima de R$ 10 em R$ 10. Uma conta só: antes o detalhe arredondava de R$ 1 em R$ 1 (R$ 396) e a
 * folha de R$ 10 em R$ 10 (R$ 400) para a mesma meta.
 */
export function arredondarPorMes(valor: number): number {
  return Math.ceil(Math.max(0, valor) / 10) * 10;
}
