/**
 * Textos da área "carteira", na voz do Padrão — as frases EXATAS que o app tem hoje. Os temas
 * sobrescrevem o que quiserem em `vozes/<tema>.ts`; o que não sobrescrevem, cai aqui.
 *
 * Regras para quem cataloga: a chave começa com o prefixo da área; o valor do Padrão é a
 * frase atual do componente, sem mudar uma vírgula; frase com número ou nome vira função.
 *
 * Prefixos: `cart` é o miolo da carteira (lista de ativos, aporte do mês, por objetivo),
 * `fichas` é o módulo Análises, `meta` é a página de uma meta, e `graf` são os gráficos de
 * `components/charts` — eles são de cliente e servem várias telas, então o texto que mora
 * dentro deles (legenda, dica, chip) fica em um prefixo só, em vez de espalhado pelas áreas.
 *
 * Nomes de mercado (Ações, FIIs, Tijolo, Pós-fixado, "Duration") NÃO viram chave: são o
 * nome da coisa, não a voz do app.
 */
export type TextosCarteira = {
  // Carteira · lista de ativos (AssetsSection)
  cartSuaCarteira(n: number): string;
  /** Embaixo do título, só dado (06/10/2026): "21 ativos · 4 tipos". */
  cartResumo(ativos: number, tipos: number): string;
  /** O botão que trocou o aviso "R$ X guardados ainda não estão na carteira" do Mensal. */
  cartAtualizarAportes: string;
  cartAportesNada: string;
  cartAportesComo: string;
  /** Uma vez só, na primeira abertura com valor esperando destino. */
  cartAportesDica: string;
  cartMaisOpcoes: string;
  cartMostrarValores: string;
  cartOcultarValores: string;
  /** "+R$ 1.200 desde a compra" — o valor já chega com o sinal na frente. */
  cartDesdeACompra(valorComSinal: string): string;
  cartNovoAtivo: string;
  cartImportar: string;
  cartPrecoMedioIR: string;
  cartAtualizando: string;
  cartAtualizarCotacoes: string;
  cartCotacoesAtualizadas(n: number): string;
  cartCotacoesNaoAchei(n: number, lista: string): string;
  cartVinculados(n: number, rotulo: string): string;
  /** O rótulo que entra em `cartVinculados` quando o objetivo é uma meta: `meta "Viagem"`. */
  cartRotuloMeta(nome: string): string;
  cartPorTipo: string;
  cartTotal: string;
  cartOndeVoceEsta: string;
  cartTracinhoAlvo: string;
  cartAbaixoDoAlvo(n: number): string;
  cartAcimaDoAlvo(n: number): string;
  cartNaEstrategia: string;
  cartDefinaQuanto: string;
  cartDefinirEstrategia: string;
  cartPraFicarNoAlvo: string;
  cartVerRebalanceamento: string;
  cartTodos(n: number): string;
  cartDaCarteira(pct: string): string;
  cartAplicando: string;
  cartDefinirObjetivoDos(n: number): string;
  cartSuasMetas: string;
  cartObjetivosGerais: string;
  cartObjMeta: string;
  cartObjOutro: string;
  cartMetaPrefixo(nome: string): string;
  cartEditar: string;
  cartEditarAria(nome: string): string;
  cartAdicionar: string;
  cartSalvarAlteracoes: string;
  cartImportarCarteira: string;
  cartPrecoMedioDeclaracao: string;
  cartEditarAtivo: string;
  // Carteira · "você aportou X, em quais ativos entrou?" (AllocateContributionCard)
  cartAporteProntoTitulo: string;
  cartAporteEntrouEm(mes: string, n: number): string;
  cartMetasAndaram(lista: string): string;
  /** `lista` são os ativos cuja quantidade o app estimou pela cotação ao receber o aporte. */
  cartQuantidadeEstimada(lista: string): string;
  cartVoceAportou(valor: string, mes: string): string;
  cartCadastreAtivo: string;
  cartDigaQuanto: string;
  cartToquePraDizer: string;
  /** `meta` é o nome da meta escolhida ao lançar o aporte, ou null quando não escolheu. */
  cartEnquantoNaoDisser(meta: string | null): string;
  cartMetaDoAtivo(nome: string): string;
  cartQuantoEntrouEm(nome: string): string;
  cartVerOutros(n: number): string;
  cartFaltaDizer(valor: string): string;
  cartPassouDoAporte(valor: string): string;
  cartTudoDistribuido: string;
  /** Resgate (guardado negativo): o espelho do "você aportou", para a carteira descontar o que saiu. */
  cartVoceResgatou(valor: string, mes: string): string;
  cartToquePraDizerResgate: string;
  cartDigaQuantoSaiu: string;
  cartEnquantoNaoDisserResgate: string;
  cartQuantoSaiuDe(nome: string): string;
  cartFaltaDizerResgate(valor: string): string;
  cartPassouDoResgate(valor: string): string;
  cartResgateProntoTitulo: string;
  cartResgateSaiuDe(mes: string, n: number): string;
  cartMetasRecuaram(lista: string): string;
  cartResgateAplicado: string;
  cartAporteAplicado: string;
  cartAplicandoAporte: string;
  cartAtualizarCarteira: string;
  cartAtivoNaoEstaAqui: string;
  /** Confirmação do "Remover" do ativo: apagar é definitivo. */
  cartRemoverPergunta(nome: string): string;
  /** Só quando o ativo recebeu aporte deste mês ou do anterior: a distribuição sai junto. */
  cartRemoverAvisoAporte: string;
  cartRemoverSim: string;
  /** Card do Por objetivo quando a classe está dentro da folga do alvo (nem aportar, nem reduzir). */
  compNoAlvo: string;
  // Carteira vazia (AssetsSection, quem ainda não cadastrou nada), 06/10/2026: dois cartões,
  // um para cada situação. Em cima, em destaque, quem ainda não investe abre a conta; embaixo,
  // quem já investe cadastra o que tem.
  /** Cartão de cima: a etiqueta, o título, uma linha e o botão que leva para a EQI. */
  cartAbrirContaEtiqueta: string;
  cartAbrirContaTitulo: string;
  cartAbrirContaTexto: string;
  cartAbrirContaBotao: string;
  /** Cartão de baixo: quem já investe em algum lugar. */
  cartJaInvesteEtiqueta: string;
  cartJaInvesteTexto: string;
  /** O botão do cartão de baixo. */
  cartVazioCadastrar: string;
  /** Atalhos pequenos embaixo do botão. */
  cartVazioPoupanca: string;
  cartVazioCaixinha: string;
  cartVazioTenhoArquivo: string;
  // Reserva · "Guardei este mês" (planejamento/reserva-emergencia)
  /** O botão: lança o valor combinado por mês e soma na reserva. */
  reservaGuardeiBotao(valor: string): string;
  /** Embaixo do botão: o que ele faz, para ela não achar que o dinheiro sai de algum lugar. */
  reservaGuardeiDica: string;
  /** Depois de marcar: o mês já guardado. */
  reservaGuardeiFeito(mes: string): string;
  reservaGuardeiToast(valor: string): string;
  /** "Tempo até completar" quando a reserva já chegou no valor. */
  reservaPronta: string;
  // Carteira · por objetivo (page + StrategyComparisonSection)
  cartDaMeta(pct: string, valor: string): string;
  cartEditarEstrategia: string;
  /**
   * A frase "Você ainda não definiu uma [estratégia da carteira]. Defina os…" tem um link no
   * meio, então vai em três pedaços: antes do link, o texto do link e o que vem depois.
   */
  cartReferenciaMatematica: string;
  /** Por objetivo (06/10/2026): uma linha por tipo de investimento, "38% hoje · alvo 40%". */
  compHojeAlvo(hoje: string, alvo: string): string;
  // Análises · Insights (page, layout, InsightList)
  fichasTitulo: string;
  fichasSub: string;
  fichasInsightsVazio: string;
  fichasAtencaoTitulo: string;
  fichasTabInsights: string;
  fichasVerMais: string;
  // Análises · lista de fichas de um tipo (SheetListPage + páginas de Ações/FIIs/Stocks/ETFs)
  fichasAcoesTitulo: string;
  fichasAcoesSub: string;
  fichasFiisTitulo: string;
  fichasFiisSub: string;
  fichasStocksTitulo: string;
  fichasStocksSub: string;
  fichasEtfsTitulo: string;
  fichasEtfsSub: string;
  fichasAnalisesVazio: string;
  fichasSuasAnalises: string;
  fichasNaCarteira: string;
  fichasLidaEm(data: string): string;
  fichasNaoLida: string;
  fichasAnteriores(n: number): string;
  /** A legenda dos três pontinhos no pé da lista. */
  fichasLegenda: Record<"favoravel" | "neutro" | "atencao", string>;
  // Análises · criar ficha (os quatro formulários)
  fichasFichaCriada: string;
  fichasQualAcao: string;
  fichasQualFii: string;
  fichasQualEtf: string;
  fichasQualEmpresa: string;
  fichasExemploAcao: string;
  fichasExemploFii: string;
  fichasExemploEtf: string;
  fichasExemploEmpresa: string;
  fichasTipoFii: string;
  fichasLendo: string;
  fichasAnalisar: string;
  // Análises · a ficha (SheetPage, Laudo, Checklist, ParaVoce)
  fichasNotaDetalhada: string;
  fichasNotaDetalhadaSub: string;
  /** Os três sinais do laudo, em blocos: "a favor", "na média", "atenção". */
  fichasSinal: Record<"favoravel" | "neutro" | "atencao", string>;
  fichasTentarDeNovo: string;
  fichasLendoNumeros(ticker: string): string;
  fichasMudou: string;
  fichasEsconderNumeros: string;
  fichasVerNumeros(n: number): string;
  fichasComoLer: string;
  fichasReanalisar: string;
  fichasLendoCurto: string;
  fichasNotaAutomatica(nota: string): string;
  fichasDeDez: string;
  /** Os extremos do termômetro quando a pergunta não tem escala própria. */
  fichasEscalaPadrao: { low: string; high: string; mid: string };
  fichasRegua(referencia: string): string;
  fichasSoVoce: string;
  fichasRespondidas(respondidas: number, total: number): string;
  fichasOndeOlhar(onde: string): string;
  fichasMenos: string;
  fichasMais(n: number): string;
  fichasParaVoce: string;
  fichasNaSuaCarteira(ticker: string): string;
  fichasEstrategiaPede(classe: string, pct: string): string;
  fichasHoje(pct: string): string;
  fichasConcentra: string;
  fichasPorMil(mil: string): string;
  fichasNaoRecomendacao: string;
  // Página de uma meta (metas/[id])
  metaBreadcrumbPlanejamento: string;
  metaRitmo: Record<"NOT_STARTED" | "ON_TRACK" | "BEHIND" | "ACHIEVED", string>;
  metaRitmoLabel: string;
  metaMesesRestantes: string;
  metaFaltaGuardar: string;
  metaGuardarPorMes: string;
  metaTrajetoria: string;
  metaSalvarAlteracoes: string;
  metaDaquiAMeses(n: number): string;
  // Gráficos (components/charts)
  grafOutros: string;
  grafSemDados: string;
  grafAtual: string;
  grafIdeal: string;
  grafHoje: string;
  grafHojeMinusculo: string;
  grafDia(dia: string): string;
  grafEntrou: string;
  grafSaiu: string;
  grafEntrouValor(valor: string): string;
  grafSaiuValor(valor: string): string;
  /** O chip do mês: "Sobrou até aqui: R$ 900" ou "Faltou no mês: R$ 120". */
  grafSobrouChip(sobrou: boolean, mesAtual: boolean, valor: string): string;
  grafRenda: string;
  grafGastos: string;
  grafAportes: string;
  grafPlanejado: string;
  grafPrevisto: string;
  grafSobrou: string;
  grafFaltou: string;
  grafReserva: string;
  grafMetaLinha(valor: string): string;
  grafDaquiA(n: number): string;
  grafHojeValor(valor: string): string;
  grafPronta(pct: number): string;
  grafFalta(valor: string): string;
  grafCompletaEm(quando: string): string;
  grafNenhumGasto: string;
  grafAlugarInvestir: string;
  grafFinanciar: string;
  grafVereditoAlugar(diferenca: string, anos: number): string;
  grafVereditoFinanciar(diferenca: string, anos: number): string;
  grafAno(x: string): string;
  grafMes(x: string): string;
  grafNota: string;
  grafNotaDeDez(nota: string): string;
};

export const PADRAO_CARTEIRA: TextosCarteira = {
  // Carteira · lista de ativos
  cartSuaCarteira: (n) => `Sua carteira · ${n} ativo${n === 1 ? "" : "s"}`,
  cartResumo: (ativos, tipos) => `${ativos} ativo${ativos === 1 ? "" : "s"} · ${tipos} tipo${tipos === 1 ? "" : "s"}`,
  cartAtualizarAportes: "Atualizar aportes",
  cartAportesNada: "Tudo em dia: o que você guardou já está nos ativos.",
  cartAportesComo: "Quando você marcar Guardei numa meta ou lançar um aporte, o valor espera aqui até você dizer em qual ativo entrou.",
  cartAportesDica: "Assim a carteira e as metas andam juntas.",
  cartMaisOpcoes: "Mais opções",
  cartMostrarValores: "Mostrar valores",
  cartOcultarValores: "Ocultar valores",
  cartDesdeACompra: (v) => `${v} desde a compra`,
  cartNovoAtivo: "Novo ativo",
  cartImportar: "Importar",
  cartPrecoMedioIR: "Preço médio (IR)",
  cartAtualizando: "Atualizando...",
  cartAtualizarCotacoes: "Atualizar cotações",
  cartCotacoesAtualizadas: (n) => `${n} cotações atualizadas.`,
  cartCotacoesNaoAchei: (n, lista) => `${n} cotações atualizadas · não achei: ${lista}`,
  cartVinculados: (n, rotulo) => `${n} ativos vinculados a ${rotulo}.`,
  cartRotuloMeta: (nome) => `meta "${nome}"`,
  cartPorTipo: "Carteira atual, por tipo",
  cartTotal: "Total",
  cartOndeVoceEsta: "Onde você está × sua estratégia",
  cartTracinhoAlvo: "O tracinho é o seu alvo. Quem está atrás dele é o que comprar no próximo aporte.",
  cartAbaixoDoAlvo: (n) => `${n} abaixo do alvo`,
  cartAcimaDoAlvo: (n) => `${n} acima do alvo`,
  cartNaEstrategia: "Carteira na estratégia",
  cartDefinaQuanto: "Defina quanto quer ter em cada tipo e compare com a carteira atual.",
  cartDefinirEstrategia: "Definir estratégia →",
  cartPraFicarNoAlvo: "Para ficar no alvo:",
  cartVerRebalanceamento: "Ver rebalanceamento →",
  cartTodos: (n) => `Todos (${n})`,
  cartDaCarteira: (pct) => `${pct} da carteira`,
  cartAplicando: "Aplicando…",
  cartDefinirObjetivoDos: (n) => `Definir objetivo dos ${n}…`,
  cartSuasMetas: "Suas metas",
  cartObjetivosGerais: "Objetivos gerais",
  cartObjMeta: "Meta",
  cartObjOutro: "Outro",
  cartMetaPrefixo: (nome) => `Meta: ${nome}`,
  cartEditar: "Editar",
  cartEditarAria: (nome) => `Editar ${nome}`,
  cartAdicionar: "Adicionar",
  cartSalvarAlteracoes: "Salvar alterações",
  cartImportarCarteira: "Importar carteira",
  cartPrecoMedioDeclaracao: "Preço médio pela declaração de IR",
  cartEditarAtivo: "Editar ativo",
  // Carteira · aporte do mês
  cartAporteProntoTitulo: "Pronto, tudo conversando.",
  cartAporteEntrouEm: (mes, n) => `O aporte de ${mes} entrou em ${n} ativo${n === 1 ? "" : "s"}.`,
  cartMetasAndaram: (lista) => `Suas metas andaram junto: ${lista}.`,
  cartQuantidadeEstimada: (lista) =>
    `A quantidade de ${lista} foi estimada pela cotação de hoje. Se comprou a outro preço, ajuste em Editar.`,
  cartVoceAportou: (valor, mes) => `Você aportou ${valor} em ${mes}`,
  cartCadastreAtivo: "Cadastre o ativo que recebeu esse dinheiro e a carteira passa a bater com o que você lançou no mês.",
  cartDigaQuanto: "Diga quanto entrou em cada ativo.",
  cartToquePraDizer: "Toque para dizer em quais ativos entrou.",
  cartEnquantoNaoDisser: (meta) =>
    `Enquanto não disser, a carteira fica com um valor e o mês com outro${meta ? `, e a meta ${meta} não anda junto` : ""}.`,
  cartMetaDoAtivo: (nome) => `meta: ${nome}`,
  cartQuantoEntrouEm: (nome) => `Quanto entrou em ${nome}`,
  cartVerOutros: (n) => `Ver os outros ${n} ativos`,
  cartFaltaDizer: (valor) => `Falta dizer onde foram ${valor}`,
  cartPassouDoAporte: (valor) => `Passou ${valor} do que você aportou`,
  cartTudoDistribuido: "Tudo distribuído",
  cartVoceResgatou: (valor, mes) => `Você resgatou ${valor} em ${mes}`,
  cartToquePraDizerResgate: "Toque para dizer de qual investimento saiu.",
  cartDigaQuantoSaiu: "Diga quanto saiu de cada investimento.",
  cartEnquantoNaoDisserResgate: "Enquanto você não disser, a carteira continua contando esse dinheiro como investido.",
  cartQuantoSaiuDe: (nome) => `Quanto saiu de ${nome}`,
  cartFaltaDizerResgate: (valor) => `Falta dizer de onde saíram ${valor}`,
  cartPassouDoResgate: (valor) => `Passou ${valor} do que você resgatou`,
  cartResgateProntoTitulo: "Pronto, a carteira já desconta o resgate.",
  cartResgateSaiuDe: (mes, n) => `O resgate de ${mes} saiu de ${n} investimento${n === 1 ? "" : "s"}.`,
  cartMetasRecuaram: (lista) => `Suas metas recuaram junto: ${lista}.`,
  cartResgateAplicado: "Carteira atualizada com o resgate.",
  cartAporteAplicado: "Carteira e metas atualizadas com o aporte do mês.",
  cartAplicandoAporte: "Aplicando...",
  cartAtualizarCarteira: "É isso, atualizar carteira",
  cartAtivoNaoEstaAqui: "O ativo ainda não está aqui? Cadastre primeiro",
  cartRemoverPergunta: (nome) => `Remover ${nome}? Não dá para desfazer.`,
  cartRemoverAvisoAporte: "O dinheiro do mês que você disse que entrou nele volta a pedir destino.",
  cartRemoverSim: "Sim, remover",
  compNoAlvo: "No alvo",
  // Carteira vazia
  cartVazioCadastrar: "Cadastrar meus investimentos",
  cartVazioPoupanca: "Poupança",
  cartVazioCaixinha: "Caixinha do banco",
  cartVazioTenhoArquivo: "Arquivo da corretora",
  cartAbrirContaEtiqueta: "Ainda não investe?",
  cartAbrirContaTitulo: "Abra sua conta de investimentos",
  cartAbrirContaTexto: "Pelo celular, com a assessoria da Dani na EQI.",
  cartAbrirContaBotao: "Abrir minha conta",
  cartJaInvesteEtiqueta: "Já investe?",
  cartJaInvesteTexto: "Cadastre onde seu dinheiro está e acompanhe tudo aqui.",
  // Reserva · "Guardei este mês"
  reservaGuardeiBotao: (v) => `Guardei ${v} este mês`,
  reservaGuardeiDica: "Soma na reserva e entra no mês como dinheiro guardado.",
  reservaGuardeiFeito: (mes) => `Guardado em ${mes}`,
  reservaGuardeiToast: (v) => `${v} somados na reserva.`,
  reservaPronta: "Pronta!",
  // Carteira · por objetivo
  cartDaMeta: (pct, valor) => `${pct} da meta (${valor})`,
  cartEditarEstrategia: "editar estratégia",
  cartReferenciaMatematica: "É a conta com a sua estratégia, não recomendação de compra ou venda.",
  compHojeAlvo: (hoje, alvo) => `${hoje} hoje · alvo ${alvo}`,
  // Análises · Insights
  fichasTitulo: "Análises",
  fichasSub: "Sua saúde financeira e o que precisa de atenção agora.",
  fichasInsightsVazio: "Monte orçamento, metas e reserva para ver os insights aqui.",
  fichasAtencaoTitulo: "O que precisa de atenção",
  fichasTabInsights: "Insights",
  fichasVerMais: "Ver mais",
  // Análises · lista de fichas
  fichasAcoesTitulo: "Análises de Ações",
  fichasAcoesSub: "Digite o nome ou o código e o app faz a leitura dos números.",
  fichasFiisTitulo: "Análises de FIIs",
  fichasFiisSub: "Digite o nome ou o código e o app faz a leitura do fundo.",
  fichasStocksTitulo: "Análises de Stocks",
  fichasStocksSub: "Ações no exterior: digite o nome ou o código e o app faz a leitura.",
  fichasEtfsTitulo: "Análises de ETFs",
  fichasEtfsSub: "Digite o nome ou o código e o app faz a leitura do fundo.",
  fichasAnalisesVazio: "Nenhuma análise ainda. Digite um código acima e o app faz a leitura.",
  fichasSuasAnalises: "Suas análises",
  fichasNaCarteira: "na sua carteira",
  fichasLidaEm: (data) => `lida em ${data}`,
  fichasNaoLida: "ainda não lida",
  fichasAnteriores: (n) => `${n} anterior${n > 1 ? "es" : ""}`,
  fichasLegenda: { favoravel: "favorável", neutro: "na média", atencao: "atenção" },
  // Análises · criar ficha
  fichasFichaCriada: "Ficha criada com sucesso.",
  fichasQualAcao: "Qual ação?",
  fichasQualFii: "Qual fundo imobiliário?",
  fichasQualEtf: "Qual ETF?",
  fichasQualEmpresa: "Qual empresa?",
  fichasExemploAcao: "Nome ou código, ex.: Petrobras",
  fichasExemploFii: "Nome ou código, ex.: Kinea",
  fichasExemploEtf: "Nome ou código, ex.: S&P 500",
  fichasExemploEmpresa: "Nome ou código, ex.: Apple",
  fichasTipoFii: "Tipo de FII",
  fichasLendo: "Lendo...",
  fichasAnalisar: "Analisar",
  // Análises · a ficha
  fichasNotaDetalhada: "Minha nota detalhada (avançado)",
  fichasNotaDetalhadaSub: "A ficha completa, com nota de 0 a 10 por critério, para quem quer registrar a própria análise por escrito.",
  fichasSinal: { favoravel: "a favor", neutro: "na média", atencao: "atenção" },
  fichasTentarDeNovo: "Tentar de novo",
  fichasLendoNumeros: (ticker) => `Lendo os números de ${ticker}…`,
  fichasMudou: "Mudou desde a última leitura",
  fichasEsconderNumeros: "Esconder os números",
  fichasVerNumeros: (n) => `Ver os ${n} números ›`,
  fichasComoLer: "Como ler estes sinais",
  fichasReanalisar: "Reanalisar agora",
  fichasLendoCurto: "Lendo…",
  fichasNotaAutomatica: (nota) => `Nota automática ${nota} de 10`,
  fichasDeDez: "de 10",
  fichasEscalaPadrao: { low: "ruim", high: "bom", mid: "na média" },
  fichasRegua: (referencia) => `Régua: ${referencia}.`,
  fichasSoVoce: "Só você responde",
  fichasRespondidas: (respondidas, total) => `${respondidas} de ${total}`,
  fichasOndeOlhar: (onde) => `Onde olhar: ${onde}`,
  fichasMenos: "Menos",
  fichasMais: (n) => `Mais ${n} ›`,
  fichasParaVoce: "E para você?",
  fichasNaSuaCarteira: (ticker) => `${ticker} na sua carteira`,
  fichasEstrategiaPede: (classe, pct) => `${classe}: sua estratégia pede ${pct}`,
  fichasHoje: (pct) => `hoje ${pct}`,
  fichasConcentra: "Comprar mais te concentra ainda mais do que a sua estratégia pede.",
  fichasPorMil: (mil) => `por mês a cada ${mil}, pelos dividendos de hoje`,
  fichasNaoRecomendacao: "Não é recomendação: é a sua carteira lida junto com os números do ativo.",
  // Página de uma meta
  metaBreadcrumbPlanejamento: "Planejamento Financeiro",
  metaRitmo: { NOT_STARTED: "Sem prazo hábil", ON_TRACK: "Em progresso", BEHIND: "Atrasada", ACHIEVED: "Concluída" },
  metaRitmoLabel: "Ritmo",
  metaMesesRestantes: "Meses restantes",
  metaFaltaGuardar: "Falta guardar",
  metaGuardarPorMes: "Guardar por mês",
  metaTrajetoria: "Trajetória projetada até a meta",
  metaSalvarAlteracoes: "Salvar alterações",
  metaDaquiAMeses: (n) => `Daqui a ${n} meses`,
  // Gráficos
  grafOutros: "Outros",
  grafSemDados: "Sem dados ainda.",
  grafAtual: "Atual",
  grafIdeal: "Ideal",
  grafHoje: "Hoje",
  grafHojeMinusculo: "hoje",
  grafDia: (dia) => `Dia ${dia}`,
  grafEntrou: "Entrou",
  grafSaiu: "Saiu",
  grafEntrouValor: (valor) => `Entrou ${valor}`,
  grafSaiuValor: (valor) => `Saiu ${valor}`,
  grafSobrouChip: (sobrou, mesAtual, valor) => `${sobrou ? "Sobrou" : "Faltou"} ${mesAtual ? "até aqui" : "no mês"}: ${valor}`,
  grafRenda: "Renda",
  grafGastos: "Gastos",
  grafAportes: "Aportes",
  grafPlanejado: "Planejado",
  grafPrevisto: "(previsto)",
  grafSobrou: "Sobrou",
  grafFaltou: "Faltou",
  grafReserva: "Reserva",
  grafMetaLinha: (valor) => `meta ${valor}`,
  grafDaquiA: (n) => `Daqui a ${n} ${n === 1 ? "mês" : "meses"}`,
  grafHojeValor: (valor) => `Hoje: ${valor}`,
  grafPronta: (pct) => `${pct}% pronta`,
  grafFalta: (valor) => `Falta ${valor}`,
  grafCompletaEm: (quando) => `Completa em ${quando}`,
  grafNenhumGasto: "Nenhum gasto neste período.",
  grafAlugarInvestir: "Alugar + investir",
  grafFinanciar: "Financiar",
  grafVereditoAlugar: (diferenca, anos) => `Alugar e investir sai ${diferenca} à frente em ${anos} anos.`,
  grafVereditoFinanciar: (diferenca, anos) => `Financiar sai ${diferenca} à frente em ${anos} anos.`,
  grafAno: (x) => `Ano ${x}`,
  grafMes: (x) => `Mês ${x}`,
  grafNota: "Nota",
  grafNotaDeDez: (nota) => `${nota} / 10`,
};
