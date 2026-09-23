import type { Voz, Titulos } from "../voice-base";

/**
 * A camada da EMPRESA: o que muda no vocabulário quando o perfil é um negócio, em cima de
 * qualquer tema. Não é uma voz nova — o tema continua dando o tom (Girly fofo, Sem filtro
 * debochado) — é uma troca de assunto: renda vira faturamento, gasto vira custo e despesa,
 * "sobrou" vira lucro, guardar vira reter (reserva de caixa e reinvestimento), reserva de
 * emergência vira caixa de segurança, aposentadoria some (empresa não se aposenta).
 *
 * Só entra aqui o que fala de dinheiro de pessoa e ficaria errado numa empresa. O que é
 * neutro (botões, erros, importação) fica do tema.
 */
const TITULOS_EMPRESA: Partial<Titulos> = {
  // Painel do mês e visão geral
  entrou: "Faturou",
  gastou: "Custos e despesas",
  aportou: "Reteve",
  patrimonio: "Caixa e investimentos da empresa",
  rendaNoAno: "Faturamento no ano",
  gastosNoAno: "Custos e despesas no ano",
  sobrouNoAno: "Lucro no ano",
  sobrouNoAnoDica: (cem, manteve, pct) =>
    pct > 0 ? `De cada ${cem} faturados, ${manteve} viraram lucro (margem de ${pct}%)` : `Sem lucro no ano: os custos comeram tudo que entrou`,
  statusModulos: "Como está a empresa",
  modReserva: "Caixa de segurança",
  modMetas: "Metas da empresa",
  modAposentadoria: "Liberdade do dono",
  modDividendos: "Rendimento do caixa",
  economiaNoMes: "Lucro no mês",
  poupanca: "Margem",
  planejamento: "Orçamento",
  soGastosSub: "Para onde foi o dinheiro da empresa, por categoria.",
  orcamentoSub: "Quanto a empresa planejou gastar em cada frente, e quanto já foi.",
  paraOndeFoi: "Para onde foi o dinheiro da empresa este mês",
  caiuNaContaSub: "Rendimentos do caixa e dos investimentos da empresa. Um toque lança como receita.",
  uiRendaDividida: "Como o faturamento foi dividido",
  uiRendaCentro: "Faturou",
  uiRendaFatiaAportes: "Reteve",
  uiRendaGastouAMais: (valor) => `A empresa gastou ${valor} a mais do que faturou. Mês no vermelho.`,
  uiRendaManteve: (pct) => `A empresa segurou **${pct}** do que faturou (entre retenção e lucro).`,
  uiMaioresGastos: "Maiores custos do mês",
  uiFluxoTituloCorrente: (mes) => `Caixa de ${mes}: como está indo`,
  uiFluxoTituloFechado: (mes) => `Caixa de ${mes}: como fechou`,
  uiFluxoDicaCorrente: "A faixa entre as duas linhas é o que ficou no caixa até aqui.",
  uiFluxoDicaFechado: "A faixa entre as duas linhas é o que ficou no caixa (ou faltou).",

  // Metas, reserva e planejamento
  planTabs: ["Metas", "Caixa", "Dono"],
  metas: "Metas da empresa",
  metasSub: "Equipamento, expansão, reserva: cada meta com prazo e quanto reter por mês.",
  metasVazio: "Nenhuma meta ainda. Um equipamento, uma reforma, um caixa maior: crie a primeira.",
  metaGuardar: (v) => `Reter ${v} este mês`,
  reserva: "Caixa de segurança",
  reservaSub: "Quantos meses de despesas fixas a empresa aguenta sem faturar. O Sebrae recomenda de 3 a 6.",
  reservaMeta: "Meta do caixa",
  reservaAtual: "Caixa atual",
  reservaTempo: "Tempo pra completar",
  reservaProjecao: "Projeção do caixa",
  formCusto: "Quanto a empresa gasta de despesas fixas por mês?",
  formCustoHint: "Aluguel, equipe, pró-labore, contador, sistemas: o que precisa ser pago mesmo sem vender nada.",
  formMeses: "Quantos meses quer ter em caixa?",
  formMesesHint: "O Sebrae recomenda de 3 a 6 meses de despesas fixas. Negócio sazonal ou com poucos clientes, 6.",
  formJaTenho: "Já tem em caixa",
  formGuardoPorMes: "Consegue reter por mês",
  formRende: "Quanto o caixa rende por ano",
  formRendeHint: "Caixa de segurança fica em aplicação com liquidez diária (CDB, Tesouro Selic), rendendo perto do CDI.",
  splitTitulo: (mes) => `Pra onde vai o que a empresa retém em ${mes}`,
  splitSub: (v) => `${v} por mês, do seu orçamento. Caixa de segurança primeiro, depois as metas por prazo.`,
  splitVazioTitulo: "Pra onde vai a retenção?",
  splitVazioSub: "Diga no orçamento quanto a empresa retém por mês, e o app divide entre caixa e metas.",
  aposentadoria: "Liberdade do dono",
  aposentadoriaSub: "Quanto a empresa precisa acumular pra você, dono, viver de renda um dia. Opcional.",

  // Orçamento
  formOrcTitulo: "Vamos montar o orçamento da empresa",
  formOrcSub: "Três perguntas: quanto fatura, quanto retém e quanto gasta em cada frente.",
  formOrcRendaSugestao: (mes, valor) => `Em ${mes} a empresa faturou ${valor}.`,
  formOrcQuantoGuardar: "Quanto a empresa vai reter por mês?",
  formOrcCursoNota: () =>
    "Retenção é o que sai do faturamento antes de virar despesa: a reserva de caixa e o reinvestimento. Quem está começando costuma conseguir 10%. Impostos não entram aqui: eles têm a própria categoria.",
  formOrcSobraTitulo: "Orçamento pra custos e despesas",
  formOrcSobraSub: (valor) => `por mês, depois de reter ${valor}`,
  formOrcDividaTitulo: (valor) => `Divida os ${valor} entre as frentes da empresa`,
  formOrcSugestaoNota: () =>
    "A sugestão divide pelo peso médio de uma pequena empresa: impostos e equipe primeiro, depois mercadorias, estrutura, marketing e serviços. É ponto de partida: cada negócio tem a própria conta.",
  formOrcCustomNota: "Frota, aluguel de máquinas, royalties: o que é grande no seu negócio e não cabe nas frentes acima. O que vem uma vez por ano, divida por 12.",
  formOrcPraOnde: "Pra onde vai a retenção",
  formOrcPraOndeNota: "Caixa de segurança primeiro, depois as metas por prazo. O resto fica livre.",
  formOrcProntoPlano: (ano) => `Pronto. O orçamento da empresa em ${ano}`,
  formOrcFimDoAnoSub: (valor, meses) => `${valor} por mês nos ${meses} meses que faltam, mais o que sobrar de lucro.`,
  formOrcSeuPlano: (ano) => `Orçamento da empresa em ${ano}`,
  formOrcVerPlano: "Ver o orçamento da empresa →",

  // Metas: os tipos de meta de uma empresa, nos mesmos cinco ícones do banco.
  formMetaIcones: { VIAGEM: "Viagem a trabalho", CASA: "Ponto ou reforma", CARRO: "Veículo ou frota", APOSENTADORIA: "Caixa maior", GENERICO: "Equipamento ou outro" },
  formMetaNomePlaceholder: "Ex.: Máquina nova, Reforma da loja, Segundo ponto",

  // Registrar
  formLancDescricaoPlaceholder: "Ex.: o cliente, o fornecedor, o que foi",
  registrarNovo: "Novo lançamento",
  impExtratoDica: "Entrada vira receita, saída vira custo ou despesa, pelo sinal do valor.",
  impFaturaDica: "Todas as linhas entram como despesa da empresa (compras do cartão PJ).",

  // Carteira: os objetivos de um ativo na cabeça de quem tem empresa.
  formAtivoObjetivos: { OUTRO: "Outro", RESERVA_EMERGENCIA: "Caixa de segurança", LIBERDADE_FINANCEIRA: "Liberdade do dono", META: "Meta da empresa" },
  objReserva: "Caixa de segurança",
  objLiberdade: "Liberdade do dono",
  cartSuaCarteira: (n) => `Caixa e investimentos · ${n} ativo${n === 1 ? "" : "s"}`,
  cartVoceAportou: (valor, mes) => `A empresa reteve ${valor} em ${mes}`,
  carteira: "Caixa e investimentos",
  carteiraSub: "O caixa de segurança e o que a empresa tem aplicado, cada um com um objetivo.",
  carteiraVazio: "Nada aqui ainda. Cadastre onde está o caixa da empresa (conta, CDB, Tesouro) pra acompanhar.",
  uiPassoRegistrar: "Registre a primeira venda ou despesa",
  uiPassoOrcamento: "Monte o orçamento da empresa",
  uiPassoCarteira: "Cadastre onde está o caixa da empresa",
  uiTourFluxoTexto: "O mês da empresa num lugar só: faturamento, custos por frente e a DRE, com alerta quando uma frente passa do orçamento.",
  uiTourMetasTitulo: "Aqui são as Metas da empresa",
  uiTourMetasTexto: "Crie metas (equipamento, expansão), o caixa de segurança e, se quiser, a liberdade do dono. O app calcula quanto reter por mês.",
  uiTourCarteiraTexto: "O caixa e os investimentos da empresa, com o rendimento de cada um.",
  semanaTitulo: "O que fazer esta semana na empresa",
  cfgPerfisSub: "Cada perfil é um dinheiro separado: a empresa não se mistura com a pessoa. Lançamentos, metas e caixa de cada um ficam no seu canto.",
};

/**
 * As tarefas da semana e as frases de estado que mencionam pessoa física, refeitas pra
 * empresa. O tema ainda decide o tom das demais.
 */
export function comCamadaDaEmpresa(base: Voz): Voz {
  const tarefaBase = base.titulos.tarefa;
  return {
    ...base,
    rotuloResultado: "Lucro",
    nav: { ...base.nav, carteira: "Caixa" },
    tituloPainel: base.tituloPainel ? "Resultado da empresa" : null,
    tituloOrcamento: (mes) => `Orçamento da empresa em ${mes}`,
    metaBatida: (nome) => `Meta da empresa batida: ${nome}`,
    titulos: {
      ...base.titulos,
      ...TITULOS_EMPRESA,
      // No menu, a carteira da empresa é o caixa.
      navSecao: (b, t) => (b === "/carteira" ? "Caixa" : base.titulos.navSecao(b, t)),
      tarefa: (key, padrao, feita) => {
        const troca: Record<string, string> = {
          lancamentos: feita ? "Vendas e despesas da semana registradas" : "Registrar as vendas e despesas da semana",
          "orcamento-definir": "Montar o orçamento da empresa",
          "reserva-configurar": "Montar o caixa de segurança (3 a 6 meses de despesas fixas)",
          "reserva-ok": "Caixa de segurança completo",
          "meta-criar": "Criar a primeira meta da empresa",
          aporte: feita ? "Retenção do mês feita" : "Separar a retenção do mês (caixa e reinvestimento)",
        };
        return troca[key] ?? tarefaBase(key, padrao, feita);
      },
    },
  };
}
