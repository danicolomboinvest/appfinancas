export type CriterionSeed = {
  key: string;
  label: string;
  category: string;
  helpText?: string;
  order: number;
};

/**
 * Critérios de Ações citados no briefing original. A planilha fala em "~40 critérios",
 * mas só nomeia estes ~22 explicitamente — o restante fica a critério da educadora
 * cadastrar depois pela tela /admin/criterios, sem precisar de deploy.
 */
export const STOCK_CRITERIA: CriterionSeed[] = [
  // Qualitativos
  { key: "tag_along", label: "Tag Along", category: "Qualitativo", order: 1, helpText: "Edital de registro da empresa na B3 / estatuto social." },
  { key: "free_float", label: "Free Float", category: "Qualitativo", order: 2, helpText: "Percentual de ações em circulação no mercado, fora do controle dos majoritários." },
  { key: "liquidez", label: "Liquidez", category: "Qualitativo", order: 3, helpText: "Volume médio diário negociado — quanto maior, mais fácil comprar/vender sem afetar o preço." },
  { key: "socios_majoritarios", label: "Sócios Majoritários", category: "Qualitativo", order: 4, helpText: "Quem controla a empresa e seu histórico de conduta com minoritários." },
  { key: "historico_polemicas", label: "Histórico de Polêmicas", category: "Qualitativo", order: 5, helpText: "Escândalos, processos, investigações — pesquisar notícias e relatórios de compliance." },
  { key: "satisfacao_funcionarios", label: "Satisfação de Funcionários", category: "Qualitativo", order: 6, helpText: "Glassdoor e avaliações de ex-funcionários." },
  { key: "satisfacao_clientes", label: "Satisfação de Clientes", category: "Qualitativo", order: 7, helpText: "Reclame Aqui, redes sociais, NPS divulgado pela empresa." },
  { key: "qualidade_ri", label: "Qualidade do RI", category: "Qualitativo", order: 8, helpText: "Clareza e frequência das comunicações do Relacionamento com Investidores." },
  { key: "perenidade", label: "Perenidade", category: "Qualitativo", order: 9, helpText: "Capacidade do negócio de se manter relevante e sustentável no longo prazo." },
  { key: "riscos", label: "Riscos", category: "Qualitativo", order: 10, helpText: "Riscos regulatórios, setoriais, cambiais e de concorrência." },
  { key: "vantagens_competitivas", label: "Vantagens Competitivas", category: "Qualitativo", order: 11, helpText: "Marca, escala, patentes, custo de troca — o que protege a empresa da concorrência." },
  { key: "momento_empresa", label: "Momento da Empresa", category: "Qualitativo", order: 12, helpText: "Fase de crescimento, maturidade ou dificuldade que a empresa atravessa." },
  // Quantitativos
  { key: "divida_liquida_patrimonio", label: "Dívida Líquida / Patrimônio", category: "Quantitativo", order: 13, helpText: "Divida líquida ÷ patrimônio líquido — quanto menor, menos endividada." },
  { key: "divida_liquida_ebitda", label: "Dívida Líquida / EBITDA", category: "Quantitativo", order: 14, helpText: "Quantos anos de geração de caixa operacional seriam necessários para quitar a dívida líquida." },
  { key: "evolucao_receita", label: "Evolução de Receita", category: "Quantitativo", order: 15, helpText: "Crescimento da receita nos últimos anos — releases trimestrais da empresa." },
  { key: "evolucao_lucro", label: "Evolução de Lucro", category: "Quantitativo", order: 16, helpText: "Crescimento do lucro líquido nos últimos anos." },
  { key: "evolucao_fluxo_caixa", label: "Evolução de Fluxo de Caixa", category: "Quantitativo", order: 17, helpText: "Geração de caixa operacional ao longo do tempo." },
  { key: "margem_liquida", label: "Margem Líquida", category: "Quantitativo", order: 18, helpText: "Lucro líquido ÷ receita líquida." },
  { key: "roe", label: "ROE (Retorno sobre Patrimônio)", category: "Quantitativo", order: 19, helpText: "Lucro líquido ÷ patrimônio líquido." },
  { key: "roic", label: "ROIC (Retorno sobre Capital Investido)", category: "Quantitativo", order: 20, helpText: "(EBIT − impostos) ÷ capital investido." },
  { key: "payout", label: "Payout", category: "Quantitativo", order: 21, helpText: "Percentual do lucro distribuído como dividendos." },
  { key: "dividend_yield", label: "Dividend Yield", category: "Quantitativo", order: 22, helpText: "Dividendos pagos nos últimos 12 meses ÷ preço da ação." },
];

/**
 * Critérios de ações internacionais (Stocks). Mesma base de STOCK_CRITERIA, mas sem
 * `tag_along` (mecanismo específico da legislação societária brasileira/B3, sem equivalente
 * direto em outros mercados) e com `exposicao_cambial` no lugar — um risco real e adicional
 * que só existe quando o investidor brasileiro compra um ativo cotado em outra moeda.
 */
export const STOCK_INTL_CRITERIA: CriterionSeed[] = [
  // Qualitativos
  { key: "free_float", label: "Free Float", category: "Qualitativo", order: 1, helpText: "Percentual de ações em circulação no mercado, fora do controle dos majoritários." },
  { key: "exposicao_cambial", label: "Exposição Cambial", category: "Qualitativo", order: 2, helpText: "O retorno em reais depende também da variação da moeda do ativo (ex.: dólar) frente ao real, além do preço da ação." },
  { key: "liquidez", label: "Liquidez", category: "Qualitativo", order: 3, helpText: "Volume médio diário negociado — quanto maior, mais fácil comprar/vender sem afetar o preço." },
  { key: "socios_majoritarios", label: "Sócios Majoritários", category: "Qualitativo", order: 4, helpText: "Quem controla a empresa e seu histórico de conduta com minoritários." },
  { key: "historico_polemicas", label: "Histórico de Polêmicas", category: "Qualitativo", order: 5, helpText: "Escândalos, processos, investigações — pesquisar notícias e relatórios de compliance." },
  { key: "satisfacao_funcionarios", label: "Satisfação de Funcionários", category: "Qualitativo", order: 6, helpText: "Glassdoor e avaliações de ex-funcionários." },
  { key: "satisfacao_clientes", label: "Satisfação de Clientes", category: "Qualitativo", order: 7, helpText: "Reclame Aqui, redes sociais, NPS divulgado pela empresa." },
  { key: "qualidade_ri", label: "Qualidade do RI", category: "Qualitativo", order: 8, helpText: "Clareza e frequência das comunicações do Relacionamento com Investidores." },
  { key: "perenidade", label: "Perenidade", category: "Qualitativo", order: 9, helpText: "Capacidade do negócio de se manter relevante e sustentável no longo prazo." },
  { key: "riscos", label: "Riscos", category: "Qualitativo", order: 10, helpText: "Riscos regulatórios, setoriais, cambiais e de concorrência." },
  { key: "vantagens_competitivas", label: "Vantagens Competitivas", category: "Qualitativo", order: 11, helpText: "Marca, escala, patentes, custo de troca — o que protege a empresa da concorrência." },
  { key: "momento_empresa", label: "Momento da Empresa", category: "Qualitativo", order: 12, helpText: "Fase de crescimento, maturidade ou dificuldade que a empresa atravessa." },
  // Quantitativos
  { key: "divida_liquida_patrimonio", label: "Dívida Líquida / Patrimônio", category: "Quantitativo", order: 13, helpText: "Divida líquida ÷ patrimônio líquido — quanto menor, menos endividada." },
  { key: "divida_liquida_ebitda", label: "Dívida Líquida / EBITDA", category: "Quantitativo", order: 14, helpText: "Quantos anos de geração de caixa operacional seriam necessários para quitar a dívida líquida." },
  { key: "evolucao_receita", label: "Evolução de Receita", category: "Quantitativo", order: 15, helpText: "Crescimento da receita nos últimos anos — releases trimestrais da empresa." },
  { key: "evolucao_lucro", label: "Evolução de Lucro", category: "Quantitativo", order: 16, helpText: "Crescimento do lucro líquido nos últimos anos." },
  { key: "evolucao_fluxo_caixa", label: "Evolução de Fluxo de Caixa", category: "Quantitativo", order: 17, helpText: "Geração de caixa operacional ao longo do tempo." },
  { key: "margem_liquida", label: "Margem Líquida", category: "Quantitativo", order: 18, helpText: "Lucro líquido ÷ receita líquida." },
  { key: "roe", label: "ROE (Retorno sobre Patrimônio)", category: "Quantitativo", order: 19, helpText: "Lucro líquido ÷ patrimônio líquido." },
  { key: "roic", label: "ROIC (Retorno sobre Capital Investido)", category: "Quantitativo", order: 20, helpText: "(EBIT − impostos) ÷ capital investido." },
  { key: "payout", label: "Payout", category: "Quantitativo", order: 21, helpText: "Percentual do lucro distribuído como dividendos." },
  { key: "dividend_yield", label: "Dividend Yield", category: "Quantitativo", order: 22, helpText: "Dividendos pagos nos últimos 12 meses ÷ preço da ação." },
];

/**
 * Critérios de ETFs. Não existia catálogo prévio — desenhado a partir dos pontos padrão de
 * análise de fundos de índice (custo, tamanho/liquidez, aderência ao benchmark e composição).
 */
export const ETF_CRITERIA: CriterionSeed[] = [
  // Qualitativos
  { key: "indice_referencia", label: "Índice de Referência", category: "Qualitativo", order: 1, helpText: "Qual índice o ETF busca replicar (S&P 500, Ibovespa, Nasdaq 100...) — página do ETF ou do gestor." },
  { key: "metodo_replicacao", label: "Método de Réplica", category: "Qualitativo", order: 2, helpText: "Física (compra os ativos do índice) ou sintética (via derivativos) — regulamento do fundo." },
  { key: "gestora", label: "Gestora/Administradora", category: "Qualitativo", order: 3, helpText: "Reputação e histórico de quem administra o ETF (ex.: BlackRock, Vanguard, Itaú)." },
  { key: "setor_geografia", label: "Setor/Geografia", category: "Qualitativo", order: 4, helpText: "Concentração setorial ou geográfica da carteira — pode reduzir a diversificação esperada." },
  { key: "data_inicio", label: "Data de Início", category: "Qualitativo", order: 5, helpText: "Quanto tempo o ETF já existe — um track record mais longo dá mais segurança sobre a gestão." },
  { key: "concentracao_carteira", label: "Concentração da Carteira", category: "Qualitativo", order: 6, helpText: "Peso dos maiores ativos na carteira — quanto mais concentrado, menos diversificado na prática." },
  // Quantitativos
  { key: "taxa_administracao_etf", label: "Taxa de Administração", category: "Quantitativo", order: 7, helpText: "Percentual anual cobrado — quanto menor, melhor para o retorno de longo prazo." },
  { key: "patrimonio_liquido_etf", label: "Patrimônio Líquido", category: "Quantitativo", order: 8, helpText: "Tamanho do fundo — fundos maiores tendem a ter mais liquidez e menor risco de fechamento." },
  { key: "liquidez_etf", label: "Liquidez", category: "Quantitativo", order: 9, helpText: "Volume médio diário negociado — quanto maior, mais fácil entrar/sair da posição." },
  { key: "dividend_yield_etf", label: "Dividend Yield", category: "Quantitativo", order: 10, helpText: "Rendimento de dividendos pagos nos últimos 12 meses." },
  { key: "rentabilidade_12m", label: "Rentabilidade 12 Meses", category: "Quantitativo", order: 11, helpText: "Retorno do ETF no último ano — compare sempre com o índice de referência que ele busca replicar." },
  { key: "rentabilidade_5anos", label: "Rentabilidade 5 Anos", category: "Quantitativo", order: 12, helpText: "Retorno acumulado nos últimos 5 anos — ajuda a avaliar consistência além do curto prazo." },
  { key: "tracking_error", label: "Tracking Error", category: "Quantitativo", order: 13, helpText: "Diferença entre o retorno do ETF e o do índice replicado — quanto menor, mais fiel a réplica." },
];

/**
 * Critérios de FIIs. category = "TIJOLO" | "PAPEL" aparecem só na ficha do tipo
 * correspondente; "COMUM" aparece nas duas.
 */
export const FII_CRITERIA: CriterionSeed[] = [
  { key: "mandato", label: "Mandato", category: "COMUM", order: 1, helpText: "Objetivo declarado do fundo — regulamento do fundo (B3 / site do administrador)." },
  { key: "segmento", label: "Segmento", category: "COMUM", order: 2, helpText: "Setor de atuação (lajes, galpões, shoppings, recebíveis...)." },
  { key: "tipo_gestao", label: "Tipo de Gestão", category: "COMUM", order: 3, helpText: "Ativa ou passiva — relatório gerencial do fundo." },
  { key: "liquidez_fii", label: "Liquidez", category: "COMUM", order: 4, helpText: "Volume médio diário negociado — B3 / Funds Explorer." },
  { key: "administrador_gestor", label: "Administrador/Gestor", category: "COMUM", order: 5, helpText: "Histórico e reputação de quem administra/gere o fundo." },
  { key: "taxa_administracao", label: "Taxa de Administração", category: "COMUM", order: 6, helpText: "Percentual anual sobre o patrimônio — regulamento do fundo." },
  { key: "taxa_performance", label: "Taxa de Performance", category: "COMUM", order: 7, helpText: "Percentual sobre o que exceder o benchmark do fundo, se houver." },
  { key: "patrimonio_liquido", label: "Patrimônio Líquido", category: "COMUM", order: 8, helpText: "Tamanho do fundo — relatório gerencial mensal." },
  { key: "historico_proventos", label: "Histórico de Proventos", category: "COMUM", order: 9, helpText: "Consistência dos dividendos distribuídos — fiis.com.br / Funds Explorer." },

  { key: "numero_imoveis", label: "Número de Imóveis", category: "TIJOLO", order: 10, helpText: "Quantidade de imóveis na carteira — relatório gerencial." },
  { key: "qualidade_imoveis", label: "Qualidade dos Imóveis", category: "TIJOLO", order: 11, helpText: "Localização, padrão construtivo e idade dos imóveis." },
  { key: "vacancia_atual", label: "Vacância Atual", category: "TIJOLO", order: 12, helpText: "Percentual de área vaga hoje — relatório gerencial mensal." },
  { key: "vacancia_historica", label: "Vacância Histórica", category: "TIJOLO", order: 13, helpText: "Evolução da vacância ao longo do tempo." },
  { key: "qualidade_inquilinos", label: "Qualidade dos Inquilinos", category: "TIJOLO", order: 14, helpText: "Solidez financeira e reputação dos principais inquilinos." },
  { key: "diversificacao_inquilinos", label: "Diversificação de Inquilinos", category: "TIJOLO", order: 15, helpText: "Concentração de receita em poucos inquilinos é um risco." },
  { key: "tipologia_contratos", label: "Tipologia dos Contratos", category: "TIJOLO", order: 16, helpText: "Típico ou atípico — impacta a previsibilidade da receita." },
  { key: "vencimento_contratos", label: "Vencimento dos Contratos", category: "TIJOLO", order: 17, helpText: "Prazo remanescente dos contratos de locação." },
  { key: "indices_reajuste_tijolo", label: "Índices de Reajuste", category: "TIJOLO", order: 18, helpText: "IGP-M, IPCA ou outro índice usado para reajustar os aluguéis." },
  { key: "alavancagem", label: "Alavancagem", category: "TIJOLO", order: 19, helpText: "Nível de dívida do fundo em relação ao patrimônio." },

  { key: "p_vp", label: "P/VP", category: "PAPEL", order: 10, helpText: "Preço da cota ÷ valor patrimonial por cota — fiis.com.br." },
  { key: "nivel_risco_operacoes", label: "Nível de Risco das Operações", category: "PAPEL", order: 11, helpText: "Rating de crédito dos CRIs/recebíveis na carteira." },
  { key: "diversificacao_operacoes", label: "Diversificação das Operações", category: "PAPEL", order: 12, helpText: "Concentração em poucos devedores é um risco de crédito." },
  { key: "indexadores_reajuste", label: "Indexadores de Reajuste", category: "PAPEL", order: 13, helpText: "CDI, IPCA ou outro indexador dos recebíveis." },
  { key: "ltv", label: "Loan to Value (LTV)", category: "PAPEL", order: 14, helpText: "Saldo devedor ÷ valor da garantia — quanto menor, mais colchão de segurança." },
  { key: "duration_papel", label: "Duration", category: "PAPEL", order: 15, helpText: "Prazo médio ponderado dos recebíveis da carteira." },
  { key: "estrutura_garantias", label: "Estrutura de Garantias", category: "PAPEL", order: 16, helpText: "Alienação fiduciária, aval, fiança — quais garantias protegem cada operação." },
  { key: "tipos_cri", label: "Tipos de CRIs", category: "PAPEL", order: 17, helpText: "Pulverizado, corporativo, residencial — perfil dos CRIs na carteira." },
  { key: "subordinacao", label: "Subordinação", category: "PAPEL", order: 18, helpText: "Existência de cotas subordinadas que absorvem perdas antes das cotas seniores." },
];
