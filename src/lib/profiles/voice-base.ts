/**
 * A base da voz: os tipos, as frases do Padrão (as EXATAS que o app sempre teve) e os
 * ajudantes que os temas usam pra escrever as deles.
 *
 * Cada tema mora em `vozes/<tema>.ts` e só sobrescreve o que quer dizer diferente. Foi
 * separado assim pra seis pessoas (ou seis agentes) escreverem a voz de seis temas ao mesmo
 * tempo sem disputar o mesmo arquivo. A regra de ouro continua valendo pra todos: a cobrança
 * fala do NÚMERO, nunca da pessoa — e o teste em voice.test.ts confere.
 */
import { type TextosSimuladores, PADRAO_SIMULADORES } from "./textos/simuladores";
import { type TextosFormularios, PADRAO_FORMULARIOS } from "./textos/formularios";
import { type TextosImportacao, PADRAO_IMPORTACAO } from "./textos/importacao";
import { type TextosShell, PADRAO_SHELL } from "./textos/shell";
import { type TextosConfiguracoes, PADRAO_CONFIGURACOES } from "./textos/configuracoes";
import { type TextosCarteira, PADRAO_CARTEIRA } from "./textos/carteira";

export type Estado = "bom" | "normal" | "ruim" | "vazio";
export type Periodo = "manha" | "tarde" | "noite";
export type Ritmo = "rapido" | "limite" | "dentro";
export type SituacaoOrcamento = "sem-plano" | "folgado" | "no-ritmo" | "adiantado" | "estourou";

export type Money = (n: number, o?: { round?: boolean }) => string;

/**
 * Bom, normal ou ruim — a avaliação que vem ANTES da frase.
 *
 * "Sobra" aqui é o que não virou gasto: saldo mais aportes, porque aporte é dinheiro guardado.
 * Bom = sobrou 20% ou mais do que entrou (a régua clássica de poupança). Ruim = não sobrou
 * nada ou gastou mais do que entrou. O resto é normal: fechou de pé, dá pra mais.
 */
export function estadoDoMes(v: { income: number; expense: number; investment: number }): Estado {
  if (v.income === 0 && v.expense === 0 && v.investment === 0) return "vazio";
  const sobra = v.income - v.expense;
  if (sobra <= 0) return "ruim";
  if (v.income > 0 && sobra / v.income >= 0.2) return "bom";
  return "normal";
}

export type DadosResultado = {
  /** Renda − gastos − aportes: o que o painel chama de Resultado. */
  resultado: number;
  income: number;
  expense: number;
  money: Money;
  /** Game: o resultado deste mês é o maior dos últimos meses? */
  recorde?: boolean;
  /** O mês já acabou? Muda "ainda dá" pra "acabou". */
  mesFechado?: boolean;
};

export type DadosOrcamento = {
  situacao: SituacaoOrcamento;
  restante: number;
  porDia: number | null;
  diasRestantes: number;
  ultimoDia: number;
  money: Money;
};

export type Voz = {
  /** Saudação do topo. `null` = este tema não tem saudação (o Game abre com o ranking). */
  saudacao(periodo: Periodo, nome: string | undefined): string | null;
  /** A linha abaixo da saudação. `null` = a data de hoje, como sempre foi. */
  subSaudacao(mesLabel: string): string | null;
  /** Rótulo pequeno acima do painel Entrou/Gastou. `null` = sem rótulo. */
  tituloPainel: string | null;
  /** A última linha do painel: "Resultado", "Sobrou", "Guardado", "Você guardou 💖". */
  rotuloResultado: string;
  /** A frase logo abaixo do painel, conforme o estado. `null` = sem frase (Padrão). */
  fraseResultado(estado: Estado, d: DadosResultado): string | null;
  ritmo: Record<Ritmo, string>;
  tituloOrcamento(mesLabel: string): string;
  fraseOrcamento(d: DadosOrcamento): string;
  mesVazio: string;
  metaBatida(nome: string): string;
  /** Uma linha de rodapé, conforme o estado. `null` = nenhuma. */
  rodape(estado: Estado): string | null;
  nav: {
    /** A aba de metas na barra de baixo e no menu: "Metas", "Missões", "Sonhos". */
    metas: string;
    /** As três abas do Fluxo: visão mensal, só gastos, orçamento. */
    flowTabs: [string, string, string];
    /** A aba de carteira na barra de baixo. Só a Empresa muda ("Caixa"). */
    carteira?: string;
  };
  /** Títulos de seção e de página. O tema muda o que quiser; o resto fica como no Padrão. */
  titulos: Titulos;
};

export type TitulosBase = {
  // Visão geral
  visaoGeral: string;
  visaoGeralSub: string;
  patrimonio: string;
  rendaNoAno: string;
  gastosNoAno: string;
  sobrouNoAno: string;
  /** "De cada R$ 100 que entraram, você manteve R$ 31" — na voz do tema. */
  sobrouNoAnoDica(cem: string, manteve: string, pct: number): string;
  statusModulos: string;
  modReserva: string;
  modMetas: string;
  modAposentadoria: string;
  modDividendos: string;
  // Cards do orçamento
  economiaNoMes: string;
  economiaAbaixo: string;
  economiaAcima: string;
  categoriaEstourou: string;
  categoriaEstourouDica(pct: string): string;
  nenhumaEstourou: string;
  economizouMaisEm: string;
  economizouMaisEmDica(pct: string): string;
  semLancamento: string;
  // Fluxo
  soGastos: string;
  soGastosSub: string;
  orcamento: string;
  orcamentoSub: string;
  orcamentoPorCategoria: string;
  paraOndeFoi: string;
  oQueMudou: string;
  ritmoDoMes: string;
  anoMesAMes: string;
  caiuNaConta: string;
  caiuNaContaSub: string;
  planejamento: string;
  poupanca: string;
  /** A linha "Aportou" do painel. */
  aportou: string;
  /** As linhas "Entrou" e "Gastou" do painel. Só a Empresa muda ("Faturou", "Custos e despesas"). */
  entrou: string;
  gastou: string;
  // Metas, reserva e aposentadoria
  metas: string;
  metasSub: string;
  metasVazio: string;
  reserva: string;
  reservaSub: string;
  reservaMeta: string;
  reservaAtual: string;
  reservaTempo: string;
  reservaRendimento: string;
  reservaProjecao: string;
  aposentadoria: string;
  aposentadoriaSub: string;
  aposentadoriaWizardSub: string;
  // Miolo da meta
  metaStatus: Record<"ahead" | "onTrack" | "behind" | "achieved", string>;
  metaGuardar(valor: string): string;
  metaMeses(n: number): string;
  metaAporteFeito(mes: string): string;
  metaAporteToast(mes: string): string;
  metaMarcar(mes: string): string;
  metaOutroValor: string;
  // Pra onde vai o que guarda
  splitTitulo(mes: string): string;
  splitSub(valor: string): string;
  splitVazioTitulo: string;
  splitVazioSub: string;
  // Formulário da reserva
  formCusto: string;
  formCustoHint: string;
  formMeses: string;
  formMesesHint: string;
  formJaTenho: string;
  formGuardoPorMes: string;
  formRende: string;
  formRendeHint: string;
  // Corpo da aposentadoria
  apSeNadaMudar(idade: number): string;
  apHoje: string;
  apDaPe: string;
  apNaoDaPe: string;
  apVereditoIntro: string;
  apSobram: string;
  apFaltam: string;
  apTodoMes: string;
  apDeOndeVem: string;
  apDeOndeVemHint: string;
  apBolso(anos: number): string;
  apJuros: string;
  apJurosNota(um: string, mais: string): string;
  apPremissas: string;
  apEditar: string;
  apProjecao: string;
  apProjecaoSub(idade: number, vida: number | null): string;
  apAcumulo: string;
  apAcumuloDesc: string;
  apUsufruto: string;
  apUsufrutoDesc: string;
  apAnoAAno: string;
  apNominal: string;
  apReal: string;
  // Abas, menu e a lista da semana
  planTabs: [string, string, string];
  carteiraTabs: [string, string, string];
  visaoGeralLink: string;
  semanaTitulo: string;
  /** A tarefa da semana na voz do tema. Recebe a chave e o texto original, devolve o texto. */
  tarefa(chave: string, texto: string, feita: boolean): string;
  /** Rótulo de uma seção do menu (por basePath) e de um item filho (por href). Sem tradução, devolve o original. */
  navSecao(basePath: string, texto: string): string;
  navFilho(href: string, texto: string): string;
  navMais: string;
  navPerfis: string;
  navInstalar: string;
  navWhatsapp: string;
  navSair: string;
  // Carteira
  carteira: string;
  carteiraSub: string;
  carteiraLink: string;
  carteiraVazio: string;
  porObjetivo: string;
  porObjetivoSub: string;
  porObjetivoEditar: string;
  posicaoPorObjetivo: string;
  objReserva: string;
  objLiberdade: string;
  objSem: string;
  objSemMetaHint: string;
  secaoMetas: string;
  estrategiaVsAlvo: string;
  alocacaoPorClasse: string;
  estrategia: string;
  estrategiaSub: string;
  // Miolo da carteira
  contribTitulo(mes: string): string;
  contribSub: string;
  contribLabel: string;
  contribSemAtivo: string;
  contribVazio: string;
  contribSemEstrategiaTitulo: string;
  contribSemEstrategiaSub: string;
  contribDefinir: string;
  divTitulo(total: string): string;
  divDatas(dataCom: string, pagamento: string): string;
  divLiquido: string;
  divBruto: string;
  divNota: string;
  compHint: string;
  compVoceTem: string;
  compDeveriaTer: string;
  compAportar: string;
  compReduzir: string;
  objNenhumTitulo: string;
  objNenhumTexto(valor: string): string;
  objNenhumLink: string;
  // O botão mais usado do app e o que ele diz quando salva
  registrar: string;
  registrarNovo: string;
  registrarFalar: string;
  registrarImportar: string;
  lancamentoSalvo: string;
  /**
   * "R$ 513 a mais que em agosto" — a linha embaixo de cada categoria em Só gastos.
   * `categoriaKey` é a categoria-mãe (ALIMENTACAO, MORADIA…) ou undefined nas personalizadas:
   * o Sem filtro usa pra tirada ser da categoria certa (iFood é só em comida, não em moradia).
   */
  comparacao(tipo: "sem" | "igual" | "mais" | "menos", valor: string, mes: string, categoriaKey?: string): string;
  /** O card do campeão do mês (Sem filtro): a pergunta muda com a categoria. */
  campeaoTitulo: string;
  campeaoPergunta(categoriaKey: string, label: string): string;
  // Simuladores
  simuladores: string;
  simuladoresSub: string;
  simulador(href: string, padrao: { title: string; subtitle: string }): { title: string; subtitle: string };
};

const TITULOS_BASE: TitulosBase = {
  visaoGeral: "Visão Geral",
  visaoGeralSub: "Consolidado de {ano}.",
  patrimonio: "Patrimônio total",
  rendaNoAno: "Renda no ano",
  gastosNoAno: "Gastos no ano",
  sobrouNoAno: "Sobrou no ano",
  sobrouNoAnoDica: (cem, manteve) => `De cada ${cem} que entraram, você manteve ${manteve}`,
  statusModulos: "Status dos módulos",
  modReserva: "Reserva de emergência",
  modMetas: "Metas",
  modAposentadoria: "Aposentadoria",
  modDividendos: "Dividendos (30 dias)",
  economiaNoMes: "Economia no mês",
  economiaAbaixo: "Abaixo do planejado",
  economiaAcima: "Acima do planejado",
  categoriaEstourou: "Categoria que mais estourou",
  categoriaEstourouDica: (pct) => `+${pct} acima do planejado`,
  nenhumaEstourou: "Nenhuma categoria estourou este mês",
  economizouMaisEm: "Economizou mais em",
  economizouMaisEmDica: (pct) => `${pct} abaixo do planejado`,
  semLancamento: "Sem lançamento",
  soGastos: "Só gastos",
  soGastosSub: "Para onde seu dinheiro foi, por categoria.",
  orcamento: "Orçamento",
  orcamentoSub: "Quanto você planejou gastar, e quanto já foi.",
  orcamentoPorCategoria: "Orçamento por categoria",
  paraOndeFoi: "Para onde foi seu dinheiro este mês",
  oQueMudou: "O que mudou",
  ritmoDoMes: "Ritmo do mês",
  anoMesAMes: "Renda, gastos e aportes por mês",
  caiuNaConta: "Caiu na conta",
  caiuNaContaSub: "Proventos dos seus ativos pagos nos últimos dias. Um toque lança como renda no dia do pagamento.",
  planejamento: "Planejamento",
  poupanca: "Poupança",
  aportou: "Aportou",
  entrou: "Entrou",
  gastou: "Gastou",
  metas: "Metas",
  metasSub: "Cadastre metas com prazo e veja quanto precisa aportar por mês para chegar lá.",
  metasVazio: "Nenhuma meta cadastrada ainda. Crie a primeira e veja quanto precisa guardar por mês para chegar lá.",
  reserva: "Reserva de Emergência",
  reservaSub: "Meta calculada como meses de proteção × custo mensal, com projeção mês a mês até atingi-la.",
  reservaMeta: "Meta da reserva",
  reservaAtual: "Reserva atual",
  reservaTempo: "Tempo para concluir",
  reservaRendimento: "Rentabilidade mensal",
  reservaProjecao: "Projeção da reserva",
  aposentadoria: "Aposentadoria",
  aposentadoriaSub: "Da fase de acúmulo até viver de renda: acompanhe a jornada inteira em um só lugar.",
  aposentadoriaWizardSub: "Vamos montar seu plano em alguns passos rápidos.",
  metaStatus: { ahead: "Adiantada", onTrack: "No ritmo", behind: "Atrasada", achieved: "Concluída" },
  metaGuardar: (v) => `Guardar ${v} este mês`,
  metaMeses: (n) => `${n} ${n === 1 ? "mês restante" : "meses restantes"}`,
  metaAporteFeito: (mes) => `Aporte de ${mes} feito`,
  metaAporteToast: (mes) => `Aporte de ${mes} registrado na meta.`,
  metaMarcar: (mes) => `Marcar aporte de ${mes}`,
  metaOutroValor: "outro valor",
  splitTitulo: (mes) => `Pra onde vai o que você guarda em ${mes}`,
  splitSub: (v) => `${v} por mês, do seu orçamento. Reserva primeiro, depois as metas por prazo.`,
  splitVazioTitulo: "Pra onde vai o que você guarda?",
  splitVazioSub: "Diga no orçamento quanto quer guardar por mês, e o app divide entre reserva e metas.",
  formCusto: "Quanto custa um mês da sua vida?",
  formCustoHint: "É esse valor que a reserva precisa cobrir enquanto a renda não volta.",
  formMeses: "Quantos meses quer ter guardados?",
  formMesesHint: "Renda estável costuma pedir 6. Autônomo ou renda variável, 12.",
  formJaTenho: "Já tenho guardado",
  formGuardoPorMes: "Guardo por mês",
  formRende: "Quanto a reserva rende por ano",
  formRendeHint: "Reserva fica em aplicação de liquidez diária, então costuma render perto do CDI.",
  apSeNadaMudar: (idade) => `Se nada mudar, aos ${idade} anos você tem`,
  apHoje: "em dinheiro de hoje",
  apDaPe: "Dá pé",
  apNaoDaPe: "Ainda não dá pé",
  apVereditoIntro: "É o que esse patrimônio paga sem consumir o principal. Você quer gastar",
  apSobram: "— sobram",
  apFaltam: "— faltam",
  apTodoMes: "todo mês.",
  apDeOndeVem: "De onde vem esse dinheiro",
  apDeOndeVemHint: "Em dinheiro de hoje, a mesma moeda do número lá em cima.",
  apBolso: (anos) => `Você põe do bolso em ${anos} anos`,
  apJuros: "Os juros põem",
  apJurosNota: (um, mais) => `Para cada ${um} que sai do seu bolso, os juros colocam mais ${mais}.`,
  apPremissas: "Ver as premissas",
  apEditar: "Editar meus dados",
  apProjecao: "Projeção patrimonial",
  apProjecaoSub: (idade, vida) => `Fase de acúmulo até os ${idade} anos${vida ? `, seguida da fase de usufruto até os ${vida} anos` : ""}.`,
  apAcumulo: "Acúmulo",
  apAcumuloDesc: "você ainda está aportando, o patrimônio só cresce.",
  apUsufruto: "Usufruto",
  apUsufrutoDesc: "os aportes param e os saques para viver começam.",
  apAnoAAno: "Ver dados detalhados ano a ano",
  apNominal: "Patrimônio (nominal)",
  apReal: "Patrimônio (real)",
  planTabs: ["Metas", "Reserva", "Aposentadoria"],
  carteiraTabs: ["Meus Ativos", "Por Objetivo", "Estratégia"],
  visaoGeralLink: "Ver Fluxo Financeiro",
  semanaTitulo: "O que fazer esta semana",
  tarefa: (_chave, texto) => texto,
  navSecao: (_b, texto) => texto,
  navFilho: (_h, texto) => texto,
  navMais: "Mais",
  navPerfis: "Perfis financeiros",
  navInstalar: "Instalar na tela de início",
  navWhatsapp: "Falar com a gente no WhatsApp",
  navSair: "Sair",
  carteira: "Carteira de Investimentos",
  carteiraSub: "Acompanhe seus ativos e o objetivo de cada um.",
  carteiraLink: "Ver consolidação por objetivo →",
  carteiraVazio: "Nenhum ativo cadastrado ainda. Adicione o primeiro para acompanhar sua carteira aqui.",
  porObjetivo: "Carteira por Objetivo",
  porObjetivoSub: "Posição atual por objetivo e alocação atual vs. ideal por classe.",
  porObjetivoEditar: "← editar ativos",
  posicaoPorObjetivo: "Posição por objetivo",
  objReserva: "Reserva de emergência",
  objLiberdade: "Liberdade financeira",
  objSem: "Sem objetivo definido",
  objSemMetaHint: "Sem meta cadastrada em Reserva de Emergência",
  secaoMetas: "Metas",
  estrategiaVsAlvo: "Carteira atual × estratégia-alvo",
  alocacaoPorClasse: "Alocação atual × ideal por classe",
  estrategia: "Estratégia da Carteira",
  estrategiaSub: "Defina os percentuais-alvo por classe de estratégia (somando 100%), independente da alocação-ideal de cada ativo individual.",
  contribTitulo: (mes) => `Qual é o seu aporte de ${mes}?`,
  contribSub: "Sugestão de aporte para rebalanceamento da carteira.",
  contribLabel: "Vou aportar",
  contribSemAtivo: " · ainda sem ativo desse tipo",
  contribVazio: "Sua carteira ainda está vazia, então a divisão segue só a estratégia.",
  contribSemEstrategiaTitulo: "Onde colocar o aporte deste mês?",
  contribSemEstrategiaSub: "Com uma estratégia definida, o app diz quanto vai pra cada tipo de investimento pra sua carteira chegar no alvo. São três perguntas.",
  contribDefinir: "Definir minha estratégia →",
  divTitulo: (total) => `Próximos dividendos · ${total} previstos`,
  divDatas: (dataCom, pagamento) => `Data com ${dataCom} · Pagamento ${pagamento}`,
  divLiquido: "líquido de IR",
  divBruto: "bruto, s/ IR",
  divNota: "Estimativa com a quantidade de hoje — se você comprar ou vender antes da data-com, o valor muda. JSCP mostra já líquido dos 15% de IR retido na fonte; Dividendos e Rendimentos de FII costumam ser isentos. Fonte: investidor10.",
  compHint: "O tracinho é o alvo. Quem está atrás dele é o que comprar no próximo aporte.",
  compVoceTem: "Você tem",
  compDeveriaTer: "Deveria ter",
  compAportar: "Aportar",
  compReduzir: "Reduzir",
  objNenhumTitulo: "Nenhum ativo tem objetivo ainda.",
  objNenhumTexto: (valor) => `Seus ${valor} estão todos em "sem objetivo". Dizer o que cada ativo é — reserva, liberdade financeira ou uma meta — é o que deixa esta tela responder "quanto falta" em vez de só somar.`,
  objNenhumLink: "Dar objetivo aos ativos →",
  registrar: "Registrar",
  registrarNovo: "Novo lançamento",
  registrarFalar: "Falar lançamento",
  registrarImportar: "Importar extrato",
  lancamentoSalvo: "Lançamento salvo com sucesso.",
  comparacao: (tipo, valor, mes) =>
    tipo === "sem" ? `Não teve gasto em ${mes}` : tipo === "igual" ? `Igual a ${mes}` : tipo === "mais" ? `${valor} a mais que em ${mes}` : `${valor} a menos que em ${mes}`,
  campeaoTitulo: "O campeão do mês",
  campeaoPergunta: (_k, label) => `Você gastou quanto em ${label.toLowerCase()}?`,
  simuladores: "Vamos descobrir quanto seu dinheiro pode render?",
  simuladoresSub: "Calculadoras para decisões financeiras importantes do dia a dia.",
  simulador: (_h, padrao) => padrao,
};

/**
 * Os textos do app por área (simuladores, formulários, importação…). Cada área mora em
 * `textos/<área>.ts` com o tipo e as frases do Padrão; aqui só se compõe. Assim seis frentes
 * podem catalogar textos ao mesmo tempo sem disputar este arquivo.
 */
export type Titulos = TitulosBase & TextosSimuladores & TextosFormularios & TextosImportacao & TextosShell & TextosConfiguracoes & TextosCarteira;

export const TITULOS_PADRAO: Titulos = {
  ...TITULOS_BASE,
  ...PADRAO_SIMULADORES,
  ...PADRAO_FORMULARIOS,
  ...PADRAO_IMPORTACAO,
  ...PADRAO_SHELL,
  ...PADRAO_CONFIGURACOES,
  ...PADRAO_CARTEIRA,
};

/** Um mapa por rota vira a função de simulador de um tema; sem entrada, fica o Padrão. */
export function simuladoresDoTema(mapa: Record<string, { title?: string; subtitle?: string }>): Titulos["simulador"] {
  return (href, padrao) => ({ ...padrao, ...(mapa[href] ?? {}) });
}

/** Os números que vêm dentro do texto original da tarefa ("Revisar 2 categorias…", "(20%)"). */
export const numeros = (texto: string) => texto.match(/\d+/g) ?? [];

/**
 * Monta a função de tarefa de um tema a partir de um mapa por chave. Cada tema só escreve as
 * frases; os números ("2 categorias", "20%") vêm do texto original, extraídos aqui.
 */
export type Tarefas = Partial<Record<string, (n: string | undefined, feita: boolean, plural: boolean) => string>>;
export function tarefasDoTema(mapa: Tarefas): Titulos["tarefa"] {
  return (chave, texto, feita) => {
    const [n] = numeros(texto);
    const f = mapa[chave];
    return f ? f(n, feita, n !== undefined && n !== "1") : texto;
  };
}


export const CUMPRIMENTO: Record<Periodo, string> = { manha: "Bom dia", tarde: "Boa tarde", noite: "Boa noite" };

/** "R$ 9.510" sem centavos: nas frases, o centavo é ruído. */
export const inteiro = (money: Money, n: number) => money(Math.abs(n), { round: true });

export function pctDaRenda(d: DadosResultado): string {
  if (d.income <= 0) return "";
  return `${Math.round(((d.income - d.expense) / d.income) * 100)}%`;
}

/** As frases de orçamento que o app já tinha, palavra por palavra. */
export function fraseOrcamentoPadrao(d: DadosOrcamento): string {
  const { situacao, restante, porDia, diasRestantes, ultimoDia, money } = d;
  if (situacao === "sem-plano") {
    return "Você ainda não disse quanto quer gastar este mês. Defina ali embaixo e o app passa a te avisar antes de estourar.";
  }
  if (situacao === "estourou") return `Você passou ${inteiro(money, restante)} do que tinha planejado.`;
  if (porDia === null || diasRestantes === 0) return `Sobrou ${inteiro(money, restante)} do planejado.`;
  const sobra = `Sobram ${inteiro(money, restante)} para ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}: ${inteiro(money, porDia)} por dia até dia ${ultimoDia}.`;
  if (situacao === "adiantado") return `${sobra} Você está gastando adiantado para a altura do mês.`;
  if (situacao === "folgado") return `${sobra} Está sobrando mais do que o esperado — dá pra guardar a diferença.`;
  return sobra;
}

/** Mês fechado ou sem plano: nenhum tema tem o que dizer de diferente — cai no Padrão. */
export function semDiaria(d: DadosOrcamento): string | null {
  if (d.situacao === "sem-plano" || d.porDia === null || d.diasRestantes === 0) return fraseOrcamentoPadrao(d);
  return null;
}
