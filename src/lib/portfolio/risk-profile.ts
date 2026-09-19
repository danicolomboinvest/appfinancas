/**
 * De três respostas ao perfil de investidora.
 *
 * O jeito antigo somava pontos das três perguntas e olhava o total. Dava um resultado errado e
 * perigoso: quem respondia "venderia tudo, não dormiria" numa queda saía como MODERADA, porque
 * prazo longo e reserva pronta compensavam o medo na soma. A pessoa que mais precisa de
 * proteção recebia a recomendação de correr mais risco.
 *
 * Aqui a tolerância a queda é um TETO, não uma parcela: ninguém passa do perfil que aguenta.
 * O prazo e a reserva só podem puxar pra baixo desse teto, nunca pra cima. É como funciona um
 * questionário de suitability de verdade — a dimensão mais fraca manda.
 */

export type RiskProfileKey = "conservador" | "moderado" | "arrojado";

const ORDEM: RiskProfileKey[] = ["conservador", "moderado", "arrojado"];

export type RiskAnswers = {
  /** Quando vai precisar do dinheiro: 0 = menos de 2 anos, 1 = 2 a 5, 2 = mais de 5. */
  prazo: 0 | 1 | 2;
  /** Se a carteira caísse 15%: 0 = venderia tudo, 1 = seguraria tenso, 2 = compraria mais. */
  queda: 0 | 1 | 2;
  /** Reserva de emergência: 0 = ainda não, 1 = quase, 2 = pronta. */
  reserva: 0 | 1 | 2;
};

export type RiskProfileResult = {
  profile: RiskProfileKey;
  /** O que limitou o perfil, em português, pra tela poder explicar a conclusão. */
  reason: string;
};

/** O teto que a tolerância a queda impõe: é a resposta que não pode ser compensada. */
function tetoPorQueda(queda: RiskAnswers["queda"]): RiskProfileKey {
  return queda === 0 ? "conservador" : queda === 1 ? "moderado" : "arrojado";
}

/** Prazo e reserva juntos: só afinam para baixo do teto. */
function porPrazoEReserva(prazo: RiskAnswers["prazo"], reserva: RiskAnswers["reserva"]): RiskProfileKey {
  const soma = prazo + reserva;
  return soma <= 1 ? "conservador" : soma <= 3 ? "moderado" : "arrojado";
}

export function riskProfileFromAnswers(answers: RiskAnswers): RiskProfileResult {
  const teto = tetoPorQueda(answers.queda);
  const porContexto = porPrazoEReserva(answers.prazo, answers.reserva);
  const profile = ORDEM[Math.min(ORDEM.indexOf(teto), ORDEM.indexOf(porContexto))];

  let reason: string;
  if (ORDEM.indexOf(teto) <= ORDEM.indexOf(porContexto) && answers.queda < 2) {
    reason =
      answers.queda === 0
        ? "Você disse que venderia tudo numa queda. Enquanto for assim, a carteira precisa balançar pouco, mesmo com prazo longo."
        : "Você segura uma queda, mas com desconforto. O perfil respeita esse limite.";
  } else if (answers.prazo === 0) {
    reason = "Você vai precisar desse dinheiro em menos de 2 anos, e dinheiro de curto prazo não pode balançar.";
  } else if (answers.reserva === 0) {
    reason = "Sua reserva de emergência ainda não está pronta. Antes dela, a carteira segura a onda.";
  } else {
    reason = "Prazo longo, reserva pronta e estômago pra oscilação: dá pra buscar crescimento.";
  }
  return { profile, reason };
}

export type GoalHorizonInput = { name: string; targetAmount: number; targetDate: Date | null };

export type GoalHorizon = {
  /** Prazo médio em meses, pesado pelo tamanho de cada meta. */
  months: number;
  /** A mesma escala da pergunta do quiz, pra entrar na conta do perfil. */
  prazo: 0 | 1 | 2;
  /** Frase pra tela: "Viagem em 1 ano, Casa em 5 anos". */
  summary: string;
};

/**
 * Tira o prazo das METAS da pessoa em vez de perguntar.
 *
 * Ninguém tem só um prazo: tem a viagem do ano que vem, a entrada do apê em cinco anos, a
 * aposentadoria em vinte. O que decide o risco da carteira é onde está o PESO — quem precisa de
 * R$ 50.000 daqui a um ano e R$ 5.000 daqui a dez não pode montar carteira de dez anos. Por isso
 * a média é ponderada pelo valor de cada meta, não pela quantidade delas.
 *
 * Meta sem data fica de fora: sem prazo ela não diz nada sobre horizonte.
 */
export function horizonFromGoals(goals: GoalHorizonInput[], now: Date = new Date()): GoalHorizon | null {
  const comData = goals.filter((g) => g.targetDate && g.targetAmount > 0);
  if (comData.length === 0) return null;

  const pesos = comData.map((g) => {
    const meses = Math.max(0, (g.targetDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
    return { nome: g.name, meses, peso: g.targetAmount };
  });
  const pesoTotal = pesos.reduce((s, p) => s + p.peso, 0);
  const months = Math.round(pesos.reduce((s, p) => s + p.meses * p.peso, 0) / pesoTotal);
  const prazo: 0 | 1 | 2 = months < 24 ? 0 : months <= 60 ? 1 : 2;

  const summary = [...pesos]
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 3)
    .map((p) => `${p.nome} em ${descreveMeses(p.meses)}`)
    .join(", ");
  return { months, prazo, summary };
}

function descreveMeses(meses: number): string {
  const m = Math.round(meses);
  if (m < 1) return "menos de 1 mês";
  if (m < 24) return `${m} ${m === 1 ? "mês" : "meses"}`;
  const anos = Math.round(m / 12);
  return `${anos} anos`;
}
