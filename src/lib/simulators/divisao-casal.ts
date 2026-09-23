/**
 * "Quanto cada um contribui?" — a calculadora de divisão de contas do casal.
 *
 * O método padrão vem da prática mais recomendada quando as rendas são diferentes (Sebrae,
 * PagBank, Organizze, e a planejadora financeira CFP Kelli Nogueira à InfoMoney, ver memória
 * do projeto): calcular a renda conjunta, achar o % que cada um representa nela, e aplicar
 * esse mesmo % sobre as despesas comuns. Quem ganha mais paga mais, na mesma proporção — não
 * 50/50, que pesa mais pra quem ganha menos.
 *
 * Mas o casal pode já ter combinado OUTRO número (nem pela renda, nem 50/50) — por isso
 * `pctBManual` deixa digitar o percentual direto, em vez de aceitar só o que a renda sugere.
 *
 * O app não sabe a renda de CADA pessoa (não existe segundo login): a pessoa digita os dois
 * valores aqui, cada vez. Não fica salvo nem afeta os lançamentos do mês.
 */
export type EntradaDivisao = {
  /** Renda mensal de uma das pessoas. */
  rendaA: number;
  /** Renda mensal da outra. */
  rendaB: number;
  /** Total das despesas que o casal divide (aluguel, mercado, contas da casa…). */
  despesasComuns: number;
  /**
   * Quanto a pessoa B contribui, 0–1, quando o casal já combinou um percentual próprio em
   * vez de seguir a proporção da renda. `undefined` = usa a proporção calculada da renda.
   */
  pctBManual?: number;
};

export type ResultadoDivisao = {
  rendaConjunta: number;
  /** Fração de cada um USADA na conta — vem do `pctBManual`, quando informado. */
  pctA: number;
  pctB: number;
  /** O que a proporção da renda sugeriria pra B, pra comparar mesmo quando o percentual foi digitado à mão. */
  pctBSugeridoPelaRenda: number;
  /** Se a divisão usada veio de um percentual digitado, e não da proporção da renda. */
  manual: boolean;
  /** Quanto cada um contribui pras despesas comuns. */
  contribuicaoA: number;
  contribuicaoB: number;
  /** Pra comparar: o que seria se dividisse 50/50 em vez de proporcional. */
  contribuicaoIgual: number;
  /** O que sobra pra cada um depois de pagar a própria parte das despesas comuns. */
  sobraA: number;
  sobraB: number;
  /** Quanto a divisão usada poupa de B, comparado ao 50/50 (negativo = B paga mais que 50/50). */
  diferencaParaB: number;
};

export function dividirDespesasDoCasal(e: EntradaDivisao): ResultadoDivisao {
  const rendaA = Math.max(0, e.rendaA);
  const rendaB = Math.max(0, e.rendaB);
  const despesasComuns = Math.max(0, e.despesasComuns);
  const rendaConjunta = rendaA + rendaB;

  const pctBSugeridoPelaRenda = rendaConjunta > 0 ? rendaB / rendaConjunta : 0.5;
  const manual = e.pctBManual !== undefined && !Number.isNaN(e.pctBManual);
  const pctB = manual ? Math.min(1, Math.max(0, e.pctBManual as number)) : pctBSugeridoPelaRenda;
  const pctA = 1 - pctB;

  const contribuicaoA = despesasComuns * pctA;
  const contribuicaoB = despesasComuns * pctB;
  const contribuicaoIgual = despesasComuns / 2;

  return {
    rendaConjunta,
    pctA,
    pctB,
    pctBSugeridoPelaRenda,
    manual,
    contribuicaoA,
    contribuicaoB,
    contribuicaoIgual,
    sobraA: rendaA - contribuicaoA,
    sobraB: rendaB - contribuicaoB,
    diferencaParaB: contribuicaoIgual - contribuicaoB,
  };
}
