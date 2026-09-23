/**
 * A pontuação do Game: divisão, pontos da temporada e sequência.
 *
 * Mede CONSTÂNCIA, nunca patrimônio. Quem ganha pouco pode ser Diamante; quem tem muito e
 * some por dois meses cai. É a decisão que separa isto de um placar de riqueza — e um placar
 * de riqueza num app de dinheiro é vergonha em forma de recurso. Também não existe ranking
 * contra outras pessoas, pela mesma razão.
 *
 * A temporada é o mês, porque o mês já é o ciclo do app, e ninguém precisa registrar todo
 * dia: tem gente que lança uma vez por mês, e está certa. O que pontua é o COMBO do mês
 * (lançou alguma coisa E fez o aporte), mais guardar 20% do que entrou, mais cada meta
 * concluída. A divisão sai da soma das últimas seis temporadas. Tudo calculado na hora, do
 * que já existe.
 */

export type Temporada = {
  /** Registrou pelo menos um lançamento no mês. */
  registrou: boolean;
  /** Registrou pelo menos um aporte no mês. */
  aportou: boolean;
  /** Guardou 20% ou mais do que entrou (o mesmo "bom" da voz). */
  guardouBem: boolean;
  metasConcluidas: number;
};

export const PONTOS = { combo: 100, guardouBem: 100, porMeta: 100 } as const;

/** O combo: lançamento do mês mais aporte do mês. Os dois feitos, ou não conta. */
export function comboFeito(t: Pick<Temporada, "registrou" | "aportou">): boolean {
  return t.registrou && t.aportou;
}

export function pontosDaTemporada(t: Temporada): number {
  return (comboFeito(t) ? PONTOS.combo : 0) + (t.guardouBem ? PONTOS.guardouBem : 0) + t.metasConcluidas * PONTOS.porMeta;
}

// Seis temporadas perfeitas sem meta somam 1.200: quem faz o combo e guarda 20% todo mês
// chega a Diamante em meio ano. Só o combo, sem guardar, para em Ouro.
const DIVISOES = [
  { nome: "Bronze", minimo: 0 },
  { nome: "Prata", minimo: 200 },
  { nome: "Ouro", minimo: 500 },
  { nome: "Platina", minimo: 800 },
  { nome: "Diamante", minimo: 1100 },
] as const;

export type Divisao = {
  nome: string;
  /** III, II, I dentro da divisão — I é o mais perto de subir. Diamante não tem. */
  numeral: "III" | "II" | "I" | null;
  pontos: number;
  /** Onde a próxima divisão começa. `null` no Diamante. */
  proximo: number | null;
  /** 0–1 dentro da faixa atual. */
  progresso: number;
};

export function divisao(pontosDasUltimasTemporadas: number[]): Divisao {
  const pontos = pontosDasUltimasTemporadas.reduce((a, b) => a + b, 0);
  const i = DIVISOES.findLastIndex((d) => pontos >= d.minimo);
  const atual = DIVISOES[Math.max(0, i)];
  const proxima = DIVISOES[i + 1] ?? null;
  if (!proxima) return { nome: atual.nome, numeral: null, pontos, proximo: null, progresso: 1 };
  const faixa = proxima.minimo - atual.minimo;
  const dentro = (pontos - atual.minimo) / faixa;
  const numeral = dentro < 1 / 3 ? "III" : dentro < 2 / 3 ? "II" : "I";
  return { nome: atual.nome, numeral, pontos, proximo: proxima.minimo, progresso: dentro };
}

/**
 * Meses seguidos com o combo feito, da temporada mais antiga pra atual. A atual ainda está
 * aberta, então se ela não fechou o combo a sequência conta até o mês passado — igual à
 * sequência de dias que existia antes: hoje ainda não acabou, não zera.
 */
export function sequenciaDeTemporadas(combos: boolean[]): number {
  let i = combos.length - 1;
  if (i >= 0 && !combos[i]) i -= 1;
  let n = 0;
  while (i >= 0 && combos[i]) {
    n += 1;
    i -= 1;
  }
  return n;
}

/** A cor de cada divisão, pro emblema. Só o Game usa, por isso vive aqui e não nos tokens do tema. */
export const COR_DA_DIVISAO: Record<string, string> = {
  Bronze: "#c98a55",
  Prata: "#b9c6d8",
  Ouro: "#f2c14e",
  Platina: "#16d3c2",
  Diamante: "#8ad6ff",
};

/**
 * As conquistas: cada uma é uma condição verificável em dado que já existe. Nada de "abriu o
 * app 3 vezes" — todas medem o que o app quer que a pessoa faça: fechar o combo, respeitar o
 * limite, guardar, fechar meta. Desbloqueada ou não, a lista é sempre a mesma, pra travada
 * mostrar o que falta.
 */
export type Conquista = { chave: string; nome: string; como: string; desbloqueada: boolean };

export function conquistas(d: {
  /** Meses seguidos com combo. */
  sequencia: number;
  comboNoMes: boolean;
  guardouBemNoMes: boolean;
  metasConcluidas: number;
  temporadaLimpa: boolean;
  /** Quantas das últimas seis temporadas tiveram combo. */
  temporadasComCombo: number;
}): Conquista[] {
  return [
    { chave: "primeiro-combo", nome: "Primeiro combo", como: "Lance e aporte no mesmo mês", desbloqueada: d.comboNoMes || d.temporadasComCombo > 0 },
    { chave: "sequencia-3", nome: "3 meses seguidos", como: "Feche o combo 3 meses seguidos", desbloqueada: d.sequencia >= 3 },
    { chave: "temporada-limpa", nome: "Temporada limpa", como: "Nenhuma categoria acima do limite", desbloqueada: d.temporadaLimpa },
    { chave: "guardou-20", nome: "Guardou 20%", como: "Guarde 20% do que entrou no mês", desbloqueada: d.guardouBemNoMes },
    { chave: "missao-fechada", nome: "Missão fechada", como: "Conclua uma missão", desbloqueada: d.metasConcluidas > 0 },
    { chave: "veterana", nome: "Veterana", como: "Combo em 6 temporadas", desbloqueada: d.temporadasComCombo >= 6 },
  ];
}
