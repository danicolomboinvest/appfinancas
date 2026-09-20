/**
 * O número que a pessoa abre o orçamento pra ver: quanto ela tinha pra gastar no mês e quanto
 * já foi.
 *
 * A página começava por "economia no mês" e "categoria que mais estourou" — conclusões sobre um
 * número que não estava escrito em lugar nenhum. Quem abre o orçamento no dia 20 quer saber uma
 * coisa só: ainda dá?
 *
 * Por isso o resumo responde na ordem em que a pergunta acontece: quanto sobrou, e quanto isso
 * dá por dia até o fim do mês. "Sobram R$ 1.150" é um número; "R$ 104 por dia até dia 30" é uma
 * decisão que a pessoa consegue tomar no caixa do mercado.
 */

export type SituacaoDoMes =
  /** Sem orçamento definido: não dá pra dizer se está bom ou ruim. */
  | "sem-plano"
  /** Já gastou mais do que planejou. */
  | "estourou"
  /** Gastou mais do que a altura do mês pede. */
  | "adiantado"
  /** Dentro do esperado pra altura do mês. */
  | "no-ritmo"
  /** Gastou menos do que a altura do mês pede. */
  | "folgado";

export type ResumoDoMes = {
  planejado: number;
  gasto: number;
  /** Planejado menos gasto. Negativo quando estourou. */
  restante: number;
  /** Quanto do orçamento já foi, de 0 a 1+. Null sem plano. */
  usado: number | null;
  /** Quanto do mês já passou, de 0 a 1. É a régua que diz se o gasto está adiantado. */
  doMes: number;
  /** Dias que ainda vão acontecer, contando hoje. */
  diasRestantes: number;
  /** Quanto dá pra gastar por dia no que falta. Null se estourou ou não há plano. */
  porDia: number | null;
  situacao: SituacaoDoMes;
};

/**
 * Folga antes de chamar alguém de adiantado.
 *
 * Sem ela, quem paga o aluguel no dia 5 abriria o app no dia 6 e leria "você está gastando
 * rápido demais" — o que é verdade na matemática e inútil na vida: aluguel não se dilui em 30
 * dias. Dez pontos percentuais é o suficiente pra absorver a conta grande do começo do mês sem
 * deixar passar quem está gastando demais de verdade.
 */
const FOLGA = 0.1;

export function resumoDoMes(input: {
  planejado: number;
  gasto: number;
  /** Data de referência (hoje, no fuso do Brasil). */
  hoje: Date;
  ano: number;
  mes: number;
}): ResumoDoMes {
  const { planejado, gasto, hoje, ano, mes } = input;
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const ehMesCorrente = hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes;
  const diaAtual = ehMesCorrente ? hoje.getDate() : diasNoMes;
  const diasRestantes = ehMesCorrente ? diasNoMes - diaAtual + 1 : 0;
  const doMes = diaAtual / diasNoMes;

  const restante = planejado - gasto;
  const usado = planejado > 0 ? gasto / planejado : null;

  let situacao: SituacaoDoMes;
  if (planejado <= 0) situacao = "sem-plano";
  else if (gasto > planejado) situacao = "estourou";
  else if (usado! > doMes + FOLGA) situacao = "adiantado";
  else if (usado! < doMes - FOLGA) situacao = "folgado";
  else situacao = "no-ritmo";

  // Só faz sentido dividir o que sobrou pelos dias que ainda vão acontecer. Num mês fechado
  // (ou estourado) isso viraria divisão por zero ou um número negativo sem significado.
  const porDia = planejado > 0 && restante > 0 && diasRestantes > 0 ? restante / diasRestantes : null;

  return { planejado, gasto, restante, usado, doMes, diasRestantes, porDia, situacao };
}
