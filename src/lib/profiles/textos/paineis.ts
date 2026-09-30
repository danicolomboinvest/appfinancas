/**
 * Textos dos painéis (Análises em /fichas, cards da Visão geral, Fluxo do ano e o story do
 * Resumo mensal), na voz do Padrão — as frases EXATAS que essas telas tinham fixas no código.
 * Estavam fora do catálogo, e por isso escapavam do teste de jargão: a usuária do Girly lia
 * "continue aportando", "Ver patrimônio" e "provento anunciado".
 *
 * Prefixo `pai`.
 */
export type TextosPaineis = {
  // Análises (/fichas), montadas em computeInsights.
  paiReservaParcial(pct: string, atual: string, alvo: string): string;
  paiReservaNoComeco(pct: string): string;
  paiMetasAtrasadas(qtd: number, nomes: string): string;
  paiMetaEAumentar(nome: string, extra: string, meses: number): string;
  paiPatrimonioCresceu(pct: string): string;
  paiPatrimonioCaiu(pct: string): string;
  paiPatrimonioRecorde(valor: string): string;
  paiVerPatrimonio: string;
  // Cards da Visão geral.
  paiAposentadoriaSuperavit: string;
  paiAposentadoriaDeficit: string;
  paiDividendosVazio: string;
  // Fluxo do ano (/mensal/[ano]).
  paiAnoSub: string;
  paiAnoAportes: string;
  // Story "desde que você chegou" do Resumo mensal, com o saldo positivo.
  paiStoryAcumuladoBom: string;
};

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

export const PADRAO_PAINEIS: TextosPaineis = {
  paiReservaParcial: (pct, atual, alvo) =>
    `Sua reserva de emergência está ${pct} completa (${atual} de ${alvo}), continue aportando até cobrir o valor-alvo.`,
  paiReservaNoComeco: (pct) =>
    `Sua reserva de emergência cobre só ${pct} do valor-alvo, priorize esse aporte antes de outros objetivos, para não precisar recorrer a dívida em um imprevisto.`,
  paiMetasAtrasadas: (qtd, nomes) =>
    // "2 metas estão" (o texto antigo dizia "2 metas está").
    `${qtd} meta${plural(qtd, " está", "s estão")} atrasada${plural(qtd, "", "s")} (${nomes}), revise o prazo ou aumente o aporte mensal para voltar ao ritmo.`,
  paiMetaEAumentar: (nome, extra, meses) =>
    `Aumentando o aporte de "${nome}" em ${extra}/mês, você antecipa a conquista em ${meses} ${plural(meses, "mês", "meses")}.`,
  paiPatrimonioCresceu: (pct) => `Seu patrimônio cresceu ${pct} nos últimos 12 meses, você está construindo patrimônio de verdade.`,
  paiPatrimonioCaiu: (pct) =>
    `Seu patrimônio caiu ${pct} nos últimos 12 meses, vale entender se foi desvalorização de mercado ou saques.`,
  paiPatrimonioRecorde: (valor) => `Seu patrimônio bateu um novo recorde hoje: ${valor}.`,
  paiVerPatrimonio: "Ver patrimônio",
  paiAposentadoriaSuperavit: "Superávit: renda passiva cobre o padrão de vida desejado",
  paiAposentadoriaDeficit: "Déficit: falta patrimônio para o padrão de vida desejado",
  paiDividendosVazio: "Aparece quando houver provento anunciado",
  paiAnoSub: "Consolidação automática dos 12 meses do ano.",
  paiAnoAportes: "Aportes",
  paiStoryAcumuladoBom: "É renda acumulada que não virou gasto, e pode virar patrimônio.",
};
