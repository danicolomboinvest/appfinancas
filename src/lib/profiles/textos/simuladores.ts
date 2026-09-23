/**
 * Textos da área "simuladores", na voz do Padrão — as frases EXATAS que o app tem hoje. Os temas
 * sobrescrevem o que quiserem em `vozes/<tema>.ts`; o que não sobrescrevem, cai aqui.
 *
 * Regras pra quem cataloga: a chave começa com o prefixo da área; o valor do Padrão é a
 * frase atual do componente, sem mudar uma vírgula; frase com número ou nome vira função.
 *
 * O que ficou de fora de propósito: os rótulos que dizem "patrimônio" e "rentabilidade" (dois
 * cartões do Financiar vs. Alugar, dois campos de rentabilidade e a nota de rodapé do "Vale a
 * pena?"). O teste do Girly varre TODAS as chaves de títulos procurando jargão, e o Girly herda
 * o Padrão no que não reescreve — então essas frases só podem entrar aqui no mesmo passo em que
 * o Girly ganhar a versão dele. Até lá, continuam escritas no componente.
 */
export type TextosSimuladores = {
  // Comum aos simuladores: o assistente passo a passo, guardar e a lista de salvas
  simContinuar: string;
  simVerResultado: string;
  simAjustarRespostas: string;
  /** O "olho" acima do título de resultado, em cinco calculadoras e no "Vale a pena?". */
  simResultado: string;
  simSac: string;
  simPrice: string;
  simSim: string;
  simNao: string;
  /** "Custo do financiamento (CET)" e "Sistema de amortização" aparecem em três calculadoras. */
  simCet: string;
  simSistema: string;
  simSalvarBotao: string;
  simSalva: string;
  simSalvaToast: string;
  simSalvarErro: string;
  simSalvarNomePlaceholder: string;
  simSalvando: string;
  simSalvar: string;
  simCancelar: string;
  simSalvasTitulo: string;
  /** Nome de uma simulação salva sem nome e sem tipo conhecido. */
  simSalvaSemNome: string;
  /** O nome da área na tela de "isso é conteúdo do curso". */
  simPaywallNome: string;

  // Financiar vs. Alugar
  simFinEyebrow: string;
  simFinValorImovel: string;
  simFinValorImovelHint: string;
  simFinEntrada: string;
  simFinEntradaHint: string;
  simFinCetHint: string;
  simFinValorizacao: string;
  simFinValorizacaoHint: string;
  simFinPrazo: string;
  simFinPrazoHint: string;
  simFinSistemaHint: string;
  simFinAluguel: string;
  simFinAluguelHint: string;
  simFinReajuste: string;
  simFinReajusteHint: string;
  simFinRentabilidadeHint: string;
  simFinVenceFinanciar: string;
  simFinVenceAlugar: string;
  simFinValorFinanciado: string;

  // Amortizar vs. Investir
  simAmortEyebrow: string;
  simAmortSaldo: string;
  simAmortSaldoHint: string;
  simAmortCetHint: string;
  simAmortPrazoRestante: string;
  simAmortPrazoRestanteHint: string;
  simAmortSistemaHint: string;
  simAmortValorDisponivel: string;
  simAmortValorDisponivelHint: string;
  simAmortRentabilidadeHint: string;
  simAmortIr: string;
  simAmortIrHint: string;
  simAmortVenceAmortizar: string;
  simAmortVenceInvestir: string;
  /** "(R$ 1.234 a mais)" ao lado do veredito. */
  simAmortAMais(valor: string): string;
  simAmortBarraAmortizar: string;
  simAmortBarraAmortizarHint(meses: string): string;
  simAmortBarraInvestir: string;
  simAmortBarraInvestirHint(taxa: string): string;
  simAmortVeredito(vencedor: "AMORTIZAR" | "INVESTIR", valor: string): string;
  simAmortNota(semMeses: string, semJuros: string, comMeses: string, comJuros: string): string;

  // Consórcio vs. Financiamento
  simConsEyebrow: string;
  simConsValorBem: string;
  simConsValorBemHint: string;
  simConsTaxaAdm: string;
  simConsTaxaAdmHint: string;
  simConsPrazo: string;
  simConsPrazoHint: string;
  simConsEntrada: string;
  simConsEntradaHint: string;
  simConsCetHint: string;
  simConsPrazoFin: string;
  simConsPrazoFinHint: string;
  simConsSistemaHint: string;
  simConsOportunidade: string;
  simConsOportunidadeHint: string;
  simConsVenceConsorcio: string;
  simConsVenceFinanciamento: string;
  /** "(R$ 1.234)" ao lado do veredito. */
  simConsDiferenca(valor: string): string;
  simConsBarraConsorcio: string;
  simConsBarraConsorcioHint(parcela: string): string;
  simConsBarraFinanciamento: string;
  simConsBarraFinanciamentoHint: string;
  simConsVeredito(vencedor: "CONSORCIO" | "FINANCIAMENTO", valor: string): string;
  simConsParcela: string;
  simConsPrimeiraParcela: string;
  simConsCustoOportunidade: string;

  // Marcação a Mercado
  simMarcEyebrow: string;
  /** A dica da ANBIMA vem em duas metades porque o link fica no meio. */
  simMarcAnbimaAntes: string;
  simMarcAnbimaDepois: string;
  simMarcValorFace: string;
  simMarcValorFaceHint: string;
  simMarcTaxaContratada: string;
  simMarcTaxaContratadaHint: string;
  simMarcNovaTaxa: string;
  simMarcNovaTaxaHint: string;
  simMarcPrazoTotal: string;
  simMarcPrazoTotalHint: string;
  simMarcAnosRestantes: string;
  simMarcAnosRestantesHint: string;
  simMarcCupons: string;
  simMarcCuponsHint: string;
  simMarcDuration: string;
  simMarcDurationHint: string;
  simMarcInvestido: string;
  simMarcInvestidoHint: string;
  simMarcLucro: string;
  simMarcPrejuizo: string;
  simMarcSub: string;
  simMarcLucroVenda: string;
  simMarcSensibilidade: string;
  simMarcPrecoCarrego: string;
  simMarcPrecoMercado: string;
  simMarcValorMercado: string;
  simMarcLucroInvestido: string;
  simMarcHeatmap: string;

  // Carro: Assinar vs. Comprar
  simCarroEyebrow: string;
  simCarroValor: string;
  simCarroValorHint: string;
  simCarroRevenda1: string;
  simCarroRevenda1Hint: string;
  simCarroRevenda2: string;
  simCarroRevenda2Hint: string;
  simCarroCombustivel: string;
  simCarroCombustivelHint: string;
  simCarroAssinatura: string;
  simCarroAssinaturaHint: string;
  simCarroCustosFixos: string;
  simCarroCustosFixosHint: string;
  simCarroOportunidade: string;
  simCarroOportunidadeHint: string;
  simCarroResultado: string;
  simCarroVenceAssinar: string;
  simCarroVenceComprar: string;
  /** "(R$ 1.234)" ao lado do veredito. */
  simCarroDiferenca(valor: string): string;
  simCarroBarraAssinatura: string;
  simCarroBarraAssinaturaHint: string;
  simCarroBarraComprar: string;
  simCarroBarraComprarHint: string;
  simCarroVeredito(vencedor: "ASSINATURA" | "COMPRA", valor: string): string;
  simCarroCaixaAssinatura: string;
  simCarroCaixaCompra: string;
  simCarroCustoOportunidade: string;

  // Vale a pena comprar?
  simValeEyebrow: string;
  simValePasso1Titulo: string;
  simValePasso1Sub: string;
  simValePreco: string;
  simValeSimularRenda: string;
  simValeOk: string;
  /** "Valor-hora calculado com [sua renda de|uma renda simulada de] R$ X [em mês (Fluxo Financeiro)]" — em pedaços porque o valor vem em negrito e os botões ficam no meio. */
  simValeRendaIntro: string;
  simValeRendaSua: string;
  simValeRendaSimulada: string;
  simValeRendaMes(mes: string): string;
  simValeAlterar: string;
  simValeUsarCadastrada: string;
  /** "Você ainda não lançou renda em X. [simule um valor] pra ver…, ou [cadastre em Fluxo Financeiro]." */
  simValeSemRenda(mes: string): string;
  simValeSimuleValor: string;
  simValeSemRendaMeio: string;
  simValeCadastre: string;
  simValePasso2Titulo: string;
  simValePasso2Sub: string;
  simValeCompraUnica: string;
  simValeCompraUnicaDesc: string;
  simValeHabito: string;
  simValeHabitoDesc: string;
  simValeTitulo: string;
  simValeTempoUnico: string;
  simValeTempoMensal: string;
  simValeHorizontePergunta: string;
  /** "1 ano" / "5 anos" — os botões de horizonte. */
  simValeAnos(anos: string): string;
  simValeBarraInvestirUnico: string;
  simValeBarraInvestirMensal: string;
  simValeBarraInvestirHint(anos: string, taxa: string): string;
  simValeBarraGastar: string;
  simValeBarraGastarUnicoHint: string;
  simValeBarraGastarMensalHint: string;
  simValeVeredito(valor: string): string;
  simValeComprar: string;
  simValeNaoComprar: string;
  simValeAindaNaoSei: string;
  simValeEscolhaComprar: string;
  simValeEscolhaNao: string;
  simValeEscolhaDuvida: string;
};

export const PADRAO_SIMULADORES: TextosSimuladores = {
  // Comum aos simuladores
  simContinuar: "Continuar",
  simVerResultado: "Ver resultado",
  simAjustarRespostas: "Ajustar respostas",
  simResultado: "Resultado",
  simSac: "SAC (parcelas decrescentes)",
  simPrice: "Price (parcelas fixas)",
  simSim: "Sim",
  simNao: "Não",
  simCet: "Custo do financiamento (CET)",
  simSistema: "Sistema de amortização",
  simSalvarBotao: "Salvar esta simulação",
  simSalva: "Simulação salva",
  simSalvaToast: "Simulação salva. Ela fica na lista de simuladores.",
  simSalvarErro: "Não consegui salvar esta simulação.",
  simSalvarNomePlaceholder: "Dê um nome (opcional)",
  simSalvando: "Salvando…",
  simSalvar: "Salvar",
  simCancelar: "cancelar",
  simSalvasTitulo: "Suas simulações salvas",
  simSalvaSemNome: "Simulação",
  simPaywallNome: "Simuladores",

  // Financiar vs. Alugar
  simFinEyebrow: "Financiar vs. Alugar + Investir",
  simFinValorImovel: "Valor do imóvel",
  simFinValorImovelHint: "O preço de venda do imóvel que você quer comprar.",
  simFinEntrada: "Entrada",
  simFinEntradaHint: "Quanto você paga à vista. O restante é o valor financiado.",
  simFinCetHint: "Custo Efetivo Total ao ano, juros mais tarifas e seguros do financiamento.",
  simFinValorizacao: "Valorização do imóvel",
  simFinValorizacaoHint: "Quanto o imóvel valoriza por ano, em média.",
  simFinPrazo: "Prazo",
  simFinPrazoHint: "Em quantos meses o financiamento é pago (ex.: 360 = 30 anos).",
  simFinSistemaHint: "SAC: as parcelas começam maiores e caem com o tempo. Price: parcelas fixas do começo ao fim.",
  simFinAluguel: "Aluguel mensal",
  simFinAluguelHint: "Quanto custaria alugar o mesmo imóvel por mês (cenário alternativo).",
  simFinReajuste: "Reajuste anual do aluguel",
  simFinReajusteHint: "Quanto o aluguel sobe por ano (ex.: IGP-M ou IPCA).",
  simFinRentabilidadeHint: "Quanto rende por ano o dinheiro que você investiria em vez de comprar.",
  simFinVenceFinanciar: "Financiar sai na frente",
  simFinVenceAlugar: "Alugar e investir sai na frente",
  simFinValorFinanciado: "Valor financiado",

  // Amortizar vs. Investir
  simAmortEyebrow: "Amortizar vs. Investir",
  simAmortSaldo: "Saldo devedor",
  simAmortSaldoHint: "Quanto você ainda deve no financiamento hoje.",
  simAmortCetHint: "Custo Efetivo Total ao ano da dívida, juros mais tarifas e seguros.",
  simAmortPrazoRestante: "Prazo restante",
  simAmortPrazoRestanteHint: "Quantos meses faltam para quitar o financiamento.",
  simAmortSistemaHint: "SAC: parcelas decrescentes. Price: parcelas fixas.",
  simAmortValorDisponivel: "Valor disponível",
  simAmortValorDisponivelHint: "O dinheiro que sobrou e que você vai usar para amortizar OU investir.",
  simAmortRentabilidadeHint: "Quanto o investimento rende ao ano, antes de descontar o Imposto de Renda.",
  simAmortIr: "Alíquota de IR do investimento",
  simAmortIrHint: "Imposto de Renda sobre o rendimento (ex.: 15% para prazos longos).",
  simAmortVenceAmortizar: "Melhor amortizar",
  simAmortVenceInvestir: "Melhor investir",
  simAmortAMais: (valor) => `(${valor} a mais)`,
  simAmortBarraAmortizar: "Amortizar a dívida",
  simAmortBarraAmortizarHint: (meses) => `Economia de juros · quita em ${meses} meses`,
  simAmortBarraInvestir: "Investir o dinheiro",
  simAmortBarraInvestirHint: (taxa) => `Ganho já líquido de IR · ${taxa} a.a.`,
  simAmortVeredito: (vencedor, valor) => `${vencedor === "AMORTIZAR" ? "Amortizar" : "Investir"} rende ${valor} a mais.`,
  simAmortNota: (semMeses, semJuros, comMeses, comJuros) =>
    `Sem amortizar: ${semMeses} meses restantes, ${semJuros} de juros totais. Amortizando: quita em ${comMeses} meses, ${comJuros} de juros.`,

  // Consórcio vs. Financiamento
  simConsEyebrow: "Consórcio vs. Financiamento",
  simConsValorBem: "Valor do bem",
  simConsValorBemHint: "O valor da carta de crédito do consórcio / preço do bem que você quer.",
  simConsTaxaAdm: "Taxa de administração do consórcio",
  simConsTaxaAdmHint: "Taxa total cobrada pela administradora ao longo do consórcio (ex.: 18%).",
  simConsPrazo: "Prazo do consórcio",
  simConsPrazoHint: "Em quantos meses o consórcio é pago.",
  simConsEntrada: "Entrada do financiamento",
  simConsEntradaHint: "Quanto você daria de entrada se optasse pelo financiamento.",
  simConsCetHint: "Custo Efetivo Total ao ano do financiamento.",
  simConsPrazoFin: "Prazo do financiamento",
  simConsPrazoFinHint: "Em quantos meses o financiamento é pago.",
  simConsSistemaHint: "Price: parcelas fixas. SAC: parcelas decrescentes.",
  simConsOportunidade: "Taxa de oportunidade",
  simConsOportunidadeHint: "Quanto renderia por ano o dinheiro da entrada se estivesse investido (o consórcio não exige entrada).",
  simConsVenceConsorcio: "Consórcio sai mais barato",
  simConsVenceFinanciamento: "Financiamento sai mais barato",
  simConsDiferenca: (valor) => `(${valor})`,
  simConsBarraConsorcio: "Consórcio",
  simConsBarraConsorcioHint: (parcela) => `Total pago · parcela de ${parcela}`,
  simConsBarraFinanciamento: "Financiamento",
  simConsBarraFinanciamentoHint: "Custo total, já com o custo de oportunidade da entrada",
  simConsVeredito: (vencedor, valor) => `${vencedor === "CONSORCIO" ? "Consórcio" : "Financiamento"} sai ${valor} mais barato.`,
  simConsParcela: "Consórcio, parcela",
  simConsPrimeiraParcela: "Financiamento, 1ª parcela",
  simConsCustoOportunidade: "Custo de oportunidade da entrada",

  // Marcação a Mercado
  simMarcEyebrow: "Marcação a Mercado",
  simMarcAnbimaAntes: "Consulte o valor atualizado em",
  simMarcAnbimaDepois: "(Preços e Índices).",
  simMarcValorFace: "Valor de face",
  simMarcValorFaceHint: "Valor nominal do título na data de vencimento.",
  simMarcTaxaContratada: "Taxa contratada",
  simMarcTaxaContratadaHint: "A taxa que você travou ao comprar o título.",
  simMarcNovaTaxa: "Nova taxa de mercado",
  simMarcNovaTaxaHint: "A taxa que o mercado pratica hoje para esse título, é o que muda o preço na marcação a mercado.",
  simMarcPrazoTotal: "Prazo total",
  simMarcPrazoTotalHint: "Prazo do título, do início ao vencimento.",
  simMarcAnosRestantes: "Anos até o vencimento",
  simMarcAnosRestantesHint: "Quanto falta até o vencimento a partir de hoje.",
  simMarcCupons: "Paga juros semestrais?",
  simMarcCuponsHint: "Alguns títulos pagam cupons a cada semestre em vez de tudo no vencimento. Nesses casos, use a duration para medir a sensibilidade.",
  simMarcDuration: "Duration",
  simMarcDurationHint: "Prazo médio ponderado dos fluxos do título, mais curto que o vencimento por causa dos cupons.",
  simMarcInvestido: "Valor investido (opcional)",
  simMarcInvestidoHint: "Quanto você tem aplicado nesse título, para ver o resultado em reais. Pode deixar zerado.",
  simMarcLucro: "Venda antecipada daria lucro",
  simMarcPrejuizo: "Venda antecipada daria prejuízo",
  simMarcSub: "Levar até o vencimento elimina esse risco.",
  simMarcLucroVenda: "Lucro/Prejuízo na venda antecipada",
  simMarcSensibilidade: "Sensibilidade aproximada",
  simMarcPrecoCarrego: "Preço de carrego (taxa contratada)",
  simMarcPrecoMercado: "Preço a mercado (nova taxa)",
  simMarcValorMercado: "Valor de mercado hoje",
  simMarcLucroInvestido: "Lucro/Prejuízo sobre o investido",
  simMarcHeatmap: "Sensibilidade (duration × variação de taxa)",

  // Carro: Assinar vs. Comprar
  simCarroEyebrow: "Carro: Assinar vs. Comprar",
  simCarroValor: "Valor do carro 0km",
  simCarroValorHint: "Preço de compra do carro novo à vista.",
  simCarroRevenda1: "Revenda em 1 ano",
  simCarroRevenda1Hint: "Por quanto você venderia o carro depois de 1 ano.",
  simCarroRevenda2: "Revenda em 2 anos",
  simCarroRevenda2Hint: "Por quanto você venderia o carro depois de 2 anos.",
  simCarroCombustivel: "Combustível mensal",
  simCarroCombustivelHint: "Gasto médio de combustível por mês.",
  simCarroAssinatura: "Mensalidade da assinatura",
  simCarroAssinaturaHint: "Valor mensal do carro por assinatura (já inclui seguro, manutenção, IPVA).",
  simCarroCustosFixos: "Custos fixos anuais",
  simCarroCustosFixosHint: "IPVA, seguro, manutenção e licenciamento por ano, no caso de comprar.",
  simCarroOportunidade: "Custo de oportunidade",
  simCarroOportunidadeHint: "Quanto renderia por mês o dinheiro da compra se estivesse investido.",
  simCarroResultado: "Resultado (24 meses)",
  simCarroVenceAssinar: "Assinar sai mais barato",
  simCarroVenceComprar: "Comprar sai mais barato",
  simCarroDiferenca: (valor) => `(${valor})`,
  simCarroBarraAssinatura: "Assinatura",
  simCarroBarraAssinaturaHint: "Custo líquido em 24 meses",
  simCarroBarraComprar: "Comprar 0km",
  simCarroBarraComprarHint: "Custo líquido, já com depreciação e custo de oportunidade",
  simCarroVeredito: (vencedor, valor) => `${vencedor === "ASSINATURA" ? "Assinar" : "Comprar"} sai ${valor} mais barato em 24 meses.`,
  simCarroCaixaAssinatura: "Custo caixa, assinatura",
  simCarroCaixaCompra: "Custo caixa, compra",
  simCarroCustoOportunidade: "Custo de oportunidade da compra",

  // Vale a pena comprar?
  simValeEyebrow: "Vale a pena comprar?",
  simValePasso1Titulo: "Quanto custa isso?",
  simValePasso1Sub: "Digite o preço do item que você está pensando em comprar.",
  simValePreco: "Preço",
  simValeSimularRenda: "Simular com renda de",
  simValeOk: "ok",
  simValeRendaIntro: "Valor-hora calculado com",
  simValeRendaSua: "sua renda de",
  simValeRendaSimulada: "uma renda simulada de",
  simValeRendaMes: (mes) => `em ${mes} (Fluxo Financeiro)`,
  simValeAlterar: "alterar",
  simValeUsarCadastrada: "usar renda cadastrada",
  simValeSemRenda: (mes) => `Você ainda não lançou renda em ${mes}.`,
  simValeSimuleValor: "simule um valor",
  simValeSemRendaMeio: "pra ver o tempo de trabalho equivalente, ou",
  simValeCadastre: "cadastre em Fluxo Financeiro",
  simValePasso2Titulo: "Que tipo de gasto é esse?",
  simValePasso2Sub: "Isso muda como calculamos o quanto você deixaria de ganhar.",
  simValeCompraUnica: "Compra única",
  simValeCompraUnicaDesc: "Algo pontual, uma roupa, um eletrônico, uma viagem.",
  simValeHabito: "Hábito mensal",
  simValeHabitoDesc: "Se repete todo mês, assinatura, delivery, café.",
  simValeTitulo: "Vale a pena?",
  simValeTempoUnico: "Tempo de trabalho equivalente",
  simValeTempoMensal: "Tempo de trabalho por mês",
  simValeHorizontePergunta: "Se você não comprar e investir, em quanto tempo?",
  simValeAnos: (anos) => (anos === "1" ? "1 ano" : `${anos} anos`),
  simValeBarraInvestirUnico: "Investir esse dinheiro",
  simValeBarraInvestirMensal: "Resistir e investir",
  simValeBarraInvestirHint: (anos, taxa) => `Em ${anos} ${anos === "1" ? "ano" : "anos"}, a ${taxa}% ao ano`,
  simValeBarraGastar: "Gastar agora",
  simValeBarraGastarUnicoHint: "O preço de hoje",
  simValeBarraGastarMensalHint: "O que você pagaria no período",
  simValeVeredito: (valor) => `Investindo, você teria ${valor} a mais no fim.`,
  simValeComprar: "Comprar",
  simValeNaoComprar: "Não comprar",
  simValeAindaNaoSei: "Ainda não sei",
  simValeEscolhaComprar: "Se é prioridade pra você, ótimo, só garanta que cabe no seu orçamento do mês.",
  simValeEscolhaNao: "Boa escolha. Isso te aproxima das suas metas.",
  simValeEscolhaDuvida: "Sem problema. Dá pra voltar aqui quando tiver mais clareza, a dúvida já é um sinal de que vale pensar mais um pouco.",
};
