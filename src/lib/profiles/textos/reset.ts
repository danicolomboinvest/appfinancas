/**
 * Textos do Money Reset (05/10/2026), na voz do Padrão. O conteúdo das 21 missões é da aula e
 * mora em lib/money-reset/missoes.ts; aqui fica a "moldura" (títulos, botões, avisos), que muda
 * de tema. Prefixo `mr`. As funções aceitam qualquer argumento (o teste de jargão chama todas).
 */

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export type TextosReset = {
  mrTitulo: string;
  mrSub: string;
  mrMissaoDeHoje: string;
  mrProxima: string;
  mrHoje: string;
  mrComecar: string;
  mrGuiar: string;
  mrPorque: string;
  mrPrecisa: string;
  mrSozinho: string;
  mrPassoAPasso: string;
  mrTravou: string;
  mrAjuda: string;
  mrFeita: string;
  mrFeitaSub: string;
  mrAmanha: (titulo: string) => string;
  mrVoltar: string;
  mrVerTrilha: string;
  mrDia: (dia: number) => string;
  mrSemana: (semana: number) => string;
  mrFeitas: (feitas: number) => string;
  mrAbreAmanha: string;
  mrBloqueada: string;
  mrFiz: string;
  mrConfereSozinho: string;
  mrConfereVoce: string;
  mrMinutos: (min: number) => string;
  // Dia 0
  mrBoas: string;
  mrBoasSub: string;
  mrSepare: string;
  mrSepareiTudo: string;
  mrDia1Amanha: string;
  // Fim
  mrConcluido: string;
  mrConcluidoSub: string;
  mrCompartilhar: string;
  // Guia
  mrSairGuia: string;
  mrAbrirParaMim: string;
  mrIrDireto: string;
  mrPassoDe: (passo: number, total: number) => string;
  mrGuiaFim: string;
  // Foco
  mrFocoEy: string;
  mrFocoAmanha: string;
};

export const PADRAO_RESET: TextosReset = {
  mrTitulo: "Money Reset",
  mrSub: "21 dias para colocar seu dinheiro no lugar.",
  mrMissaoDeHoje: "Missão de hoje",
  mrProxima: "Próxima missão",
  mrHoje: "Hoje",
  mrComecar: "Começar",
  mrGuiar: "Começar, eu te guio",
  mrPorque: "Por quê",
  mrPrecisa: "Tenha em mãos",
  mrSozinho: "O app já faz sozinho",
  mrPassoAPasso: "Passo a passo",
  mrTravou: "Travou?",
  mrAjuda: "Precisa de ajuda?",
  mrFeita: "Missão feita!",
  mrFeitaSub: "A próxima abre amanhã.",
  mrAmanha: (titulo) => `Amanhã: ${titulo}`,
  mrVoltar: "Voltar ao Foco",
  mrVerTrilha: "Ver os 21 dias",
  mrDia: (dia) => `Dia ${n(dia)}`,
  mrSemana: (semana) => `Semana ${n(semana)}`,
  mrFeitas: (feitas) => `${n(feitas)} de 21 feitas`,
  mrAbreAmanha: "Abre amanhã",
  mrBloqueada: "Ainda não abriu",
  mrFiz: "Fiz",
  mrConfereSozinho: "O app confere sozinho quando você fizer.",
  mrConfereVoce: "Quando fizer, toque em Fiz.",
  mrMinutos: (min) => `${n(min)} min`,
  mrBoas: "Seu Money Reset está liberado",
  mrBoasSub: "Amanhã começa o dia 1. Hoje, 5 minutos para separar o que vai precisar.",
  mrSepare: "O que separar",
  mrSepareiTudo: "Separei tudo",
  mrDia1Amanha: "Pronto. O dia 1 abre amanhã.",
  mrConcluido: "Você terminou os 21 dias",
  mrConcluidoSub: "O seu plano está pronto e mora no app. Volte nele quando precisar.",
  mrCompartilhar: "Compartilhar",
  mrSairGuia: "Sair do guia",
  mrAbrirParaMim: "Não achei. Abrir para mim",
  mrIrDireto: "Não achei. Ir direto",
  mrPassoDe: (passo, total) => `${n(passo)} de ${n(total)}`,
  mrGuiaFim: "Pronto. Volte à missão para ver como ficou.",
  mrFocoEy: "Money Reset",
  mrFocoAmanha: "A próxima missão abre amanhã.",
};

export const GIRLY_RESET: Partial<TextosReset> = {
  mrSub: "21 dias para colocar seu dinheiro no lugar 💖",
  mrMissaoDeHoje: "Missão de hoje ✨",
  mrProxima: "Próxima missão ✨",
  mrComecar: "Bora começar 💕",
  mrGuiar: "Bora, eu te guio 💕",
  mrPorque: "Por que isso importa",
  mrPrecisa: "Separa antes",
  mrFeita: "Boaaaa, missão feita! 🎉",
  mrFeitaSub: "A próxima abre amanhã, amiga.",
  mrVoltar: "Voltar para o Foco",
  mrBoas: "Seu Money Reset chegou! 💖",
  mrBoasSub: "Amanhã começa o dia 1. Hoje é só separar o que vai precisar, 5 minutinhos.",
  mrSepareiTudo: "Separei tudo ✅",
  mrDia1Amanha: "Prontinho! O dia 1 abre amanhã 💕",
  mrConcluido: "Você fez os 21 dias! 🥳",
  mrConcluidoSub: "Seu plano está pronto e mora aqui no app. Volta nele sempre que precisar 💖",
  mrCompartilhar: "Postar no story ✨",
  mrGuiaFim: "Prontinho! Volta na missão para ver como ficou 💕",
  mrFocoAmanha: "A próxima missão abre amanhã 💕",
};
