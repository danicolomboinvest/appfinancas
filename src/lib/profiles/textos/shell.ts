/**
 * Textos da área "shell", na voz do Padrão — as frases EXATAS que o app tem hoje. Os temas
 * sobrescrevem o que quiserem em `vozes/<tema>.ts`; o que não sobrescrevem, cai aqui.
 *
 * Regras pra quem cataloga: a chave começa com o prefixo da área; o valor do Padrão é a
 * frase atual do componente, sem mudar uma vírgula; frase com número ou nome vira função.
 *
 * Aqui moram o guia dos primeiros passos, o tour de boas-vindas, os cartões do Fluxo (curva do
 * mês, divisão da renda, ranking de gastos, mapa de calor, lista de lançamentos), o convite
 * pra instalar o app, o cartão do curso, os botões de claro/escuro e as telas de erro.
 *
 * Negrito dentro da frase: algumas frases têm um pedaço em destaque ("Toque em **Adicionar**").
 * O marcador é `**`, como no Markdown, e o componente troca por <strong> com `partesDoTexto`.
 * Quem escrever a voz de um tema pode usar o mesmo marcador — ou nenhum.
 */
export type TextosShell = {
  // OnboardingChecklist — o guia dos primeiros passos
  uiPrimeirosPassos: string;
  uiPassoRegistrar: string;
  uiPassoOrcamento: string;
  uiPassoCarteira: string;
  uiDispensarGuia: string;

  // WelcomeTour — um título e um texto por passo, na ordem em que aparecem
  uiTourBoasVindasTitulo: string;
  uiTourBoasVindasTexto: string;
  uiTourRegistrarTitulo: string;
  uiTourRegistrarTexto: string;
  uiTourFluxoTitulo: string;
  uiTourFluxoTexto: string;
  uiTourMetasTitulo: string;
  uiTourMetasTexto: string;
  uiTourCarteiraTitulo: string;
  uiTourCarteiraTexto: string;
  uiTourMaisTitulo: string;
  uiTourMaisTexto: string;
  uiTourFimTitulo: string;
  uiTourFimTexto: string;
  uiTourPular: string;
  uiTourAvancar: string;
  uiTourComecar: string;

  // MonthFlowCard — a curva do mês dia a dia
  /** "O que já está marcado para Outubro": mês que ainda não começou. */
  uiFluxoTituloFuturo(mes: string): string;
  /** "Como Setembro está indo": o mês corrente. */
  uiFluxoTituloCorrente(mes: string): string;
  /** "Como foi Julho": mês fechado. */
  uiFluxoTituloFechado(mes: string): string;
  uiFluxoDicaFuturo: string;
  uiFluxoDicaCorrente: string;
  uiFluxoDicaFechado: string;
  /** Lançamentos sem data ficam fora da curva: a frase concorda em número com `quantos`. */
  uiFluxoSemData(quantos: number, valor: string): string;

  // IncomeSplitCard — pra onde a renda foi
  uiRendaDividida: string;
  /** O rótulo do centro da rosca (o total de onde as fatias saíram). */
  uiRendaCentro: string;
  uiRendaFatiaGastos: string;
  uiRendaFatiaAportes: string;
  uiRendaFatiaSobrou: string;
  uiRendaGastouAMais(valor: string): string;
  /** "Você manteve **33%** do que entrou": o percentual vai em destaque, daí o marcador. */
  uiRendaManteve(pct: string): string;

  // TopCategories — o ranking de gastos
  uiMaioresGastos: string;
  uiMaisCategorias(quantas: number): string;
  /** "1 lançamento" / "12 lançamentos": serve ao ranking e ao topo da lista. */
  uiContagemLancamentos(quantos: number): string;
  uiSetaCompara: string;

  // MonthHeatmap — o mapa de calor do mês
  uiHeatmapDica: string;
  uiHeatmapMenos: string;
  uiHeatmapMais: string;
  uiHeatmapPico(dia: number, valor: string): string;
  /** O balão de um dia que ainda não chegou. */
  uiHeatmapDiaFuturo(dia: number): string;
  /** O balão de um dia já vivido, com o que saiu nele. */
  uiHeatmapDia(dia: number, valor: string): string;

  // EntryList — a lista de lançamentos e a folha de cada um
  uiSelecionar: string;
  uiCancelar: string;
  uiVerMaisLancamentos(quantos: number): string;
  /** "**3** selecionados": o número vai em negrito, daí o marcador. */
  uiSelecionados(quantos: number): string;
  uiSairDaSelecao: string;
  uiEditar: string;
  uiRemover: string;
  /** Botão que muda a categoria de vários lançamentos marcados de uma vez (parcelas de uma
   * mesma compra, por exemplo) — modo "Selecionar" da lista. */
  uiMudarCategoria: string;
  uiMudarCategoriaTitulo(quantos: number): string;
  uiCategoriaAtualizada(quantos: number): string;
  uiEditarLancamento: string;
  uiRemoverLancamento: string;
  /** Título da folha que abre ao tocar numa linha. */
  uiLancamento: string;
  uiCotacao(taxa: string): string;
  /** O tipo do lançamento na folha ("Aporte · 12/09") e o nome quando não há categoria. */
  uiTipoRenda: string;
  uiTipoGasto: string;
  uiTipoAporte: string;
  /** Nome de uma categoria própria que já não existe mais. */
  uiCategoriaSemNome: string;
  uiExcluido(quantos: number): string;
  uiExcluidoContinuaNaCarteira: string;
  uiDesfazer: string;
  uiRestaurado(quantos: number): string;
  uiRestaurarFalhou: string;

  // InstallAppBanner — o convite pra instalar no celular
  uiInstalarConviteTitulo: string;
  uiInstalarConviteSub: string;
  uiInstalarVerComo: string;
  uiInstalarFecharConvite: string;

  // InstallAppSheet — o tutorial de instalar na tela de início
  uiInstalarTitulo: string;
  uiInstalarIntro: string;
  uiInstalarAgora: string;
  uiInstalando: string;
  uiInstalarNativoDica: string;
  uiInstalarNoComputador: string;
  /** Os três passos, por aparelho/navegador. O caminho MUDA entre Safari e Chrome no iPhone. */
  uiInstalarPassosSafari: [string, string, string];
  uiInstalarPassosIosOutro: [string, string, string];
  uiInstalarPassosAndroid: [string, string, string];

  // PaywallCard — o convite pra área do curso
  uiPaywallTitulo(recurso: string): string;
  uiPaywallTexto: string;
  uiPaywallBotao: string;

  // ThemeQuickToggle e ThemeToggle — claro/escuro
  uiMudarParaEscuro: string;
  uiMudarParaClaro: string;
  uiAparencia: string;
  uiAparenciaClara: string;
  uiAparenciaEscura: string;

  // Telas de erro e de página que não existe
  uiErroTitulo: string;
  uiErroTexto: string;
  uiErroTentarDeNovo: string;
  uiNaoEncontradoRotulo: string;
  uiNaoEncontradoTitulo: string;
  uiNaoEncontradoTexto: string;
  uiNaoEncontradoVoltar: string;
};

export const PADRAO_SHELL: TextosShell = {
  // OnboardingChecklist
  uiPrimeirosPassos: "Primeiros passos",
  uiPassoRegistrar: "Registre seu primeiro gasto ou renda",
  uiPassoOrcamento: "Defina seu orçamento do mês",
  uiPassoCarteira: "Monte sua carteira de investimentos",
  uiDispensarGuia: "Dispensar guia",

  // WelcomeTour
  uiTourBoasVindasTitulo: "Boas-vindas ao SPI Finance 👋",
  uiTourBoasVindasTexto: "Um tour rápido mostrando ONDE fica cada coisa, vou destacar os botões um por um. Dá pra pular quando quiser.",
  uiTourRegistrarTitulo: "Este + é o coração do app",
  uiTourRegistrarTexto: "É por aqui que você registra tudo: digite um gasto, fale por áudio, ou importe o extrato do banco. Comece sempre por ele.",
  uiTourFluxoTitulo: "Aqui é o Fluxo",
  uiTourFluxoTexto: "Seu mês em um lugar: renda, gastos e o orçamento por categoria, com um alerta quando você gasta rápido demais.",
  uiTourMetasTitulo: "Aqui são as Metas",
  uiTourMetasTexto: "Crie metas (viagem, casa), a reserva de emergência e a aposentadoria. O app calcula quanto guardar por mês pra você chegar lá.",
  uiTourCarteiraTitulo: "Aqui é a Carteira",
  uiTourCarteiraTexto: "Seus investimentos e o lucro de cada um. Dá até pra puxar o preço médio direto da sua declaração de Imposto de Renda.",
  uiTourMaisTitulo: "E tem mais aqui",
  uiTourMaisTexto: "Visão Geral, Simuladores e Análises ficam neste menu.",
  uiTourFimTitulo: "Tudo pronto! 🎉",
  uiTourFimTexto: "Bora começar? Toque no + e registre seu primeiro lançamento, em segundos você já vê seu mês tomando forma.",
  uiTourPular: "Pular",
  uiTourAvancar: "Avançar",
  uiTourComecar: "Começar",

  // MonthFlowCard
  uiFluxoTituloFuturo: (mes) => `O que já está marcado para ${mes}`,
  uiFluxoTituloCorrente: (mes) => `Como ${mes} está indo`,
  uiFluxoTituloFechado: (mes) => `Como foi ${mes}`,
  uiFluxoDicaFuturo: "Lançamentos repetidos e agendados. O mês ainda não começou.",
  uiFluxoDicaCorrente: "A faixa entre as duas linhas é o que sobrou até aqui",
  uiFluxoDicaFechado: "A faixa entre as duas linhas é o que sobrou",
  uiFluxoSemData: (quantos, valor) =>
    quantos === 1
      ? `1 lançamento sem data (${valor}) não entra nesta curva, mas conta nos totais do mês.`
      : `${quantos} lançamentos sem data (${valor}) não entram nesta curva, mas contam nos totais do mês.`,

  // IncomeSplitCard
  uiRendaDividida: "Como sua renda foi dividida",
  uiRendaCentro: "Renda",
  uiRendaFatiaGastos: "Gastos",
  uiRendaFatiaAportes: "Aportes",
  uiRendaFatiaSobrou: "Sobrou",
  uiRendaGastouAMais: (valor) => `Você gastou ${valor} a mais do que entrou este mês.`,
  uiRendaManteve: (pct) => `Você manteve **${pct}** do que entrou (entre aportes e sobra).`,

  // TopCategories
  uiMaioresGastos: "Maiores gastos do mês",
  uiMaisCategorias: (quantas) => `+${quantas} categoria${quantas === 1 ? "" : "s"}`,
  uiContagemLancamentos: (quantos) => `${quantos} ${quantos === 1 ? "lançamento" : "lançamentos"}`,
  uiSetaCompara: "A seta compara com o mês passado. Variação abaixo de 8% não aparece — é oscilação normal.",

  // MonthHeatmap
  uiHeatmapDica: "Um quadradinho por dia, mais forte onde saiu mais dinheiro.",
  uiHeatmapMenos: "Menos",
  uiHeatmapMais: "Mais",
  uiHeatmapPico: (dia, valor) => `Dia de maior gasto: ${dia} · ${valor}`,
  uiHeatmapDiaFuturo: (dia) => `Dia ${dia}`,
  uiHeatmapDia: (dia, valor) => `Dia ${dia}: ${valor}`,

  // EntryList
  uiSelecionar: "Selecionar",
  uiCancelar: "Cancelar",
  uiVerMaisLancamentos: (quantos) => `Ver mais ${quantos} lançamentos`,
  uiSelecionados: (quantos) => `**${quantos}** ${quantos === 1 ? "selecionado" : "selecionados"}`,
  uiSairDaSelecao: "Sair da seleção",
  uiMudarCategoria: "Categoria",
  uiMudarCategoriaTitulo: (quantos) => `Mudar a categoria de ${quantos} ${quantos === 1 ? "lançamento" : "lançamentos"}`,
  uiCategoriaAtualizada: (quantos) => `${quantos} ${quantos === 1 ? "lançamento atualizado" : "lançamentos atualizados"}`,
  uiEditar: "Editar",
  uiRemover: "Remover",
  uiEditarLancamento: "Editar lançamento",
  uiRemoverLancamento: "Remover lançamento",
  uiLancamento: "Lançamento",
  uiCotacao: (taxa) => `cotação ${taxa}`,
  uiTipoRenda: "Renda",
  uiTipoGasto: "Gasto",
  uiTipoAporte: "Aporte",
  uiCategoriaSemNome: "Categoria",
  uiExcluido: (quantos) => (quantos === 1 ? "Lançamento excluído." : `${quantos} lançamentos excluídos.`),
  uiExcluidoContinuaNaCarteira: "O que já estava distribuído continua na carteira.",
  uiDesfazer: "Desfazer",
  uiRestaurado: (quantos) => (quantos === 1 ? "Lançamento restaurado." : `${quantos} lançamentos restaurados.`),
  uiRestaurarFalhou: "Não foi possível restaurar. Lance de novo manualmente.",

  // InstallAppBanner
  uiInstalarConviteTitulo: "Instale no seu celular",
  uiInstalarConviteSub: "Abre em tela cheia, com ícone próprio.",
  uiInstalarVerComo: "Ver como",
  uiInstalarFecharConvite: "Fechar convite",

  // InstallAppSheet
  uiInstalarTitulo: "Instalar na tela de início",
  uiInstalarIntro:
    "O SPI Finance funciona como aplicativo: ícone próprio na tela inicial e tela cheia, sem a barra do navegador. Não ocupa espaço como um app de loja e continua se atualizando sozinho.",
  uiInstalarAgora: "Instalar agora",
  uiInstalando: "Instalando...",
  uiInstalarNativoDica: "Seu navegador permite instalar direto: toque no botão e confirme na janelinha que aparecer.",
  uiInstalarNoComputador:
    "Você está no computador. Para ter o app no celular, abra o site pelo navegador do telefone e repita esses passos por lá.",
  uiInstalarPassosSafari: [
    "Toque no botão **Compartilhar** — o quadradinho com uma seta para cima, na barra de baixo.",
    "Role a lista para baixo e toque em **Adicionar à Tela de Início**.",
    "Toque em **Adicionar**, no canto de cima. Pronto: o ícone aparece na sua tela inicial.",
  ],
  uiInstalarPassosIosOutro: [
    "Toque no menu do navegador (**⋯** ou **⋮**), no canto da tela.",
    "Toque em **Compartilhar** e depois em **Adicionar à Tela de Início**.",
    "Confirme em **Adicionar**. Se não encontrar essa opção, abra este site no **Safari** — por lá o caminho é mais direto.",
  ],
  uiInstalarPassosAndroid: [
    "Toque no menu **⋮**, no canto superior direito do navegador.",
    "Toque em **Instalar aplicativo** (em alguns aparelhos aparece como **Adicionar à tela inicial**).",
    "Confirme em **Instalar**. O ícone vai para a sua tela inicial.",
  ],

  // PaywallCard
  uiPaywallTitulo: (recurso) => `${recurso} é conteúdo do curso`,
  uiPaywallTexto:
    "Essa área faz parte do curso de investimentos. Quem já é aluna(o) e está vendo essa mensagem por engano, fale com o suporte — pode ser só o e-mail de cadastro diferente do e-mail da compra.",
  uiPaywallBotao: "Conhecer o curso",

  // ThemeQuickToggle e ThemeToggle
  uiMudarParaEscuro: "Mudar para o tema escuro",
  uiMudarParaClaro: "Mudar para o tema claro",
  uiAparencia: "Aparência",
  uiAparenciaClara: "Clara",
  uiAparenciaEscura: "Escura",

  // Telas de erro
  uiErroTitulo: "Ops, algo deu errado por aqui",
  uiErroTexto: "Foi um erro nosso, não seu, seus dados estão seguros. Tente recarregar; se continuar, saia e entre de novo.",
  uiErroTentarDeNovo: "Tentar de novo",
  uiNaoEncontradoRotulo: "Erro 404",
  uiNaoEncontradoTitulo: "Essa página não existe.",
  uiNaoEncontradoTexto: "Verifique o endereço ou volte para o início, sua vida financeira está te esperando lá.",
  uiNaoEncontradoVoltar: "Voltar para o início",
};

/**
 * Quebra uma frase com marcador `**` nos pedaços normais e em negrito, na ordem. É texto puro
 * (sem React) de propósito: o componente decide se o destaque vira <strong> ou um <span> com
 * classe. Sem marcador, devolve a frase inteira como um pedaço só.
 */
export function partesDoTexto(texto: string): { texto: string; negrito: boolean }[] {
  return texto
    .split("**")
    .map((pedaco, i) => ({ texto: pedaco, negrito: i % 2 === 1 }))
    .filter((p) => p.texto.length > 0);
}
