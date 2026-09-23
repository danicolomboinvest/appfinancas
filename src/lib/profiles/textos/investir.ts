/**
 * Textos da calculadora "Vale a pena investir na empresa?" (`/investir`), na voz do Padrão —
 * as frases EXATAS que o app tinha antes desses textos existirem por tema. Só existe no perfil
 * Empresa, e só nele: como o `/divisao` do Casal, não precisa de camada de tipo por cima, cada
 * tema já escreve a versão dele direto aqui.
 *
 * Prefixo `inv`.
 */
export type TextosInvestirEmpresa = {
  invTitulo: string;
  invSub: string;
  invCusto: string;
  invCustoHint: string;
  invTipoLabel: string;
  invTipoVenda: string;
  invTipoEconomia: string;
  invReceitaLabelVenda: string;
  invReceitaLabelEconomia: string;
  invReceitaHintVenda: string;
  invReceitaHintEconomia: string;
  invMargemLabel: string;
  invMargemHint: string;
  invCustoMensal: string;
  invCustoMensalHint: string;
  invPrazoLabel: string;
  invTaxaLabel: string;
  invVeredictoEyebrow: string;
  invVeredictoValeTitulo: string;
  invVeredictoValeTexto(meses: number): string;
  invVeredictoEmpataTitulo: string;
  invVeredictoEmpataTexto(meses: number): string;
  invVeredictoNaoValeTitulo: string;
  invVeredictoNaoValeTextoForaDoPrazo(meses: number, horizonte: number): string;
  invVeredictoNaoValeTextoRendeMais: string;
  invVeredictoNuncaSePagaTitulo: string;
  invVeredictoNuncaSePagaTexto: string;
  invGanhoMes: string;
  invGanhoMesNota: string;
  invSePagaEm: string;
  invSePagaNunca: string;
  invSePagaNota: string;
  invResultadoEm(horizonte: number): string;
  invResultadoNota(pct: number): string;
  invNaAplicacao: string;
  invNaAplicacaoNota(taxa: number): string;
  invGraficoTitulo: string;
  invGraficoDescSupera(mes: number): string;
  invGraficoDescNaoSupera: string;
  invGraficoLegendaEmpresa: string;
  invGraficoLegendaAplicacao: string;
  /** Vem em duas partes porque o valor entra em negrito no meio: "Pra se pagar em X meses, precisa trazer pelo menos" + [valor] + "de vendas a mais por mês." */
  invReceitaNecessariaAntes(horizonte: number): string;
  invReceitaNecessariaDepois: string;
  invReceitaAbaixo: string;
  invReceitaAcima: string;
  invRodapeNota: string;
};

export const PADRAO_INVESTIR: TextosInvestirEmpresa = {
  invTitulo: "Vale a pena investir na empresa?",
  invSub: "Uma máquina, uma reforma, um segundo ponto, uma contratação: em quanto tempo se paga, e se rende mais do que deixar o dinheiro aplicado.",
  invCusto: "Quanto custa o investimento?",
  invCustoHint: "Máquina, reforma, novo ponto, contratação: o valor à vista.",
  invTipoLabel: "O que ele traz por mês?",
  invTipoVenda: "Mais vendas",
  invTipoEconomia: "Economia de custo",
  invReceitaLabelVenda: "Receita a mais por mês",
  invReceitaLabelEconomia: "Economia por mês",
  invReceitaHintVenda: "Quanto você espera vender a mais por causa dele. Seja realista: a média, não o melhor mês.",
  invReceitaHintEconomia: "Quanto deixa de gastar por mês (energia, terceiro, retrabalho).",
  invMargemLabel: "Quanto de cada venda sobra depois dos custos dela",
  invMargemHint: "A margem de contribuição da sua empresa, pela DRE. Vender mais só vale o que sobra depois de mercadoria, taxa e frete.",
  invCustoMensal: "Custo fixo novo por mês",
  invCustoMensalHint: "O que o investimento passa a custar todo mês: manutenção, salário, aluguel maior, software. Zero se não tiver.",
  invPrazoLabel: "Prazo pra avaliar",
  invTaxaLabel: "Aplicação rende ao ano",
  invVeredictoEyebrow: "Veredito",
  invVeredictoValeTitulo: "Vale a pena",
  invVeredictoValeTexto: (meses) => `Se paga em ${meses} ${meses === 1 ? "mês" : "meses"} e rende mais que deixar o dinheiro aplicado.`,
  invVeredictoEmpataTitulo: "Empata com a aplicação",
  invVeredictoEmpataTexto: (meses) => `Se paga em ${meses} meses, mas o ganho fica parecido com o da aplicação. Decide pelo que o dinheiro faz pela empresa, não pela conta.`,
  invVeredictoNaoValeTitulo: "Não vale, por enquanto",
  invVeredictoNaoValeTextoForaDoPrazo: (meses, horizonte) => `Só se paga em ${meses} meses, além dos ${horizonte} que você deu de prazo.`,
  invVeredictoNaoValeTextoRendeMais: "Deixar o dinheiro aplicado rende mais do que esse investimento devolve no prazo.",
  invVeredictoNuncaSePagaTitulo: "Não se paga",
  invVeredictoNuncaSePagaTexto: "O custo novo por mês come toda a margem que a receita nova traz. Assim o investimento nunca devolve o dinheiro.",
  invGanhoMes: "Ganho por mês",
  invGanhoMesNota: "já tirando o custo novo",
  invSePagaEm: "Se paga em",
  invSePagaNunca: "nunca",
  invSePagaNota: "payback",
  invResultadoEm: (horizonte) => `Resultado em ${horizonte} meses`,
  invResultadoNota: (pct) => `${pct}% sobre o investido`,
  invNaAplicacao: "Na aplicação, renderia",
  invNaAplicacaoNota: (taxa) => `${taxa}% ao ano, sem IR`,
  invGraficoTitulo: "Na empresa × na aplicação, mês a mês",
  invGraficoDescSupera: (mes) => `A empresa passa a aplicação no mês ${mes}.`,
  invGraficoDescNaoSupera: "No prazo dado, a aplicação rende mais.",
  invGraficoLegendaEmpresa: "Na empresa",
  invGraficoLegendaAplicacao: "Na aplicação",
  invReceitaNecessariaAntes: (horizonte) => `Pra se pagar dentro de ${horizonte} meses, esse investimento precisa trazer pelo menos `,
  invReceitaNecessariaDepois: " de vendas a mais por mês.",
  invReceitaAbaixo: " Você estimou menos que isso.",
  invReceitaAcima: " Você estimou acima disso.",
  invRodapeNota: "Conta simples, sem inflação nem imposto sobre a aplicação, pra dar a ordem de grandeza. Se a decisão for apertada, converse com o contador antes de assinar.",
};
