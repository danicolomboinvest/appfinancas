/**
 * Textos da área "configuracoes", na voz do Padrão — as frases EXATAS que o app tem hoje. Os temas
 * sobrescrevem o que quiserem em `vozes/<tema>.ts`; o que não sobrescrevem, cai aqui.
 *
 * Regras para quem cataloga: a chave começa com o prefixo da área; o valor do Padrão é a
 * frase atual do componente, sem mudar uma vírgula; frase com número ou nome vira função.
 *
 * Duas famílias moram aqui: `cfg*` (Configurações e Perfis financeiros) e `viagem*` (o
 * planejador de viagem). Frase que tem um pedaço em negrito no meio vira uma tupla de
 * partes — o componente põe o <strong> de volta — porque uma string só não carrega ênfase.
 */
export type TextosConfiguracoes = {
  // Configurações: as abas do celular, o breadcrumb e os botões que toda tela repete
  cfgBreadcrumb: string;
  cfgAbaPerfil: string;
  cfgAbaPreferencias: string;
  cfgAbaCategorias: string;
  cfgAbaNotificacoes: string;
  cfgAbaConexoes: string;
  cfgAbaDados: string;
  cfgAbaTaxas: string;
  cfgSalvar: string;
  cfgSalvando: string;
  cfgCancelar: string;
  // Perfil (a pessoa, não o perfil financeiro)
  cfgPerfilTitulo: string;
  cfgPerfilSub: string;
  cfgPerfilNome: string;
  cfgPerfilNomePlaceholder: string;
  cfgPerfilCelular: string;
  cfgPerfilEmail: string;
  cfgPerfilEmailDica: string;
  cfgPerfilFoto: string;
  // Preferências
  cfgPreferenciasTitulo: string;
  cfgPreferenciasSub: string;
  cfgMoeda: string;
  cfgTema: string;
  cfgTemaEscuro: string;
  cfgTemaClaro: string;
  cfgModoDecididoPeloTema: string;
  /** "Trocar a moeda **não converte seus valores**." — [antes, negrito, depois]. */
  cfgMoedaAviso: [string, string, string];
  /**
   * Os dois exemplos ("€ 3.000" e "R$ 3.000") vêm do componente, não daqui: o teste de moeda
   * proíbe "R$" escrito à mão fora da pasta de preferências, e o exemplo é justamente o símbolo.
   */
  cfgMoedaAvisoTexto1(exemploNovo: string, exemploAntigo: string): string;
  cfgMoedaAvisoTexto2: string;
  cfgAplicadoAoSalvar: string;
  // Categorias
  cfgCategoriasTitulo: string;
  cfgCategoriasSub: string;
  // Notificações: os três interruptores e-mail/alertas/metas
  cfgNotificacoesTitulo: string;
  cfgNotificacoesSub: string;
  cfgResumoEmail: string;
  cfgResumoEmailDica: string;
  cfgAlertasOrcamento: string;
  cfgAlertasOrcamentoDica: string;
  cfgMetasAtrasadas: string;
  cfgMetasAtrasadasDica: string;
  // Notificações: avisos no celular (push)
  cfgPushTitulo: string;
  cfgPushDica: string;
  cfgPushLigadoEm(aparelhos: number): string;
  cfgPushVerificando: string;
  cfgPushIos: string;
  cfgPushNaoSuportado: string;
  cfgPushBloqueado: string;
  cfgPushLigar: string;
  cfgPushLigando: string;
  cfgPushLigadoAqui: string;
  cfgPushDesligar: string;
  cfgPushLigadoToast: string;
  cfgPushFalhouToast: string;
  // Conexões (Open Finance)
  cfgConexoesTitulo: string;
  cfgConexoesSub: string;
  cfgConexoesDesligada: string;
  cfgConexaoConectado(banco: string): string;
  cfgConexaoConectadoToast(banco: string): string;
  cfgConexaoNadaNovo: string;
  cfgConexaoChegaram(novos: number, semCategoria: number): string;
  cfgConexaoVerNoMes: string;
  cfgConexoesIntro: string;
  cfgConexoesPasso1: string;
  cfgConexoesPasso1Dica: string;
  cfgConexoesPasso2: string;
  cfgConexoesPasso2Dica: string;
  cfgConexoesPasso3: string;
  cfgConexoesPasso3Dica: string;
  cfgConexoesCriarConta: string;
  cfgConexoesAutorizar: string;
  cfgConexoesAbrindo: string;
  cfgConexoesRodape: string;
  cfgBancosConectados: string;
  cfgConexaoAtualizado(data: string, novos: number): string;
  cfgConexaoAindaNaoBuscou: string;
  cfgConexaoReautorizar: string;
  cfgBuscarAgora: string;
  cfgConexaoNovos(novos: number): string;
  cfgDesconectar: string;
  cfgDesconectarConfirma(banco: string): string;
  cfgDesconectadoToast: string;
  cfgConexaoNaoDeu(motivo: string): string;
  cfgConexaoNaoConcluida: string;
  cfgConexaoNaoAbriu: string;
  // Dados: exportar e excluir a conta
  cfgDadosTitulo: string;
  cfgDadosSub: string;
  cfgExportLancamentosDica: string;
  cfgExportLancamentos: string;
  cfgExportCarteiraDica: string;
  cfgExportCarteira: string;
  cfgExportando: string;
  cfgExportFalhou: string;
  cfgExcluirContaTitulo: string;
  /** "Apaga a conta e **todos os seus dados** (…)" — [antes, negrito, depois]. */
  cfgExcluirContaTexto: [string, string, string];
  cfgExcluirContaQuero: string;
  cfgExcluirContaSenha: string;
  cfgExcluirContaBotao: string;
  cfgExcluindo: string;
  // Taxas do sistema
  cfgTaxasTitulo: string;
  cfgTaxasSub: string;
  cfgTaxaNome: string;
  cfgTaxaNomePlaceholder: string;
  cfgTaxaTaxa: string;
  cfgTaxaBase: string;
  cfgTaxaBaseAnual252: string;
  cfgTaxaBaseAnual365: string;
  cfgTaxaBaseMensal: string;
  cfgTaxaVigenteDesde: string;
  cfgTaxaOrigem: string;
  cfgTaxaSua: string;
  cfgTaxaPadraoSistema: string;
  cfgTaxaAdicionar: string;
  cfgTaxaAdicionadaToast: string;
  cfgTaxasVazio: string;
  // Perfis financeiros: a página, o trocador do topo e o gerenciador
  cfgPerfisTitulo: string;
  cfgPerfisSub: string;
  cfgPerfisGerenciar: string;
  cfgPerfisEmUso: string;
  cfgPerfisUsar: string;
  cfgPerfisEditar: string;
  cfgPerfisNovo: string;
  cfgPerfisEditarTitulo: string;
  cfgPerfisCriar: string;
  cfgPerfisTrocouToast(nome: string): string;
  cfgPerfisAtualizadoToast: string;
  cfgPerfisCriadoToast(nome: string): string;
  cfgPerfisExcluidoToast(nome: string): string;
  cfgPerfisFalhou: string;
  cfgPerfisNome: string;
  cfgPerfisNomePlaceholder: string;
  cfgPerfisTipo: string;
  /** O nome de um tipo de perfil (Pessoal, Empresa / PJ…) na voz do tema; sem tradução, o original. */
  cfgPerfisTipoLabel(kind: string, texto: string): string;
  cfgPerfisTema: string;
  cfgPerfisIcone: string;
  cfgPerfisExcluirTitulo: string;
  /** "Excluir **Empresa** apaga junto…" — [antes, depois]; o nome do perfil vai no meio. */
  cfgPerfisExcluirTexto: [string, string];
  cfgPerfisEscrevaParaConfirmar(nome: string): string;
  cfgPerfisExcluirParaSempre: string;
  // Viagem: a página e o roteiro
  viagemTitulo: string;
  viagemSub: string;
  viagemRoteiro: string;
  viagemDiasNoTotal(dias: number): string;
  /** "dia" ou "dias", depois do número. */
  viagemDias(dias: number): string;
  viagemMaxDestinos(max: number): string;
  viagemVazio: string;
  viagemBuscarPlaceholder: string;
  viagemNenhumDestino: string;
  // Viagem: pessoas, estilo e quando
  viagemQuantasPessoas: string;
  viagemEstilo: string;
  /** O nome de um estilo (Econômico, Médio, Confortável) na voz do tema; sem tradução, o original. */
  viagemEstiloLabel(chave: string, texto: string): string;
  viagemQuando: string;
  viagemAltaTemporada: string;
  viagemAltaTemporadaDica(pct: number): string;
  viagemBaixaTemporada: string;
  viagemBaixaTemporadaDica(pct: number): string;
  /** "Em **março** a mesma viagem sai **R$ 900** mais barata." — [antes, entre, depois]. */
  viagemMesMaisBarato: [string, string, string];
  viagemTrocar: string;
  // Viagem: os blocos de custo e o resultado
  viagemMediaDica: string;
  viagemBlocos: Record<"flights" | "lodging" | "food" | "activities", string>;
  viagemExtra: string;
  viagemExtraPlaceholder: string;
  viagemAdicionarCategoria: string;
  viagemMargem: string;
  viagemDiariasPorDestino: string;
  viagemDeOndeVemCusto: string;
  viagemCustoEstimado: string;
  viagemPorPessoa(porPessoa: string, porMes: string, meses: number): string;
  /** Mudou roteiro, pessoas ou estilo e os valores que ela digitou deixaram de valer. */
  viagemValoresVoltaram: string;
  viagemUsarMeus: string;
  /** Quem usa outra moeda: as estimativas do app são em reais, então os blocos começam zerados. */
  viagemOutraMoeda(simbolo: string): string;
  viagemMetaCriadaToast: string;
  viagemVerMeta: string;
  viagemCriarMeta: string;
  viagemCriandoMeta: string;
  viagemRodape: string;
};

export const PADRAO_CONFIGURACOES: TextosConfiguracoes = {
  // Configurações: as abas do celular, o breadcrumb e os botões que toda tela repete
  cfgBreadcrumb: "Configurações",
  cfgAbaPerfil: "Perfil",
  cfgAbaPreferencias: "Preferências",
  cfgAbaCategorias: "Categorias",
  cfgAbaNotificacoes: "Notificações",
  cfgAbaConexoes: "Conexões",
  cfgAbaDados: "Dados",
  cfgAbaTaxas: "Taxas",
  cfgSalvar: "Salvar",
  cfgSalvando: "Salvando...",
  cfgCancelar: "Cancelar",
  // Perfil
  cfgPerfilTitulo: "Perfil",
  cfgPerfilSub: "Suas informações pessoais.",
  cfgPerfilNome: "Nome",
  cfgPerfilNomePlaceholder: "Seu nome",
  cfgPerfilCelular: "Celular (WhatsApp)",
  cfgPerfilEmail: "E-mail",
  cfgPerfilEmailDica: "É o seu e-mail de acesso. Para trocar, fale com o suporte.",
  cfgPerfilFoto: "URL da foto (opcional)",
  // Preferências
  cfgPreferenciasTitulo: "Preferências",
  cfgPreferenciasSub: "Moeda e tema de exibição.",
  cfgMoeda: "Moeda",
  cfgTema: "Tema",
  cfgTemaEscuro: "Escuro",
  cfgTemaClaro: "Claro",
  cfgModoDecididoPeloTema: "O tema do perfil decide claro ou escuro. Só o Padrão tem os dois.",
  cfgMoedaAviso: ["Trocar a moeda ", "não converte seus valores", "."],
  cfgMoedaAvisoTexto1: (exemploNovo, exemploAntigo) => `Só o símbolo muda: "${exemploAntigo}" vira "${exemploNovo}". Os números ficam iguais.`,
  cfgMoedaAvisoTexto2: "Só uma parte em outra moeda? Deixe a principal aqui e escolha a moeda ao lançar.",
  cfgAplicadoAoSalvar: "Moeda e tema são aplicados assim que você salva.",
  // Categorias
  cfgCategoriasTitulo: "Categorias",
  cfgCategoriasSub: "Renomeie, troque o ícone ou esconda categorias.",
  // Notificações
  cfgNotificacoesTitulo: "Notificações",
  cfgNotificacoesSub: "Avisos no celular, o resumo por e-mail e o que aparece em Análises.",
  cfgResumoEmail: "Resumo do mês por e-mail",
  cfgResumoEmailDica: "Uma vez por mês, no começo do mês: quanto entrou, quanto saiu e o que mudou.",
  cfgAlertasOrcamento: "Alertas de orçamento",
  cfgAlertasOrcamentoDica: "Quando uma categoria passa de 80% antes da metade do mês, ou estoura.",
  cfgMetasAtrasadas: "Metas atrasadas",
  cfgMetasAtrasadasDica: "Quando uma meta fica para trás do ritmo. Um aviso por meta por mês.",
  // Notificações: avisos no celular
  cfgPushTitulo: "Avisos no celular",
  cfgPushDica: "Avisos no celular quando uma categoria está perto de estourar ou uma meta atrasa.",
  cfgPushLigadoEm: (n) => `Ligado em ${n} aparelho${n === 1 ? "" : "s"}.`,
  cfgPushVerificando: "Verificando este aparelho…",
  cfgPushIos: "No iPhone, só com o app na tela de início (Compartilhar › Adicionar à Tela de Início).",
  cfgPushNaoSuportado: "Este navegador não recebe notificações. No celular, instale o app na tela de início.",
  cfgPushBloqueado: "Você bloqueou as notificações deste site. Libere nas configurações do navegador para ligar de novo.",
  cfgPushLigar: "Ligar avisos neste aparelho",
  cfgPushLigando: "Ligando…",
  cfgPushLigadoAqui: "Ligado aqui",
  cfgPushDesligar: "Desligar neste aparelho",
  cfgPushLigadoToast: "Avisos ligados neste aparelho.",
  cfgPushFalhouToast: "Não consegui ligar os avisos aqui. Tente de novo.",
  // Conexões
  cfgConexoesTitulo: "Conectar meu banco",
  cfgConexoesSub: "Open Finance: os lançamentos da conta e do cartão chegam sozinhos, toda noite.",
  cfgConexoesDesligada: "A conexão com bancos ainda não está ligada. Por enquanto: Registrar › Importar extrato ou fatura.",
  cfgConexaoConectado: (banco) => `${banco} conectado`,
  cfgConexaoConectadoToast: (banco) => `${banco} conectado.`,
  cfgConexaoNadaNovo: "Nenhum lançamento novo por enquanto. O SPI busca de novo toda noite.",
  cfgConexaoChegaram: (novos, semCategoria) =>
    `Chegaram ${novos} lançamentos dos últimos 90 dias${semCategoria > 0 ? `, ${semCategoria} sem categoria` : ""}.`,
  cfgConexaoVerNoMes: "Ver no mês →",
  cfgConexoesIntro: "Pelo Open Finance oficial (Meu Pluggy). O app busca seus lançamentos toda noite.",
  cfgConexoesPasso1: "Crie sua conta no Meu Pluggy",
  cfgConexoesPasso1Dica: "É um site parceiro, gratuito. Abre em outra aba e volta aqui.",
  cfgConexoesPasso2: "Conecte seu banco lá",
  cfgConexoesPasso2Dica: "Nubank, Itaú, Inter, C6… O banco pede sua autorização pelo app dele. Cartão entra junto.",
  cfgConexoesPasso3: "Autorize o SPI a ler",
  cfgConexoesPasso3Dica: "Volte para cá e toque em autorizar. Só leitura: o SPI não move dinheiro.",
  cfgConexoesCriarConta: "Criar conta no Meu Pluggy ↗",
  cfgConexoesAutorizar: "Já conectei lá → autorizar o SPI",
  cfgConexoesAbrindo: "Abrindo…",
  cfgConexoesRodape: "Via Pluggy, regulada pelo Banco Central. Desconecte quando quiser.",
  cfgBancosConectados: "Bancos conectados",
  cfgConexaoAtualizado: (data, novos) => `atualizado ${data}, ${novos} novo${novos === 1 ? "" : "s"}`,
  cfgConexaoAindaNaoBuscou: "ainda não buscou",
  cfgConexaoReautorizar: "precisa reautorizar",
  cfgBuscarAgora: "Buscar agora",
  cfgConexaoNovos: (novos) => `${novos} lançamento${novos === 1 ? "" : "s"} novo${novos === 1 ? "" : "s"}.`,
  cfgDesconectar: "Desconectar",
  cfgDesconectarConfirma: (banco) => `Desconectar ${banco}? Os lançamentos que já entraram ficam.`,
  cfgDesconectadoToast: "Desconectado.",
  cfgConexaoNaoDeu: (motivo) => `Não deu: ${motivo}`,
  cfgConexaoNaoConcluida: "A conexão não foi concluída.",
  cfgConexaoNaoAbriu: "Não consegui abrir a conexão agora.",
  // Dados
  cfgDadosTitulo: "Dados",
  cfgDadosSub: "Exporte seus dados ou exclua a conta.",
  cfgExportLancamentosDica: "Todos os lançamentos, em CSV.",
  cfgExportLancamentos: "Exportar lançamentos (CSV)",
  cfgExportCarteiraDica: "Todos os ativos da carteira, em CSV.",
  cfgExportCarteira: "Exportar carteira (CSV)",
  cfgExportando: "Exportando...",
  cfgExportFalhou: "Não foi possível exportar os dados. Tente novamente.",
  cfgExcluirContaTitulo: "Excluir minha conta",
  cfgExcluirContaTexto: [
    "Apaga a conta e ",
    "todos os seus dados",
    " (lançamentos, orçamentos, metas, carteira) de forma definitiva. Não tem volta. Se quiser guardar algo, exporte antes.",
  ],
  cfgExcluirContaQuero: "Quero excluir minha conta",
  cfgExcluirContaSenha: "Digite sua senha para confirmar",
  cfgExcluirContaBotao: "Excluir tudo definitivamente",
  cfgExcluindo: "Excluindo...",
  // Taxas do sistema
  cfgTaxasTitulo: "Taxas do Sistema",
  cfgTaxasSub: "Taxas usadas como sugestão/âncora nos módulos de planejamento e simuladores.",
  cfgTaxaNome: "Nome",
  cfgTaxaNomePlaceholder: "Ex.: CDI",
  cfgTaxaTaxa: "Taxa",
  cfgTaxaBase: "Base",
  cfgTaxaBaseAnual252: "Anual (base 252 dias úteis)",
  cfgTaxaBaseAnual365: "Anual (base 365 dias)",
  cfgTaxaBaseMensal: "Mensal",
  cfgTaxaVigenteDesde: "Vigente desde",
  cfgTaxaOrigem: "Origem",
  cfgTaxaSua: "Sua taxa",
  cfgTaxaPadraoSistema: "Padrão do sistema",
  cfgTaxaAdicionar: "Adicionar",
  cfgTaxaAdicionadaToast: "Taxa adicionada com sucesso.",
  cfgTaxasVazio: "Nenhuma taxa cadastrada ainda.",
  // Perfis financeiros
  cfgPerfisTitulo: "Seus perfis",
  cfgPerfisSub: "Cada perfil é um dinheiro separado: lançamentos, metas e carteira não se misturam entre eles.",
  cfgPerfisGerenciar: "Gerenciar perfis",
  cfgPerfisEmUso: "em uso agora",
  cfgPerfisUsar: "Usar",
  cfgPerfisEditar: "Editar",
  cfgPerfisNovo: "Novo perfil",
  cfgPerfisEditarTitulo: "Editar perfil",
  cfgPerfisCriar: "Criar perfil",
  cfgPerfisTrocouToast: (nome) => `Você está no ${nome}.`,
  cfgPerfisAtualizadoToast: "Perfil atualizado.",
  cfgPerfisCriadoToast: (nome) => `Perfil ${nome} criado. Você já está nele.`,
  cfgPerfisExcluidoToast: (nome) => `Perfil ${nome} excluído.`,
  cfgPerfisFalhou: "Não consegui fazer isso agora.",
  cfgPerfisNome: "Nome",
  cfgPerfisNomePlaceholder: "Empresa, Casal, Casa…",
  cfgPerfisTipo: "Tipo",
  cfgPerfisTipoLabel: (_kind, texto) => texto,
  cfgPerfisTema: "Tema",
  cfgPerfisIcone: "Ícone",
  cfgPerfisExcluirTitulo: "Excluir perfil",
  cfgPerfisExcluirTexto: [
    "Excluir ",
    " apaga junto tudo que está dentro dele: lançamentos, orçamento, metas e carteira. Isso não tem como desfazer.",
  ],
  cfgPerfisEscrevaParaConfirmar: (nome) => `Escreva ${nome} para confirmar`,
  cfgPerfisExcluirParaSempre: "Excluir para sempre",
  // Viagem: a página e o roteiro
  viagemTitulo: "Planejar viagem",
  viagemSub: "Estime quanto custa o destino dos seus sonhos e transforme em meta com aporte mensal.",
  viagemRoteiro: "Roteiro",
  viagemDiasNoTotal: (dias) => `${dias} ${dias === 1 ? "dia" : "dias"} no total`,
  viagemDias: (dias) => (dias === 1 ? "dia" : "dias"),
  viagemMaxDestinos: (max) => `Máximo de ${max} destinos por viagem.`,
  viagemVazio: "Busque o primeiro destino acima.",
  viagemBuscarPlaceholder: "Buscar destino (ex.: Paris, Jeri, Japão)",
  viagemNenhumDestino: "Nenhum destino encontrado. Tente outro nome ou o país.",
  // Viagem: pessoas, estilo e quando
  viagemQuantasPessoas: "Quantas pessoas?",
  viagemEstilo: "Estilo da viagem",
  viagemEstiloLabel: (_chave, texto) => texto,
  viagemQuando: "Quando pretende ir?",
  viagemAltaTemporada: "Alta temporada",
  viagemAltaTemporadaDica: (pct) => `Passagem e hospedagem ficam cerca de ${pct}% mais caras neste mês.`,
  viagemBaixaTemporada: "Baixa temporada",
  viagemBaixaTemporadaDica: (pct) => `Boa época: passagem e hospedagem saem cerca de ${pct}% mais baratas.`,
  viagemMesMaisBarato: ["Em ", " a mesma viagem sai ", " mais barata."],
  viagemTrocar: "Trocar",
  // Viagem: os blocos de custo e o resultado
  viagemMediaDica: "Média para uma viagem como a sua. Toque no número para ajustar.",
  viagemBlocos: { flights: "Passagens", lodging: "Hospedagem", food: "Alimentação", activities: "Passeios e transporte" },
  viagemExtra: "Extra",
  viagemExtraPlaceholder: "Ex.: compras, seguro...",
  viagemAdicionarCategoria: "Adicionar categoria",
  viagemMargem: "Margem de imprevistos (10%)",
  viagemDiariasPorDestino: "Diárias por destino (sem passagem)",
  viagemDeOndeVemCusto: "De onde vem o custo",
  viagemCustoEstimado: "Custo estimado da viagem",
  viagemPorPessoa: (porPessoa, porMes, meses) =>
    `${porPessoa} por pessoa, guardando ${porMes}/mês, você chega lá em ${meses} ${meses === 1 ? "mês" : "meses"}.`,
  viagemValoresVoltaram: "Os valores que você editou voltaram para a estimativa, porque o roteiro, as pessoas ou o estilo mudaram.",
  viagemUsarMeus: "Usar os meus",
  viagemOutraMoeda: (simbolo) => `As estimativas são em reais. Digite quanto custa cada bloco em ${simbolo}.`,
  viagemMetaCriadaToast: "Meta da viagem criada! Veja em Metas.",
  viagemVerMeta: "Ver minha meta em Metas",
  viagemCriarMeta: "Criar meta desta viagem",
  viagemCriandoMeta: "Criando meta...",
  viagemRodape: "Estimativas médias de 2026, saindo do Brasil. Não são cotação.",
};
