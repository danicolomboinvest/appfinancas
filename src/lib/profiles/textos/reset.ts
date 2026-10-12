/**
 * Textos do Money Reset, na voz do Padrão (versão A+B, 12/10/2026). O conteúdo das 21 missões é da
 * aula e mora em lib/money-reset/missoes.ts; aqui fica a "moldura" (títulos, botões, avisos), que
 * muda de tema. Prefixo `mr`. Sem gênero (regra da Dani). As funções aceitam qualquer argumento
 * (o teste de jargão chama todas).
 */

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const s = (v: unknown) => (typeof v === "string" ? v : "");

export type TextosReset = {
  mrTitulo: string;
  /** "Money Reset · 21 dias", no alto do mapa. */
  mrTopo: string;
  mrMissaoDe: (marco: number, semana: string) => string;
  mrComecarMissao: (marco: number) => string;
  mrAgora: string;
  mrMinutos: (min: number) => string;
  mrRitmo: string;
  mrGuiar: string;
  mrAjuda: string;
  mrTravou: string;
  mrVerMapa: string;
  // O app reage
  mrFeita: (marco: number) => string;
  mrAchou: string;
  mrNoAno: (valor: string) => string;
  mrMudou: string;
  mrProximaAbriu: (marco: number) => string;
  mrProximaEspera: (marco: number) => string;
  mrContinuar: string;
  mrDeixarAmanha: string;
  mrVerDeNovo: string;
  // Historinhas
  mrHistoriaDe: (semana: number, nome: string) => string;
  mrAbrirHistoria: string;
  mrMinhaVez: string;
  mrPularHistoria: string;
  // Fim
  mrConcluido: string;
  mrConcluidoSub: string;
  mrCartaoFrase: string;
  mrMostrarValor: string;
  mrCompartilhar: string;
  // Guia
  mrSairGuia: string;
  mrAbrirParaMim: string;
  mrIrDireto: string;
  mrPassoDe: (passo: number, total: number) => string;
  mrGuiaFim: string;
  // Foco
  mrFocoEy: string;
  // Conquistas (a notificação com confete, só nos momentos raros)
  conqMetaTitulo: string;
  conqMetaTexto: (nome: string) => string;
  conqFechamentoTitulo: string;
  conqFechamentoTexto: string;
  conqResetTitulo: string;
  conqResetTexto: string;
  conqBotao: string;
};

export const PADRAO_RESET: TextosReset = {
  mrTitulo: "Money Reset",
  mrTopo: "Money Reset · 21 dias",
  mrMissaoDe: (marco, semana) => `Missão ${n(marco)} de 21 · ${s(semana)}`,
  mrComecarMissao: (marco) => `Começar a missão ${n(marco)}`,
  mrAgora: "Agora",
  mrMinutos: (min) => `${n(min)} min`,
  mrRitmo: "1 por dia é o ideal. Terminou um? O próximo já abre.",
  mrGuiar: "Começar, eu te guio",
  mrAjuda: "Precisa de ajuda?",
  mrTravou: "Travou?",
  mrVerMapa: "Voltar ao mapa",
  mrFeita: (marco) => `Missão ${n(marco)} feita`,
  mrAchou: "Você achou, por mês",
  mrNoAno: (valor) => `${s(valor)} no ano`,
  mrMudou: "O que já mudou no seu SPI",
  mrProximaAbriu: (marco) => `A missão ${n(marco)} já abriu. O ideal é amanhã, mas se quiser, a gente segue agora.`,
  mrProximaEspera: (marco) => `A missão ${n(marco)} está esperando por você, no seu ritmo.`,
  mrContinuar: "Continuar minha rota",
  mrDeixarAmanha: "Deixar para amanhã",
  mrVerDeNovo: "Ver a missão de novo",
  mrHistoriaDe: (semana, nome) => `Semana ${n(semana)} · ${s(nome)}`,
  mrAbrirHistoria: "Abrir a história",
  mrMinhaVez: "Agora é a minha vez",
  mrPularHistoria: "Pular a história",
  mrConcluido: "Você chegou no fim do mapa",
  mrConcluidoSub: "O seu plano está pronto e mora no app. Volte nele quando precisar.",
  mrCartaoFrase: "Organizei meu dinheiro em 21 dias",
  mrMostrarValor: "Mostrar o valor no cartão",
  mrCompartilhar: "Compartilhar",
  mrSairGuia: "Sair do guia",
  mrAbrirParaMim: "Não achei. Abrir para mim",
  mrIrDireto: "Não achei. Ir direto",
  mrPassoDe: (passo, total) => `${n(passo)} de ${n(total)}`,
  mrGuiaFim: "Pronto. Volte à missão para ver como ficou.",
  mrFocoEy: "Money Reset",
  conqMetaTitulo: "Meta alcançada!",
  conqMetaTexto: (nome) => `${nome}: você chegou lá. Isso é constância, não sorte.`,
  conqFechamentoTitulo: "Seu primeiro mês fechado",
  conqFechamentoTexto: "Você olhou o mês inteiro, entendeu e decidiu o próximo. É assim que o dinheiro entra no lugar.",
  conqResetTitulo: "Você terminou o Money Reset",
  conqResetTexto: "21 missões no mapa. Seu plano está pronto e mora no app.",
  conqBotao: "Continuar",
};

export const GIRLY_RESET: Partial<TextosReset> = {
  mrComecarMissao: (marco) => `Bora para a missão ${n(marco)}`,
  mrGuiar: "Bora, eu te guio",
  mrFeita: (marco) => `Boaaa, missão ${n(marco)} feita!`,
  mrContinuar: "Bora seguir",
  mrConcluido: "Você fez o mapa inteiro!",
  mrConcluidoSub: "Seu plano está pronto e mora aqui no app. Volta nele sempre que precisar",
  mrCompartilhar: "Postar no story",
  mrGuiaFim: "Prontinho! Volta na missão para ver como ficou",
  conqMetaTitulo: "Sonho realizado!",
  conqMetaTexto: (nome) => `${nome}: você chegou lá!`,
  conqFechamentoTitulo: "Primeiro mês fechado!",
  conqFechamentoTexto: "Você olhou o mês inteirinho e decidiu o próximo. Que orgulho!",
  conqResetTitulo: "21 missões feitas!",
  conqResetTexto: "Seu plano está pronto e mora aqui no app",
  conqBotao: "Valeu!",
};
