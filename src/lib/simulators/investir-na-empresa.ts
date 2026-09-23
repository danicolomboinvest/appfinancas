/**
 * "Vale a pena investir na empresa?" — o simulador do perfil Empresa.
 *
 * A pergunta de quem tem um negócio não é "financiar ou alugar", é: se eu botar R$ 30 mil numa
 * máquina (ou numa reforma, num segundo ponto, numa contratação), em quanto tempo isso se
 * paga, e é melhor do que deixar o dinheiro rendendo? A conta é a de viabilidade que o
 * Sebrae ensina, sem o jargão: payback, ganho no período e comparação com a aplicação.
 *
 * O ganho mensal do investimento é o que ele ACRESCENTA de margem, não de faturamento:
 * vender R$ 5 mil a mais só vale o que sobra depois de mercadoria, taxa e frete. Por isso
 * entra a margem de contribuição (o app já sabe a da empresa, pela DRE) e, separado, o custo
 * fixo novo que o investimento traz (manutenção, salário, aluguel maior).
 */
export type EntradaInvestimento = {
  /** Quanto custa o investimento, à vista. */
  investimento: number;
  /** Receita a mais por mês que ele deve gerar (ou economia, se for corte de custo). */
  receitaMensal: number;
  /** Quanto dessa receita sobra depois dos custos da venda, 0–1. Economia de custo = 1. */
  margem: number;
  /** Custo fixo novo por mês que o investimento traz (manutenção, pessoa, aluguel). */
  custoMensal: number;
  /** Por quantos meses avaliar. */
  horizonteMeses: number;
  /** Taxa anual da alternativa (deixar no CDI), 0–1. */
  taxaAnualAlternativa: number;
};

export type PontoDaCurva = { mes: number; naEmpresa: number; naAplicacao: number };

export type ResultadoInvestimento = {
  /** O que o investimento acrescenta ao caixa por mês, já líquido do custo novo. */
  ganhoMensal: number;
  /** Em quantos meses o ganho acumulado devolve o investimento. `null` se nunca. */
  paybackMeses: number | null;
  /** Ganho acumulado no horizonte menos o investimento. */
  resultadoNoHorizonte: number;
  /** resultadoNoHorizonte / investimento. */
  retorno: number;
  /** Quanto o mesmo dinheiro renderia na aplicação no horizonte (juros, sem o principal). */
  rendimentoDaAplicacao: number;
  /** Ganho na empresa menos o rendimento da aplicação: positivo, a empresa paga mais. */
  vantagemSobreAplicacao: number;
  /** Mês em que a curva da empresa passa a da aplicação. `null` se não passa no horizonte. */
  mesEmQueSupera: number | null;
  /** Quanto precisa faturar a mais por mês pra se pagar dentro do horizonte. */
  receitaNecessariaParaSePagar: number | null;
  veredito: "vale" | "empata" | "nao-vale" | "nunca-se-paga";
  curva: PontoDaCurva[];
};

export function simularInvestimentoNaEmpresa(e: EntradaInvestimento): ResultadoInvestimento {
  const investimento = Math.max(0, e.investimento);
  const horizonte = Math.max(1, Math.round(e.horizonteMeses));
  const ganhoMensal = e.receitaMensal * e.margem - e.custoMensal;
  const taxaMensal = Math.pow(1 + e.taxaAnualAlternativa, 1 / 12) - 1;

  const curva: PontoDaCurva[] = [];
  let mesEmQueSupera: number | null = null;
  for (let m = 0; m <= horizonte; m++) {
    const naEmpresa = ganhoMensal * m - investimento;
    const naAplicacao = investimento * (Math.pow(1 + taxaMensal, m) - 1);
    curva.push({ mes: m, naEmpresa, naAplicacao });
    if (mesEmQueSupera === null && m > 0 && naEmpresa > naAplicacao) mesEmQueSupera = m;
  }

  const paybackMeses = ganhoMensal > 0 && investimento > 0 ? Math.ceil(investimento / ganhoMensal) : investimento === 0 ? 0 : null;
  const resultadoNoHorizonte = ganhoMensal * horizonte - investimento;
  const rendimentoDaAplicacao = investimento * (Math.pow(1 + taxaMensal, horizonte) - 1);
  const vantagemSobreAplicacao = resultadoNoHorizonte - rendimentoDaAplicacao;
  const retorno = investimento > 0 ? resultadoNoHorizonte / investimento : 0;
  const receitaNecessariaParaSePagar = e.margem > 0 ? (investimento / horizonte + e.custoMensal) / e.margem : null;

  let veredito: ResultadoInvestimento["veredito"];
  if (ganhoMensal <= 0) veredito = "nunca-se-paga";
  else if (paybackMeses !== null && paybackMeses > horizonte) veredito = "nao-vale";
  else if (Math.abs(vantagemSobreAplicacao) <= investimento * 0.05) veredito = "empata";
  else veredito = vantagemSobreAplicacao > 0 ? "vale" : "nao-vale";

  return {
    ganhoMensal,
    paybackMeses,
    resultadoNoHorizonte,
    retorno,
    rendimentoDaAplicacao,
    vantagemSobreAplicacao,
    mesEmQueSupera,
    receitaNecessariaParaSePagar,
    veredito,
    curva,
  };
}
