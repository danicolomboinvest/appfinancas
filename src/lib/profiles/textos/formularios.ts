/**
 * Textos da área "formularios", na voz do Padrão — as frases EXATAS que o app tem hoje. Os temas
 * sobrescrevem o que quiserem em `vozes/<tema>.ts`; o que não sobrescrevem, cai aqui.
 *
 * Regras pra quem cataloga: a chave começa com o prefixo da área; o valor do Padrão é a
 * frase atual do componente, sem mudar uma vírgula; frase com número ou nome vira função.
 *
 * Algumas frases têm um trecho em negrito no meio ("Tem certeza que quer apagar <b>Pet</b>?").
 * Essas viram DUAS chaves, antes e depois do negrito, pra o componente continuar desenhando
 * igual — uma função que devolvesse a frase inteira perderia o destaque.
 */

/** Os ícones que a pessoa pode dar a uma meta (mesmos valores do enum GoalIcon do banco). */
export type IconeDeMeta = "VIAGEM" | "CASA" | "CARRO" | "APOSENTADORIA" | "GENERICO";
/** As classes de ativo do formulário da carteira (mesmos valores do enum AssetClass). */
export type ClasseDeAtivo = "RENDA_FIXA" | "ACAO" | "FII" | "TESOURO_DIRETO" | "FUNDO" | "CRIPTO" | "INTERNACIONAL" | "OUTRO";
/** O objetivo de um ativo (mesmos valores do enum AssetObjective). */
export type ObjetivoDeAtivo = "OUTRO" | "RESERVA_EMERGENCIA" | "LIBERDADE_FINANCEIRA" | "META";
/** O indexador de renda fixa; a string vazia é "não definido". */
export type IndexadorRendaFixa = "" | "POS_FIXADO" | "IPCA" | "PREFIXADO";
/** Os três perfis de risco da estratégia (mesmos valores de RiskProfileKey). */
export type PerfilDeRisco = "conservador" | "moderado" | "arrojado";

export type TextosFormularios = {
  // Botões e rótulos que vários formulários repetem
  formSalvar: string;
  formSalvando: string;
  formCancelar: string;
  formVoltar: string;
  formContinuar: string;
  formSelecione: string;
  /** O "(opcional)" que vai ao lado do rótulo de um campo que pode ficar vazio. */
  formOpcional: string;
  formEditar: string;
  formRemover: string;

  // Meta (GoalForm, NewGoalButton, EditGoalButton, DeleteGoalButton)
  formMetaNova: string;
  formMetaEditar: string;
  formMetaAdicionar: string;
  formMetaSalvar: string;
  formMetaCriada: string;
  formMetaAtualizada: string;
  formMetaNome: string;
  formMetaNomePlaceholder: string;
  formMetaIcone: string;
  /** O nome de cada ícone, que aparece ao passar o mouse. */
  formMetaIcones: Record<IconeDeMeta, string>;
  formMetaValorAlvo: string;
  formMetaJaGuardado: string;
  formMetaMesAno: string;
  formMetaRende: string;
  formMetaRendeHint: string;

  // Ativo da carteira (AssetForm)
  formAtivoAdicionar: string;
  formAtivoSalvar: string;
  formAtivoAdicionado: string;
  formAtivoAtualizado: string;
  formAtivoClasse: string;
  formAtivoClasses: Record<ClasseDeAtivo, string>;
  formAtivoQual: string;
  formAtivoQualPlaceholder: string;
  formAtivoTicker: string;
  formAtivoNome: string;
  /** O placeholder do nome quando o código veio da lista: o nome já chega preenchido. */
  formAtivoNomePlaceholderLista: string;
  formAtivoNomePlaceholder: string;
  formAtivoIndexador: string;
  formAtivoIndexadores: Record<IndexadorRendaFixa, string>;
  formAtivoObjetivo: string;
  formAtivoObjetivos: Record<ObjetivoDeAtivo, string>;
  formAtivoMetaVinculada: string;
  formAtivoQuantidade: string;
  formAtivoQuantidadePlaceholder: string;
  formAtivoPrecoMedio: string;
  formAtivoValorAtualOpcional: string;
  formAtivoValorAtualHint: string;
  formAtivoValorInvestido: string;
  formAtivoValorAtual: string;

  // Orçamento (BudgetWizard)
  formOrcPasso(passo: number, total: number): string;
  formOrcSalvo: string;
  formOrcTitulo: string;
  formOrcSub: string;
  formOrcQuantoEntra: string;
  formOrcRenda: string;
  formOrcRendaSugestao(mes: string, valor: string): string;
  formOrcQuantoGuardar: string;
  /** O chip "outro" depois dos percentuais prontos. */
  formOrcOutro: string;
  formOrcGuardarPorMes: string;
  /** A nota do curso: 18% ao todo, 10% liberdade financeira. O "8% pros sonhos" é fixo. */
  formOrcCursoNota(pct: number, liberdade: number): string;
  formOrcSobraTitulo: string;
  formOrcSobraSub(valor: string): string;
  formOrcDividir(valor: string): string;
  formOrcDividaTitulo(valor: string): string;
  formOrcDistribuido: string;
  formOrcSobram(valor: string): string;
  formOrcPassou(valor: string): string;
  formOrcSugerir: string;
  formOrcCopiar(mes: string): string;
  formOrcSugestaoNota(moradia: number, alimentacao: number, saude: number, pct: number): string;
  formOrcCustomNota: string;
  formOrcVerPlano: string;
  formOrcSeuPlano(ano: number): string;
  formOrcProntoPlano(ano: number): string;
  /** "De cada <b>100</b> que entram:" — antes e depois do valor (em negrito, com a moeda). */
  formOrcDeCadaAntes: string;
  formOrcDeCadaDepois: string;
  /** A legenda da barra: o número já vem sem "%" (é assim que o app sempre mostrou). */
  formOrcLegGuardados(pct: string): string;
  formOrcLegCategoria(pct: string, categoria: string): string;
  formOrcLegLivres(pct: string): string;
  formOrcFimDoAno: string;
  formOrcFimDoAnoValor(valor: string): string;
  formOrcFimDoAnoSub(valor: string, meses: number): string;
  formOrcPraOnde: string;
  formOrcPraOndeNota: string;
  formOrcEntra: string;
  formOrcGuarda: string;
  formOrcGasta(categorias: number): string;
  formOrcFicaLivre: string;
  formOrcEstourou: string;
  formOrcSalvar: string;
  formOrcAjustar: string;
  formOrcRendaEAporte: string;
  // O quadradinho de cada categoria
  formOrcPorMes: string;
  formOrcSemGasto: string;
  formOrcMesPassado(mes: string, valor: string): string;
  formOrcApagarTitulo: string;
  /** "Tem certeza que quer apagar <b>Pet</b>? Os lançamentos…" — antes e depois do nome. */
  formOrcApagarAntes: string;
  formOrcApagarDepois: string;
  formOrcApagando: string;
  formOrcApagar: string;

  // Reserva de emergência (EmergencyFundForm) — os rótulos principais já estão em voice-base
  formReservaMesesChip(meses: number): string;
  formReservaMediaSugestao(mesesUsados: number): string;
  formReservaCarteiraSugestao: string;

  // Aposentadoria: o wizard da primeira vez (PlanningWizard) e o formulário de depois (PlanningParamsForm)
  formApVidaPergunta: string;
  formApVidaHelp: string;
  formApVidaCampo: string;
  formApVidaHint: string;
  formApOutrasPergunta: string;
  formApOutrasHelp: string;
  formApOutrasCampo: string;
  formApInvestidoPergunta: string;
  formApInvestidoHelp: string;
  formApInvestidoCampo: string;
  formApAportePergunta: string;
  formApAporteHelp: string;
  formApAporteCampo: string;
  formApIdadePergunta: string;
  formApIdadeHelp: string;
  formApIdadeAtual: string;
  formApIdadeObjetivo: string;
  formApExpectativa: string;
  formApPremissasPergunta: string;
  formApPremissasHelp: string;
  formApRendAcumulo: string;
  formApInflacao: string;
  formApRendUsufruto: string;
  formApCalculando: string;
  formApVerPlano: string;
  formApGuardarPergunta: string;
  formApGuardarHint: string;
  formApIdadeHoje: string;
  formApPararAos: string;
  formApPremissas: string;
  formApPremissasSub: string;
  formApPremissasNota: string;
  formApRendem: string;
  formApRendemHint: string;
  formApInflacaoAssume: string;
  formApInflacaoHint: string;
  formApRendVivendo: string;
  formApRendVivendoHint: string;
  formApAteIdade: string;
  formApOutrasRendas: string;

  // Estratégia da carteira (StrategyForm)
  formEstSalva: string;
  formEstPerfis: Record<PerfilDeRisco, { nome: string; descricao: string }>;
  formEstQuizTitulo: string;
  formEstAbrir: string;
  formEstFechar: string;
  formEstPrazoPergunta: string;
  formEstPrazoOpcoes: [string, string, string];
  /** O prazo em palavras, na frase "você vai precisar do dinheiro em …". */
  formEstPrazoNomes: [string, string, string];
  formEstQuedaPergunta: string;
  formEstQuedaOpcoes: [string, string, string];
  formEstReservaPergunta: string;
  formEstReservaOpcoes: [string, string, string];
  /** "Pelas suas metas, você vai precisar do dinheiro em <b>2 a 5 anos</b>." — antes e depois. */
  formEstPelasMetasAntes: string;
  formEstPelasMetasDepois: string;
  formEstNaoEIsso: string;
  /** "Pelas respostas, seu perfil é <b>Moderado</b>." — só o antes; o ponto e a descrição vêm depois. */
  formEstPerfilAntes: string;
  formEstUsarPerfil: string;
  formEstPronto: string;
  formEstComoFicaria: string;
  formEstSoma(pct: string): string;
  formEstFecha: string;
  formEstNaoFecha: string;
  formEstSalvar: string;

  // Lançamento do mês (EntryForm)
  formLancDescricao: string;
  formLancDescricaoPlaceholder: string;
  formLancValor: string;
  formLancData: string;
  formLancMetaVinculada: string;
  formLancNenhuma: string;
  formLancRepetir(ano: number): string;
  formLancSalvar: string;
  formLancLancar: string;
};

export const PADRAO_FORMULARIOS: TextosFormularios = {
  formSalvar: "Salvar",
  formSalvando: "Salvando...",
  formCancelar: "Cancelar",
  formVoltar: "← Voltar",
  formContinuar: "Continuar",
  formSelecione: "Selecione...",
  formOpcional: "(opcional)",
  formEditar: "Editar",
  formRemover: "Remover",

  formMetaNova: "Nova meta",
  formMetaEditar: "Editar meta",
  formMetaAdicionar: "Adicionar meta",
  formMetaSalvar: "Salvar alterações",
  formMetaCriada: "Meta criada com sucesso.",
  formMetaAtualizada: "Meta atualizada com sucesso.",
  formMetaNome: "Nome da meta",
  formMetaNomePlaceholder: "Ex.: Viagem, Entrada do apê, Trocar de carro",
  formMetaIcone: "Ícone",
  formMetaIcones: { VIAGEM: "Viagem", CASA: "Casa", CARRO: "Carro", APOSENTADORIA: "Aposentadoria", GENERICO: "Genérico" },
  formMetaValorAlvo: "Valor-alvo",
  formMetaJaGuardado: "Já guardado",
  formMetaMesAno: "Mês/ano alvo",
  formMetaRende: "Quanto o dinheiro guardado rende por ano",
  formMetaRendeHint: "Poupança rende perto de 6%. CDB e Tesouro Selic, perto de 10%. Se não sabe, deixe 10%.",

  formAtivoAdicionar: "Adicionar",
  formAtivoSalvar: "Salvar alterações",
  formAtivoAdicionado: "Ativo adicionado com sucesso.",
  formAtivoAtualizado: "Ativo atualizado com sucesso.",
  formAtivoClasse: "Classe",
  formAtivoClasses: {
    RENDA_FIXA: "Renda Fixa",
    ACAO: "Ação",
    FII: "FII",
    TESOURO_DIRETO: "Tesouro Direto",
    FUNDO: "Fundo",
    CRIPTO: "Cripto",
    INTERNACIONAL: "Internacional",
    OUTRO: "Outro",
  },
  formAtivoQual: "Qual ativo?",
  formAtivoQualPlaceholder: "Nome ou código",
  formAtivoTicker: "Ticker (opcional)",
  formAtivoNome: "Nome",
  formAtivoNomePlaceholderLista: "Preenchido ao escolher na lista",
  formAtivoNomePlaceholder: "Ex.: Tesouro Selic 2029",
  formAtivoIndexador: "Indexador",
  formAtivoIndexadores: { "": "Não definido", POS_FIXADO: "Pós-fixado (CDI/Selic)", IPCA: "IPCA+", PREFIXADO: "Prefixado" },
  formAtivoObjetivo: "Objetivo",
  formAtivoObjetivos: { OUTRO: "Outro", RESERVA_EMERGENCIA: "Reserva de emergência", LIBERDADE_FINANCEIRA: "Liberdade financeira", META: "Meta" },
  formAtivoMetaVinculada: "Meta vinculada",
  formAtivoQuantidade: "Quantidade",
  formAtivoQuantidadePlaceholder: "Ex.: 10",
  formAtivoPrecoMedio: "Preço médio de compra",
  formAtivoValorAtualOpcional: "Valor atual (opcional)",
  formAtivoValorAtualHint: "Deixe em branco: o app busca a cotação de hoje e multiplica pela quantidade.",
  formAtivoValorInvestido: "Valor investido",
  formAtivoValorAtual: "Valor atual",

  formOrcPasso: (passo, total) => `Passo ${passo} de ${total}`,
  formOrcSalvo: "Plano salvo para o ano inteiro.",
  formOrcTitulo: "Vamos montar seu orçamento",
  formOrcSub: "Três perguntas. O app já sabe parte das respostas pelos seus lançamentos.",
  formOrcQuantoEntra: "Quanto entra por mês?",
  formOrcRenda: "Renda por mês",
  formOrcRendaSugestao: (mes, valor) => `Em ${mes} entraram ${valor}.`,
  formOrcQuantoGuardar: "Quanto você quer guardar?",
  formOrcOutro: "outro",
  formOrcGuardarPorMes: "Guardar por mês",
  formOrcCursoNota: (pct, liberdade) =>
    `No curso, a conta é ${pct}%: ${liberdade}% pra liberdade financeira e 8% pros sonhos. Quem está começando costuma conseguir 10% — se ficar apertado, dá pra mudar depois. Nada aqui é promessa.`,
  formOrcSobraTitulo: "Sobra pra gastar",
  formOrcSobraSub: (valor) => `por mês, depois de guardar ${valor}`,
  formOrcDividir: (valor) => `Dividir os ${valor} →`,
  formOrcDividaTitulo: (valor) => `Divida os ${valor}`,
  formOrcDistribuido: "Distribuído",
  formOrcSobram: (valor) => `Sobram ${valor} pra distribuir`,
  formOrcPassou: (valor) => `Passou ${valor} do que sobra`,
  formOrcSugerir: "Sugerir pra mim",
  formOrcCopiar: (mes) => `Copiar ${mes}`,
  formOrcSugestaoNota: (moradia, alimentacao, saude, pct) =>
    `A sugestão segue a distribuição do orçamento do curso: moradia ${moradia}% da renda, alimentação ${alimentacao}%, saúde ${saude}%, e assim por diante. Guardando menos que ${pct}% sobra uma folga; guardando mais, tudo encolhe junto. É um ponto de partida: mexa à vontade.`,
  formOrcCustomNota: "Pet, academia, filhos: o que é grande na sua vida e não cabe nas de cima. O que vem uma vez por ano, divida por 12.",
  formOrcVerPlano: "Ver meu plano →",
  formOrcSeuPlano: (ano) => `Seu plano de ${ano}`,
  formOrcProntoPlano: (ano) => `Pronto. Seu plano de ${ano}`,
  formOrcDeCadaAntes: "De cada",
  formOrcDeCadaDepois: "que entram:",
  formOrcLegGuardados: (pct) => `${pct} guardados`,
  formOrcLegCategoria: (pct, categoria) => `${pct} ${categoria}`,
  formOrcLegLivres: (pct) => `${pct} livres`,
  formOrcFimDoAno: "O que isso dá no fim do ano",
  formOrcFimDoAnoValor: (valor) => `${valor} guardados`,
  formOrcFimDoAnoSub: (valor, meses) => `${valor} por mês nos ${meses} meses que faltam, mais o que sobrar.`,
  formOrcPraOnde: "Pra onde vai o que você guarda",
  formOrcPraOndeNota: "Reserva primeiro, depois as metas por prazo. O resto fica livre.",
  formOrcEntra: "Entra",
  formOrcGuarda: "Guarda",
  formOrcGasta: (categorias) => `Gasta (${categorias} categorias)`,
  formOrcFicaLivre: "Fica livre",
  formOrcEstourou: "As categorias somam mais do que sobra. Volte e ajuste, ou guarde menos.",
  formOrcSalvar: "Salvar meu plano",
  formOrcAjustar: "Ajustar as categorias",
  formOrcRendaEAporte: "Renda e aporte",
  formOrcPorMes: "Por mês",
  formOrcSemGasto: "sem gasto mês passado",
  formOrcMesPassado: (mes, valor) => `${mes}: ${valor}`,
  formOrcApagarTitulo: "Apagar categoria?",
  formOrcApagarAntes: "Tem certeza que quer apagar",
  formOrcApagarDepois: "? Os lançamentos que já usaram essa categoria continuam existindo, só perdem a categorização.",
  formOrcApagando: "Apagando...",
  formOrcApagar: "Apagar categoria",

  formReservaMesesChip: (meses) => `${meses} meses`,
  formReservaMediaSugestao: (n) => `Seus gastos dos últimos ${n === 1 ? "mês fechado" : `${n} meses fechados`} dão essa média.`,
  formReservaCarteiraSugestao: "Na sua carteira, isso está marcado como reserva.",

  formApVidaPergunta: "Quanto custa a vida que você quer?",
  formApVidaHelp: "O gasto mensal que você gostaria de bancar só com renda passiva, em valores de hoje.",
  formApVidaCampo: "Gasto mensal desejado",
  formApVidaHint: "Por mês, em dinheiro de hoje.",
  formApOutrasPergunta: "Você já tem outras rendas?",
  formApOutrasHelp: "Aluguel, INSS, pensão, rendas que continuarão quando você parar de trabalhar. Deixe zerado se não houver.",
  formApOutrasCampo: "Outras rendas passivas por mês",
  formApInvestidoPergunta: "Quanto você já tem investido?",
  formApInvestidoHelp: "Tudo que já está aplicado hoje e vai compor esse patrimônio.",
  formApInvestidoCampo: "Patrimônio investido atual",
  formApAportePergunta: "Quanto consegue aportar por mês?",
  formApAporteHelp: "O valor médio que você consegue investir todo mês durante a fase de acúmulo.",
  formApAporteCampo: "Aporte mensal médio",
  formApIdadePergunta: "Sua idade e quando quer parar",
  formApIdadeHelp: "A idade objetivo é quando você quer atingir a independência. A expectativa de vida é opcional.",
  formApIdadeAtual: "Idade atual",
  formApIdadeObjetivo: "Idade objetivo",
  formApExpectativa: "Expectativa de vida",
  formApPremissasPergunta: "Premissas de rentabilidade",
  formApPremissasHelp: "Já preenchemos valores comuns, ajuste se quiser. Taxas ao ano.",
  formApRendAcumulo: "Rendimento na fase de acúmulo",
  formApInflacao: "Inflação média",
  formApRendUsufruto: "Rendimento vivendo de renda",
  formApCalculando: "Calculando...",
  formApVerPlano: "Ver meu plano",
  formApGuardarPergunta: "Quanto consegue guardar por mês?",
  formApGuardarHint: "Vale por esse valor em dinheiro de hoje: o plano assume que você acompanha a inflação.",
  formApIdadeHoje: "Sua idade hoje",
  formApPararAos: "Quer parar aos",
  formApPremissas: "Premissas",
  formApPremissasSub: "Os números técnicos. Já vieram preenchidos — só abra se quiser mexer.",
  formApPremissasNota: "Nenhum destes números é promessa: são o cenário que você escolhe simular.",
  formApRendem: "Quanto seus investimentos rendem por ano",
  formApRendemHint: "Antes de descontar a inflação. Se você investe perto do CDI, use a taxa do CDI.",
  formApInflacaoAssume: "Inflação que você assume",
  formApInflacaoHint: "É ela que traz o dinheiro do futuro para o poder de compra de hoje.",
  formApRendVivendo: "Rendimento já vivendo de renda",
  formApRendVivendoHint: "Mais conservador que o da fase de acumular, porque agora você depende dele para viver.",
  formApAteIdade: "Até que idade (opcional)",
  formApOutrasRendas: "Outras rendas por mês (opcional)",

  formEstSalva: "Estratégia salva com sucesso.",
  formEstPerfis: {
    conservador: { nome: "Conservador", descricao: "Prioriza previsibilidade, a maior parte em renda fixa." },
    moderado: { nome: "Moderado", descricao: "Equilibra renda fixa e renda variável." },
    arrojado: { nome: "Arrojado", descricao: "Prioriza crescimento de longo prazo, a maior parte em renda variável." },
  },
  formEstQuizTitulo: "Não sabe por onde começar? Três perguntas.",
  formEstAbrir: "abrir",
  formEstFechar: "fechar",
  formEstPrazoPergunta: "Quando você vai precisar desse dinheiro?",
  formEstPrazoOpcoes: ["Em menos de 2 anos", "Entre 2 e 5 anos", "Daqui a mais de 5 anos"],
  formEstPrazoNomes: ["menos de 2 anos", "2 a 5 anos", "mais de 5 anos"],
  formEstQuedaPergunta: "Se a carteira caísse 15% num mês, você…",
  formEstQuedaOpcoes: ["Venderia tudo, não dormiria", "Ficaria tensa, mas seguraria", "Aproveitaria pra comprar mais"],
  formEstReservaPergunta: "Sua reserva de emergência já está completa?",
  formEstReservaOpcoes: ["Ainda não", "Quase lá", "Sim"],
  formEstPelasMetasAntes: "Pelas suas metas, você vai precisar do dinheiro em",
  formEstPelasMetasDepois: ".",
  formEstNaoEIsso: "Não é isso, quero responder",
  formEstPerfilAntes: "Pelas respostas, seu perfil é",
  formEstUsarPerfil: "Usar esse perfil",
  formEstPronto: "Ou comece de um perfil pronto (você pode ajustar depois)",
  formEstComoFicaria: "Como sua carteira ficaria",
  formEstSoma: (pct) => `Soma: ${pct}`,
  formEstFecha: "✓ fecha em 100%",
  formEstNaoFecha: "— precisa somar 100%",
  formEstSalvar: "Salvar estratégia",

  formLancDescricao: "Descrição (opcional)",
  formLancDescricaoPlaceholder: "Ex.: o nome do lugar, o que comprou",
  formLancValor: "Valor",
  formLancData: "Data",
  formLancMetaVinculada: "Meta vinculada (opcional)",
  formLancNenhuma: "Nenhuma",
  formLancRepetir: (ano) => `Repetir lançamento todo mês (despesa fixa) até dezembro de ${ano}`,
  formLancSalvar: "Salvar alterações",
  formLancLancar: "Lançar",
};
