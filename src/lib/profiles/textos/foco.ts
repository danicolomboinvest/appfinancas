/**
 * Textos da aba Foco (`/mensal/foco`) e do "Posso comprar?" (`/decidir`), na voz do Padrão.
 * Cada tema sobrescreve em `vozes/<tema>.ts`. Prefixo `foco`.
 *
 * Regra que vale aqui como em todo o app: a cobrança fala do número, nunca da pessoa.
 *
 * Os rótulos das janelas dos avisos (`aviso*`), da tela do Decidir (`dec*`) e dos campos do
 * "Posso comprar?" (`compra*`) moravam escritos direto nos componentes, e aí o Girly dizia
 * "Plano", "orçamento" e "aplicação" no meio de uma tela que falava "combinado". Agora passam
 * pela voz como o resto; o Padrão é o texto que já estava na tela, sem o jargão.
 */

/** As perguntas do Decidir, pela chave da rota: o slug de `/decidir/pergunta/<slug>`, mais o
 * "Posso comprar?" e as decisões grandes (as calculadoras). */
export type PerguntaDoDecidir =
  | "comprar"
  | "semana"
  | "gastando"
  | "exagerando"
  | "guardar"
  | "meta"
  | "reserva"
  | "acabou"
  | "melhorei"
  | "raiox"
  | "valeAPena"
  | "financiar"
  | "amortizar"
  | "consorcio"
  | "carro"
  | "marcacao";

export type TextosFoco = {
  focoTitulo: string;
  /** "Livre pra gastar essa semana" (ritmo semanal). */
  focoLivreSemana: string;
  /** "Livre até o fim do mês" (ritmo mensal). */
  focoLivreMes: string;
  focoLivreSub: string;
  /** Quando ainda não há gasto nenhum no mês: o número sai do planejado. */
  focoLivreEstimativa: string;
  focoLivreEstimativaSub(porSemana: string): string;
  focoSemOrcamentoTitulo: string;
  focoSemOrcamentoSub: string;
  focoSemOrcamentoBotao: string;
  focoMesPassou: string;
  focoOrcamentoUsado: string;
  focoComoCheguei: string;
  /** Aviso quando o último gasto lançado é antigo: o número pode estar alto demais. */
  focoDadosVelhos(dias: number): string;
  focoImportar: string;
  focoAtencao: string;
  focoNadaTitulo: string;
  focoNadaSub: string;
  focoMaisEsperam(n: number): string;
  /** O botão de cada aviso da atenção. */
  focoAcao: string;
  focoBem: string;
  focoDuvida: string;
  focoFioTitulo: string;
  focoResumoMes(mes: string): string;
  focoVerMes: string;
  // Itens do motor de priorização
  focoEstouroT(categoria: string): string;
  focoEstouroP(gasto: string, plano: string, dias: number): string;
  focoAporteT(valor: string): string;
  focoAporteP: string;
  focoRitmoT(categoria: string, pct: string): string;
  focoRitmoP(dias: number, sobra: string): string;
  focoMetaT(meta: string): string;
  focoMetaP(falta: string): string;
  /** Meta com o prazo vencido: não dá pra "voltar ao prazo". */
  focoMetaVencidaP: string;
  /** Meta com prazo neste mês: o que falta é o total, não "por mês". */
  focoMetaUltimoMesP(falta: string): string;
  /** Gasto fora das categorias do orçamento que come o "livre". */
  focoForaT(valor: string): string;
  focoForaP(livre: string): string;
  /** Semanal que nunca lançou gasto com data. */
  focoDadosNenhum: string;
  focoReservaT(meses: string): string;
  focoReservaP: string;
  focoBemRitmo(categoria: string): string;
  focoBemMeta(meta: string, quando: string): string;
  focoBemAporte(valor: string): string;
  // Ritmo de acompanhamento
  focoRitmoPergunta: string;
  focoRitmoSemanal: string;
  focoRitmoSemanalSub: string;
  focoRitmoMensal: string;
  focoRitmoMensalSub: string;
  focoRitmoAtual(semanal: boolean): string;
  focoRitmoTrocar: string;
  // Posso comprar?
  compraTitulo: string;
  compraOk: string;
  compraCusto: string;
  compraNao: string;
  compraDesisti: string;
  compraAmanha: string;
  /** A linha embaixo do título da tela. */
  compraSub: string;
  compraOQue: string;
  compraOQueExemplo: string;
  compraValorTotal: string;
  compraAVista: string;
  /** "À vista com 5%": o desconto que a loja dá. */
  compraAVistaComDesconto(pct: string): string;
  compraParcelado: string;
  compraVezes: string;
  compraJurosMes: string;
  compraDescontoVista: string;
  compraDigiteValor: string;
  compraPrecisoRenda: string;
  compraPrecisoOrcamento: string;
  compraSemChute: string;
  compraPreencher: string;
  /** "Do que entra por mês, já tem destino **62%**": o número vem em negrito logo depois. No
   * lugar de "renda comprometida", que é palavra de banco. */
  compraJaTemDestino: string;
  /** De onde saiu o número acima, entre parênteses (começa com espaço). */
  compraFonteReal: string;
  compraFonteMes: string;
  compraFontePlano: string;
  compraMaisDecididas: string;
  /** "Com a compra:" e o número de depois, em negrito. */
  compraComACompra: string;
  /** Depois do alerta de juros altos. */
  compraJunteAVista: string;
  compraColunaHoje: string;
  compraColunaComCompra: string;
  compraRegraDeOuro: string;
  compraParceladoRendendo: string;
  compraParceladoValorHoje(valor: string): string;
  compraVistaVale: string;
  compraParcelarVale: string;
  compraDiferenca(valor: string): string;
  compraSoSeRender: string;
  compraDescontoGanha: string;
  /** A taxa usada na conta à vista × parcelado. */
  compraRendimentoRef(pct: string): string;
  /** O que vem depois de "Decidir amanhã" no botão, com o espaço na frente. */
  compraAmanhaDica: string;
  compraAmanhaFeito: string;
  compraVouComprar: string;
  compraCompreiNaoCabe: string;
  compraCompreiCabe: string;
  compraDesistiFeito(valor: string): string;
  compraSimularOutra: string;
  compraErroSalvar: string;
  // Decidir: o catálogo de perguntas
  decTitulo: string;
  decSub: string;
  decDiaADia: string;
  decGrandes: string;
  decPerguntas: Record<PerguntaDoDecidir, string>;
  /** Embaixo do "Vale a pena comprar?", nas decisões grandes. */
  decValeAPenaSub: string;
  decSimulacoesSalvas(quantas: number): string;
  decVerCalculadoras: string;
  decPergunteTambem: string;
  // Raio-X: os rótulos fixos da tela
  raioxJuntosAno: string;
  /** "Investidos por 5 anos, virariam cerca de **R$ X**": o valor vem em negrito depois. */
  raioxCincoAnos: string;
  raioxComoAchei: string;
  raioxNosUltimos(meses: number): string;
  raioxVezesPorMes(vezes: number): string;
  // Cartões do Foco: ritual, fechamento, "decidir amanhã", Raio-X, teto
  focoRitualEy: string;
  focoRitualT: string;
  focoRitualP: string;
  focoFechEy: string;
  focoFechT(mes: string): string;
  focoFechP: string;
  focoComecar: string;
  focoAmanhaT(descricao: string, valor: string): string;
  focoAmanhaP: string;
  focoAindaQuero: string;
  focoRaioXT(n: number): string;
  focoRaioXP(anual: string): string;
  focoBemTeto(categoria: string, valor: string): string;
  focoTetoBotao(valor: string): string;
  /** Categoria que já estourou: a decisão é parar de gastar nela até o mês acabar. */
  focoSegurarBotao(categoria: string): string;
  focoPontual: string;
  focoRitualFeito: string;
  focoFechFeito(mes: string): string;
  // AvisoFoco: a janela de cada aviso (o número, a barra, os botões) e o cartão do combinado
  avisoAcimaDoPlano(categoria: string): string;
  avisoRodapeGasto(valor: string): string;
  avisoRodapePlano(valor: string): string;
  avisoRodapeGuardado(valor: string): string;
  avisoNadaMaisT: string;
  avisoNadaMaisSub(categoria: string): string;
  avisoNadaMaisFeito(categoria: string): string;
  avisoPlanoBaixoT: string;
  avisoPlanoBaixoSub(categoria: string, valor: string): string;
  avisoPlanoBaixoFeito(categoria: string, valor: string): string;
  avisoPontualT: string;
  avisoPontualSub: string;
  /** Toast de quem escondeu o aviso até o mês que vem. */
  avisoAnotado: string;
  avisoErroSalvar: string;
  avisoOndeFoi(categoria: string): string;
  avisoSobramEm(categoria: string, dias: number): string;
  avisoRitmoSelo: string;
  avisoTetoT(valor: string): string;
  avisoTetoSub(categoria: string): string;
  avisoTetoFeito(valor: string, categoria: string): string;
  avisoForaLegenda: string;
  avisoForaSelo(livre: string): string;
  avisoForaLista(quantos: number): string;
  avisoCriarCategoriaT: string;
  avisoCriarCategoriaSub: string;
  avisoEntendiT: string;
  avisoEntendiSub: string;
  avisoGuardarLegenda: string;
  avisoGuardarSelo: string;
  /** Embaixo do "Já transferi" (fechAporteFeito). */
  avisoGuardarFeitoSub(valor: string): string;
  avisoGuardarFeito(valor: string): string;
  /** Embaixo do "Vou transferir essa semana" (fechAporteDepois). */
  avisoGuardarDepoisSub: string;
  avisoGuardarDepoisFeito: string;
  avisoMetaPrazoPassou: string;
  avisoMetaNaoChegou(nome: string): string;
  avisoMetaFaltamUltimoMes(nome: string): string;
  avisoMetaChegaEm(nome: string, quando: string): string;
  avisoMetaSelo(ultimoMes: boolean): string;
  avisoMetaAjustarT: string;
  avisoMetaAjustarSub: string;
  avisoReservaLegenda(minimo: number): string;
  avisoReservaSelo: string;
  avisoReservaVerT: string;
  avisoReservaVerSub: string;
  avisoVoceCombinou: string;
  avisoPassouTeto(depois: string, teto: string): string;
  avisoEntraramDepois(valor: string): string;
  avisoUsadosDesde(depois: string, teto: string): string;
  avisoDentroDaMargem(valor: string): string;
  avisoNadaEntrou: string;
  avisoNoMes(categoria: string, gasto: string, plano: string): string;
  avisoVerGastos: string;
  avisoDesfeito: string;
  avisoDesfazerFalhou: string;
  avisoGastosDe(categoria: string): string;
  /** "3 gastos" ou, quando a lista mostra só os maiores, "5 maiores de 15 gastos". */
  avisoContagem(mostrados: number, total: number): string;
  avisoRevisar: string;
  avisoFechar: string;
  avisoToqueNumGasto: string;
  avisoMoverPra: string;
  avisoClassificar: string;
  /** A opção do seletor que tira o lançamento dos gastos: foi dinheiro guardado. */
  avisoEhGuardado: string;
  avisoFoiPara(descricao: string, categoria: string): string;
  avisoVirouGuardado(descricao: string): string;
  avisoNaoMudou: string;
  avisoSemCategoria: string;
  avisoDescricao: string;
  avisoDescricaoSalva(texto: string): string;
  avisoCategoria: string;
  avisoVerTodos(quantos: number): string;
  // Fechamento do mês
  fechTitulo(mes: string): string;
  fechImportarT(mes: string): string;
  fechImportarP: string;
  fechImportarBtn: string;
  fechImportadoT(mes: string, n: number): string;
  fechLicao: string;
  fechSobraP: string;
  fechSobraReserva(valor: string): string;
  /** A sobra passa do que falta pra reserva ficar completa: vai só o que falta, o resto fica. */
  fechSobraSoOQueFalta(falta: string, resto: string): string;
  fechSobraConta: string;
  fechSobraSemReserva: string;
  fechSobraReservaCompleta: string;
  fechSemSobra: string;
  fechAjusteP: string;
  fechAjusteSubir(valor: string): string;
  fechAjusteManter: string;
  fechAporteEy: string;
  fechAporteT(valor: string): string;
  fechAporteP: string;
  fechAporteFeito: string;
  fechAporteDepois: string;
  fechNumeroSub: string;
  fechNumeroP(porSemana: string): string;
  fechFechar: string;
  // Ritual da semana
  ritTitulo: string;
  ritSemanaPassada: string;
  ritAtencao: string;
  ritFio: string;
  ritSemana: string;
  ritFechar: string;
  // Raio-X
  raioxTitulo: string;
  raioxIntro: string;
  raioxCancelar: string;
  raioxMetade: string;
  raioxManter: string;
  raioxEconomia(anual: string, cincoAnos: string): string;
  raioxVazio: string;
  // "Isso está errado?"
  erradoLink: string;
  erradoObrigada: string;
  // O que você conquistou
  conqTitulo: string;
  conqNota: string;
  // "Comece por aqui": o guia dos primeiros passos no Foco (ver mensal/foco/comece.ts). A ordem
  // é sempre a mesma: trazer os gastos, ver o mês montado, fazer o orçamento.
  focoComeceTitulo: string;
  /** "1 de 3": quantos passos já foram. */
  focoComeceContagem(feitos: number, total: number): string;
  focoComeceImportarT: string;
  focoComeceImportarP: string;
  focoComeceImportarBotao: string;
  /** O caminho de quem não quer (ou não consegue) subir arquivo agora. */
  focoComeceDigitar: string;
  /** Link pro manual: onde achar o arquivo e extrato × fatura. */
  focoComeceAjuda: string;
  focoComeceMesT: string;
  focoComeceMesP: string;
  focoComeceMesBotao: string;
  focoComeceOrcamentoT: string;
  focoComeceOrcamentoP: string;
  focoComeceOrcamentoBotao: string;
  focoComeceDispensar: string;
  /** Rodapé do Foco de conta nova: o manual pra quem quer ler antes. */
  focoComeceManual: string;
  // Tour de boas-vindas: os passos que mudaram com o "Comece por aqui". Os outros continuam
  // nas chaves uiTour* de textos/shell.ts.
  /** O menu "Mais" de cada tipo de perfil: o que tem lá de verdade, com os nomes do menu. */
  focoTourMaisTexto(tipo: "pessoa" | "casal" | "empresa"): string;
  /** O último cartão do tour aponta pro primeiro passo: subir o extrato ou a fatura. */
  focoTourFimTexto: string;
};

/** "1 dia" / "3 dias": o último dia do mês não pode virar "1 dias". */
export const nDias = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);
/** "falta 1 dia" / "faltam 3 dias". */
export const faltamDias = (n: number) => (n === 1 ? "falta 1 dia" : `faltam ${n} dias`);

export const PADRAO_FOCO: TextosFoco = {
  focoTitulo: "Foco",
  focoLivreSemana: "Livre pra gastar essa semana",
  focoLivreMes: "Livre até o fim do mês",
  focoLivreSub: "o que ainda sobra no seu orçamento do mês",
  focoLivreEstimativa: "Livre até o fim do mês (estimativa)",
  focoLivreEstimativaSub: (s) => `cerca de ${s} por semana, se você seguir o que planejou`,
  focoSemOrcamentoTitulo: "Falta o seu orçamento do mês",
  focoSemOrcamentoSub: "Sem ele não dá pra dizer quanto está livre. Leva dois minutos.",
  focoSemOrcamentoBotao: "Montar meu orçamento",
  focoMesPassou: "Mês que já passou",
  focoOrcamentoUsado: "Orçamento já usado",
  focoComoCheguei: "Como cheguei nisso",
  focoDadosVelhos: (d) => `Seus últimos gastos lançados são de ${d} dias atrás. Esse número pode estar alto demais.`,
  focoImportar: "Importar extrato",
  focoAtencao: "Precisa da sua atenção",
  focoNadaTitulo: "Nada pedindo atenção agora",
  focoNadaSub: "Aproveita.",
  focoMaisEsperam: (n) => `+ ${n} ${n > 1 ? "coisas podem" : "coisa pode"} esperar`,
  focoAcao: "Ver o que fazer",
  focoBem: "Você está indo bem",
  focoDuvida: "Tenho uma dúvida sobre meu dinheiro",
  focoFioTitulo: "Por que suas metas importam agora",
  focoResumoMes: (m) => `${m} até agora`,
  focoVerMes: "Ver mês completo",
  focoEstouroT: (c) => `${c} passou do orçamento`,
  focoEstouroP: (g, p, d) => `${g} de ${p}, com ${nDias(d)} pela frente.`,
  focoAporteT: (v) => `Guardar ${v} este mês`,
  focoAporteP: 'É o seu compromisso do mês. Como na aula: "Mês: transferir pro investimento".',
  focoRitmoT: (c, p) => `${c}: ${p} do orçamento já usado`,
  focoRitmoP: (d, s) => `E ainda ${faltamDias(d)}. Sobram ${s} até o fim do mês.`,
  focoMetaT: (m) => `${m} saiu do ritmo`,
  focoMetaP: (f) => `Pra voltar ao prazo, precisa guardar ${f} por mês.`,
  focoMetaVencidaP: "A data que você escolheu pra ela já passou. Vale escolher uma data nova.",
  focoMetaUltimoMesP: (f) => `O prazo é este mês e ainda faltam ${f}. Dá pra completar ou escolher uma data nova.`,
  focoForaT: (v) => `${v} em gastos fora do orçamento`,
  focoForaP: (l) => `Eles não têm categoria planejada, mas saem do mesmo dinheiro do mês. Por isso o livre caiu pra ${l}.`,
  focoDadosNenhum: "Nenhum gasto lançado ainda. Esse número é só o que você planejou.",
  focoReservaT: (m) => `Sua reserva cobre ${m} de custo de vida`,
  focoReservaP: "A referência é de 6 a 12 meses do custo de vida.",
  focoBemRitmo: (c) => `${c} dentro do ritmo`,
  focoBemMeta: (m, q) => `${m} no ritmo: chega em ${q}`,
  focoBemAporte: (v) => `${v} guardados este mês`,
  focoRitmoPergunta: "Como você quer acompanhar seu dinheiro?",
  focoRitmoSemanal: "Toda semana",
  focoRitmoSemanalSub: "5 minutos, uma vez por semana. Você decide antes de o mês apertar.",
  focoRitmoMensal: "Uma vez por mês",
  // Era "realizado × planejado": palavra de planilha. É a mesma conta dita do jeito dela.
  focoRitmoMensalSub: "15 minutos no fechamento: o que aconteceu × o que você combinou.",
  focoRitmoAtual: (s) => (s ? "Você acompanha toda semana" : "Você acompanha uma vez por mês"),
  focoRitmoTrocar: "Trocar",
  compraTitulo: "Posso comprar?",
  compraOk: "Pode ir",
  compraCusto: "Cabe com custo",
  compraNao: "Não recomendo agora",
  compraDesisti: "Desisti",
  compraAmanha: "Decidir amanhã",
  compraSub: "Antes de passar o cartão: o que essa compra faz com o seu mês e com as suas metas.",
  compraOQue: "O que você quer comprar?",
  compraOQueExemplo: "Ex.: celular",
  compraValorTotal: "Valor total",
  compraAVista: "À vista",
  compraAVistaComDesconto: (p) => `À vista com ${p}`,
  compraParcelado: "Parcelado",
  compraVezes: "Em quantas vezes",
  compraJurosMes: "Juros ao mês (%)",
  compraDescontoVista: "Desconto se pagar à vista (%)",
  compraDigiteValor: "Digite o valor pra eu fazer a conta.",
  compraPrecisoRenda: "Pra responder isso, preciso saber sua renda do mês.",
  compraPrecisoOrcamento: "Pra responder isso, preciso do seu orçamento do mês.",
  compraSemChute: "Sem esse número eu estaria chutando, e sobre dinheiro eu prefiro perguntar.",
  compraPreencher: "Preencher agora",
  compraJaTemDestino: "Do que entra por mês, já tem destino",
  compraFonteReal: " (a média do que você gastou nos últimos meses, que é maior que o seu orçamento)",
  compraFonteMes: " (o que já saiu neste mês, que passou do orçamento)",
  compraFontePlano: " (seu orçamento do mês)",
  compraMaisDecididas: ", mais as compras que você já decidiu fazer",
  compraComACompra: "Com a compra:",
  compraJunteAVista: "Se der, junte e compre à vista.",
  compraColunaHoje: "Hoje",
  compraColunaComCompra: "Com a compra",
  compraRegraDeOuro: "À vista ou parcelado? A regra de ouro",
  compraParceladoRendendo: "Parcelado, com o dinheiro rendendo",
  compraParceladoValorHoje: (v) => `${v} em dinheiro de hoje`,
  compraVistaVale: "À vista vale mais",
  compraParcelarVale: "Parcelar vale mais",
  compraDiferenca: (v) => `: cerca de ${v} de diferença.`,
  compraSoSeRender: " Mas só se o dinheiro ficar de fato rendendo até a última parcela.",
  compraDescontoGanha: " O desconto é maior que o rendimento do dinheiro parado.",
  compraRendimentoRef: (p) => `Conta feita com o dinheiro rendendo ${p} ao mês.`,
  compraAmanhaDica: " (regra das 24 horas)",
  compraAmanhaFeito: "Combinado. Amanhã ela aparece no seu Foco e você decide com a cabeça fria.",
  compraVouComprar: "Vou comprar",
  compraCompreiNaoCabe: "Registrado. Essa compra passa do plano do mês: vale rever o orçamento no próximo fechamento.",
  compraCompreiCabe: "Registrado. Boa compra: agora é seguir o plano.",
  compraDesistiFeito: (v) => `Ficou com você: ${v}. Entrou no que você conquistou.`,
  compraSimularOutra: "Simular outra compra",
  compraErroSalvar: "Não consegui salvar agora. Tenta de novo em instantes.",
  decTitulo: "Decidir",
  decSub: "As perguntas que o app responde com os seus números. Toda resposta mostra a conta.",
  decDiaADia: "No dia a dia",
  decGrandes: "Decisões grandes",
  // As duas últimas das decisões grandes eram "Amortizar ou investir?" e "Marcação a mercado":
  // nome de mercado financeiro no meio de perguntas de gente. Ficou a pergunta que ela faria.
  decPerguntas: {
    comprar: "Posso comprar isso?",
    semana: "Quanto posso gastar essa semana?",
    gastando: "Estou gastando demais?",
    exagerando: "Onde estou exagerando?",
    guardar: "Quanto preciso guardar?",
    meta: "Quando atinjo minha meta?",
    reserva: "Minha reserva está suficiente?",
    acabou: "Por que meu dinheiro acabou mais rápido?",
    melhorei: "Melhorei em relação ao mês passado?",
    raiox: "Que pequenos gastos posso cortar?",
    valeAPena: "Vale a pena comprar?",
    financiar: "Financiar ou alugar?",
    amortizar: "Adiantar parcelas da dívida ou investir?",
    consorcio: "Consórcio ou financiamento?",
    carro: "Carro: assinar ou comprar?",
    marcacao: "Vender um investimento antes do prazo?",
  },
  decValeAPenaSub: "Quantas horas do seu trabalho isso custa",
  decSimulacoesSalvas: (n) => `Minhas simulações salvas (${n})`,
  decVerCalculadoras: "Ver todas as calculadoras",
  decPergunteTambem: "Pergunte também",
  raioxJuntosAno: "Juntos, por ano",
  raioxCincoAnos: "Investidos por 5 anos, virariam cerca de",
  raioxComoAchei:
    "Como achei: o mesmo estabelecimento, em pelo menos 3 meses diferentes. Moradia, saúde, educação e impostos ficam de fora. A conta dos 5 anos usa o dinheiro rendendo 0,9% ao mês.",
  raioxNosUltimos: (n) => `Nos últimos ${n} meses`,
  raioxVezesPorMes: (n) => (n <= 1 ? "Cerca de 1 vez por mês" : `Cerca de ${n} vezes por mês`),
  focoRitualEy: "Seu ritual da semana",
  focoRitualT: "Seus 5 minutos pro dinheiro",
  focoRitualP: "4 cartões e uma decisão. Bora?",
  focoFechEy: "Seu fechamento do mês",
  focoFechT: (m) => `Fechar ${m} · 15 minutos`,
  focoFechP: "Sem pressa. Dá pra fazer hoje, com calma.",
  focoComecar: "Começar",
  focoAmanhaT: (d, v) => `Ontem você pensou em comprar: ${d} (${v})`,
  focoAmanhaP: "Um dia depois, ainda quer?",
  focoAindaQuero: "Ainda quero",
  focoRaioXT: (n) => `Achei ${n} ${n > 1 ? "gastos que se repetem" : "gasto que se repete"} no seu extrato`,
  focoRaioXP: (a) => `Juntos, dão ${a} por ano.`,
  focoBemTeto: (c, v) => `${c} com teto de ${v} até o fim do mês`,
  focoTetoBotao: (v) => `Teto de ${v} até o fim do mês`,
  focoSegurarBotao: (c) => `Não gastar mais nada em ${c} este mês`,
  focoPontual: "Foi pontual, sigo o plano",
  focoRitualFeito: "Ritual feito. Até a semana que vem.",
  focoFechFeito: (m) => `${m} fechado. Até o próximo fechamento.`,
  avisoAcimaDoPlano: (c) => `acima do plano em ${c}`,
  avisoRodapeGasto: (v) => `Gasto ${v}`,
  avisoRodapePlano: (v) => `Plano ${v}`,
  avisoRodapeGuardado: (v) => `Guardado ${v}`,
  avisoNadaMaisT: "Não gastar mais nada",
  avisoNadaMaisSub: (c) => `em ${c} até o mês virar`,
  avisoNadaMaisFeito: (c) => `Combinado: nada mais em ${c} até o fim do mês.`,
  avisoPlanoBaixoT: "O plano estava baixo",
  avisoPlanoBaixoSub: (c, v) => `subir ${c} pra ${v}, com folga pro resto do mês`,
  avisoPlanoBaixoFeito: (c, v) => `${c} agora tem ${v} este mês.`,
  avisoPontualT: "Foi pontual",
  avisoPontualSub: "sigo o plano",
  avisoAnotado: "Anotado. Esse aviso some até o mês que vem.",
  avisoErroSalvar: "Não consegui salvar agora. Tenta de novo em instantes.",
  avisoOndeFoi: (c) => `Onde foi o dinheiro de ${c}`,
  avisoSobramEm: (c, d) => `sobram em ${c} pra ${nDias(d)}`,
  avisoRitmoSelo: "nesse ritmo, estoura antes do mês acabar",
  avisoTetoT: (v) => `Teto de ${v}`,
  avisoTetoSub: (c) => `em ${c} até o fim do mês`,
  avisoTetoFeito: (v, c) => `Teto de ${v} em ${c} até o fim do mês.`,
  avisoForaLegenda: "em gastos sem categoria no orçamento",
  avisoForaSelo: (l) => `saem do mesmo dinheiro: o livre caiu pra ${l}`,
  avisoForaLista: (n) => (n === 1 ? "O gasto fora do orçamento" : `Os ${n} gastos fora do orçamento`),
  avisoCriarCategoriaT: "Criar uma categoria nova",
  avisoCriarCategoriaSub: "no orçamento",
  avisoEntendiT: "Entendi",
  avisoEntendiSub: "esconder até o mês que vem",
  avisoGuardarLegenda: "faltam guardar este mês",
  avisoGuardarSelo: "primeiro você se paga, depois o resto do mês",
  avisoGuardarFeitoSub: (v) => `lançar ${v} guardados`,
  avisoGuardarFeito: (v) => `${v} guardados. Entrou no seu mês.`,
  avisoGuardarDepoisSub: "me lembra de novo",
  avisoGuardarDepoisFeito: "Combinado. Eu lembro de novo na semana que vem.",
  avisoMetaPrazoPassou: "Prazo passou",
  avisoMetaNaoChegou: (n) => `${n} ainda não chegou lá`,
  avisoMetaFaltamUltimoMes: (n) => `faltam pra ${n}, e o prazo é este mês`,
  avisoMetaChegaEm: (n, q) => `pra ${n} chegar em ${q}`,
  avisoMetaSelo: (u) => (u ? "guardar o que falta, ou escolher uma data que caiba" : "guardar mais por mês, ou escolher uma data que caiba"),
  avisoMetaAjustarT: "Ajustar a meta",
  avisoMetaAjustarSub: "valor por mês ou data",
  avisoReservaLegenda: (min) => `de reserva, a sua meta é ${min} meses`,
  avisoReservaSelo: "segura um imprevisto sem virar dívida",
  avisoReservaVerT: "Ver minha reserva",
  avisoReservaVerSub: "quanto falta e como chegar",
  avisoVoceCombinou: "Você combinou",
  avisoPassouTeto: (d, t) => `Passou do teto: ${d} de ${t}`,
  avisoEntraramDepois: (v) => `Depois do combinado entraram ${v}`,
  avisoUsadosDesde: (d, t) => `${d} de ${t} usados desde o combinado`,
  avisoDentroDaMargem: (v) => `${v} entraram depois, dentro da margem`,
  avisoNadaEntrou: "Nada entrou depois do combinado",
  avisoNoMes: (c, g, p) => `${c} no mês: ${g} de ${p}`,
  avisoVerGastos: "Ver os gastos",
  avisoDesfeito: "Combinado desfeito.",
  avisoDesfazerFalhou: "Não consegui desfazer agora. Tenta de novo em instantes.",
  avisoGastosDe: (c) => `Gastos de ${c}`,
  avisoContagem: (mostrados, total) =>
    total > mostrados ? `${mostrados} maiores de ${total} gastos` : mostrados === 1 ? "1 gasto" : `${mostrados} gastos`,
  avisoRevisar: "Revisar",
  avisoFechar: "Fechar",
  avisoToqueNumGasto: "Toque num gasto pra mudar a categoria ou a descrição.",
  avisoMoverPra: "Mover pra…",
  avisoClassificar: "Classificar…",
  // Era "É aplicação (guardei, não é gasto)": quem não investe não sabe o que é aplicação.
  avisoEhGuardado: "Guardei esse dinheiro (não é gasto)",
  avisoFoiPara: (d, c) => `${d} foi pra ${c}.`,
  avisoVirouGuardado: (d) => `${d} agora conta como dinheiro guardado.`,
  avisoNaoMudou: "Não consegui mudar esse gasto.",
  avisoSemCategoria: "sem categoria",
  avisoDescricao: "Descrição",
  avisoDescricaoSalva: (t) => `Descrição salva: ${t}.`,
  avisoCategoria: "Categoria",
  avisoVerTodos: (n) => `Ver todos os ${n} gastos no mês`,
  fechTitulo: (m) => `Fechar ${m}`,
  fechImportarT: (m) => `Traga o extrato e a fatura de ${m}`,
  fechImportarP: "É o único trabalho braçal do mês. O resto eu faço.",
  fechImportarBtn: "Importar extrato ou fatura",
  fechImportadoT: (m, n) => `${n} ${n === 1 ? "lançamento" : "lançamentos"} de ${m} no app`,
  fechLicao: "A lição do mês:",
  fechSobraP: "Reserva primeiro, enquanto ela não estiver completa.",
  fechSobraReserva: (v) => `Mandar ${v} pra reserva`,
  fechSobraSoOQueFalta: (f, r) => `Faltam só ${f} pra sua reserva ficar completa. Vai esse valor, e os outros ${r} continuam na conta.`,
  fechSobraConta: "Deixar na conta",
  fechSobraSemReserva: "Essa sobra ainda não tem destino. Montar sua reserva de emergência é o primeiro passo pra ela ter um.",
  fechSobraReservaCompleta: "Sua reserva já está completa. Essa sobra pode ir pra uma das suas metas.",
  fechSemSobra: "Esse mês fechou sem sobra. Sem problema: o próximo passo é ajustar o plano.",
  fechAjusteP: "Ou o plano está baixo, ou o hábito está alto. Você decide qual dos dois.",
  fechAjusteSubir: (v) => `Subir o orçamento pra ${v}`,
  fechAjusteManter: "Manter e segurar",
  fechAporteEy: "O que guardar no mês",
  fechAporteT: (v) => `Guardar ${v} este mês`,
  fechAporteP: 'Como na sua aula: "Mês: transferir pro investimento".',
  fechAporteFeito: "Já transferi",
  fechAporteDepois: "Vou transferir essa semana",
  fechNumeroSub: "Livre pro dia a dia até o fim do mês",
  fechNumeroP: (s) => `Cerca de ${s} por semana. É o único número que você precisa lembrar até o próximo fechamento.`,
  fechFechar: "Fechar o mês",
  ritTitulo: "5 minutos pro dinheiro",
  ritSemanaPassada: "Semana passada",
  ritAtencao: "Precisa da sua atenção",
  ritFio: "Seu fio",
  ritSemana: "Sua semana",
  ritFechar: "Fechar meu ritual",
  raioxTitulo: "Raio-X dos pequenos gastos",
  raioxIntro: '"Não importa quanto você ganha, e sim como você gasta." Decida um por um:',
  raioxCancelar: "Vou cancelar",
  raioxMetade: "Cortar pela metade",
  raioxManter: "Vale a pena, mantenho",
  raioxEconomia: (a, c) => `${a} por ano de volta pro seu bolso. Investidos por 5 anos, viram cerca de ${c}.`,
  raioxVazio: "Ainda não achei gasto que se repete. Preciso de pelo menos 3 meses de extrato.",
  erradoLink: "Isso está errado?",
  erradoObrigada: "Obrigada! Isso foi pra revisão.",
  conqTitulo: "O que você conquistou",
  conqNota: "Só conta o que você decidiu aqui dentro. É o que você fez, não \"graças ao app\".",
  focoComeceTitulo: "Comece por aqui",
  focoComeceContagem: (f, t) => `${f} de ${t}`,
  focoComeceImportarT: "Suba o extrato do banco ou a fatura do cartão",
  focoComeceImportarP: "É o arquivo que o app do seu banco gera. Com ele, o app monta o seu mês sozinho, sem você digitar gasto por gasto.",
  focoComeceImportarBotao: "Subir extrato ou fatura",
  focoComeceDigitar: "Prefiro anotar à mão",
  focoComeceAjuda: "Onde eu acho esse arquivo?",
  focoComeceMesT: "Veja o seu mês montado",
  focoComeceMesP: "Quanto entrou, quanto saiu e pra onde foi o dinheiro, separado por categoria.",
  focoComeceMesBotao: "Ver meu mês",
  focoComeceOrcamentoT: "Monte o seu orçamento do mês",
  focoComeceOrcamentoP: "Com os seus gastos já aqui fica mais fácil: o app sugere uma divisão e você confere quanto vai pra cada coisa.",
  focoComeceOrcamentoBotao: "Montar meu orçamento",
  focoComeceDispensar: "Esconder os primeiros passos",
  focoComeceManual: "Quer ler antes? Veja o manual Como usar o app",
  focoTourMaisTexto: (tipo) =>
    tipo === "empresa"
      ? "Aqui ficam as outras telas, como Vale a pena investir?, Configurações e o manual Como usar o app."
      : `Aqui ficam as outras telas, como Decidir (o "Posso comprar?" e outras perguntas), Planejar Viagem${tipo === "casal" ? ", Quanto cada um contribui?" : ""}, Configurações e o manual Como usar o app.`,
  focoTourFimTexto: "O primeiro passo está no cartão \"Comece por aqui\": subir o extrato do banco ou a fatura do cartão. Em segundos você vê o seu mês montado.",
};
