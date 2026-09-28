/**
 * Textos da aba Foco (`/mensal/foco`) e do "Posso comprar?" (`/decidir`), na voz do Padrão.
 * Cada tema sobrescreve em `vozes/<tema>.ts`. Prefixo `foco`.
 *
 * Regra que vale aqui como em todo o app: a cobrança fala do número, nunca da pessoa.
 */
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
  // Fechamento do mês
  fechTitulo(mes: string): string;
  fechImportarT(mes: string): string;
  fechImportarP: string;
  fechImportarBtn: string;
  fechImportadoT(mes: string, n: number): string;
  fechLicao: string;
  fechSobraP: string;
  fechSobraReserva(valor: string): string;
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
  focoMetaP: (f) => `Pra voltar ao prazo, o aporte precisa ser de ${f} por mês.`,
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
  focoRitmoMensalSub: "15 minutos no fechamento: realizado × planejado.",
  focoRitmoAtual: (s) => (s ? "Você acompanha toda semana" : "Você acompanha uma vez por mês"),
  focoRitmoTrocar: "Trocar",
  compraTitulo: "Posso comprar?",
  compraOk: "Pode ir",
  compraCusto: "Cabe com custo",
  compraNao: "Não recomendo agora",
  compraDesisti: "Desisti",
  compraAmanha: "Decidir amanhã",
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
  fechTitulo: (m) => `Fechar ${m}`,
  fechImportarT: (m) => `Traga o extrato e a fatura de ${m}`,
  fechImportarP: "É o único trabalho braçal do mês. O resto eu faço.",
  fechImportarBtn: "Importar extrato ou fatura",
  fechImportadoT: (m, n) => `${n} ${n === 1 ? "lançamento" : "lançamentos"} de ${m} no app`,
  fechLicao: "A lição do mês:",
  fechSobraP: "Reserva primeiro, enquanto ela não estiver completa.",
  fechSobraReserva: (v) => `Mandar ${v} pra reserva`,
  fechSobraConta: "Deixar na conta",
  fechSobraSemReserva: "Essa sobra ainda não tem destino. Montar sua reserva de emergência é o primeiro passo pra ela ter um.",
  fechSobraReservaCompleta: "Sua reserva já está completa. Essa sobra pode ir pra uma das suas metas.",
  fechSemSobra: "Esse mês fechou sem sobra. Sem problema: o próximo passo é ajustar o plano.",
  fechAjusteP: "Ou o plano está baixo, ou o hábito está alto. Você decide qual dos dois.",
  fechAjusteSubir: (v) => `Subir o orçamento pra ${v}`,
  fechAjusteManter: "Manter e segurar",
  fechAporteEy: "O aporte do mês",
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
};
