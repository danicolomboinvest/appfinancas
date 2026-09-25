/**
 * Textos dos e-mails recorrentes (o resumo do mês e o convite pra quem não usou), na voz do
 * Padrão — as frases EXATAS que o e-mail já tinha antes de existir por tema. O visual do e-mail
 * (cores, moldura) fica igual pra todo mundo — cliente de e-mail lida mal com CSS variável, e a
 * cor de sucesso/erro (verde/vermelho) é semântica, não do tema. O que muda por tema é só o
 * texto: saudação, o jeito de contar como foi o mês, e o convite pra voltar.
 *
 * Prefixo `email`.
 */
export type TextosEmail = {
  /** "Oi, Dani!" / "Oi!" sem nome. */
  emailSaudacao(nome?: string): string;
  emailRecapAssunto(mes: string): string;
  emailRecapIntro(mes: string): string;
  emailRecapSobrou: string;
  emailRecapFaltou: string;
  emailRecapPrimeiroMes: string;
  emailRecapGastosIguais: string;
  /** `valorEstilizado` já vem com o `<strong>` colorido pronto (ex.: "12% menos"). */
  emailRecapGastosMenos(valorEstilizado: string): string;
  emailRecapGastosMais(valorEstilizado: string): string;
  /** Rótulo antes do nome da categoria: "Maior gasto: Moradia". */
  emailMaiorGasto: string;
  emailRecapBotao: string;
  emailRecapRodape: string;
  emailConviteAssunto(mes: string): string;
  emailConviteIntro1(mes: string): string;
  /** Parágrafo com o `<strong>` já embutido no HTML, sem parte dinâmica. */
  emailConviteIntro2: string;
  emailConviteBotao: string;
};

export const PADRAO_EMAIL: TextosEmail = {
  emailSaudacao: (nome) => (nome ? `Oi, ${nome}!` : "Oi!"),
  emailRecapAssunto: (mes) => `Seu resumo de ${mes} está pronto`,
  emailRecapIntro: (mes) => `Fechamos ${mes}. Veja como foi:`,
  emailRecapSobrou: "Sobrou no mês",
  emailRecapFaltou: "Faltou no mês",
  emailRecapPrimeiroMes: "Esse foi seu primeiro mês com registros — no próximo dá pra comparar.",
  emailRecapGastosIguais: "Seus gastos ficaram praticamente no mesmo nível do mês anterior.",
  emailRecapGastosMenos: (valor) => `Você gastou ${valor} que no mês anterior.`,
  emailRecapGastosMais: (valor) => `Seus gastos ficaram ${valor} do mês anterior.`,
  emailMaiorGasto: "Maior gasto",
  emailRecapBotao: "Ver o mês completo",
  emailRecapRodape: "Você recebe este resumo uma vez por mês.",
  emailConviteAssunto: (mes) => `Bora organizar ${mes}?`,
  emailConviteIntro1: (mes) =>
    `Começou ${mes} — e mês novo é a melhor hora pra começar, porque você acompanha ele inteiro, do início ao fim.`,
  emailConviteIntro2:
    "Não precisa organizar tudo de uma vez. <strong>Anote um gasto de hoje</strong>, só um, e o app já começa a montar o resto: pra onde seu dinheiro está indo, quanto sobra, quanto dá pra guardar.",
  emailConviteBotao: "Anotar meu primeiro gasto",
};
