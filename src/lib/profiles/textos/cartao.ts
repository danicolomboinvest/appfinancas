/**
 * Textos do limite do cartão (06/10/2026), na voz do Padrão, com o Girly logo abaixo. Prefixo `lim`.
 *
 * Os valores chegam já formatados (texto). As funções aceitam qualquer coisa: o teste de jargão
 * chama todas com ("Mercado", "R$ 10", 3). A voz fala com UMA pessoa, mesmo no perfil Casal.
 */

import type { NivelDoLimite } from "@/lib/cartao/limite";

export type TextosLimiteCartao = {
  limTitulo: string;
  limSub: string;
  /** A pergunta da tela, quando ainda não há limite. */
  limPergunta: string;
  limCampo: string;
  limCampoHint: string;
  limSalvar: string;
  limRemover: string;
  limSalvo: string;
  limRemovido: string;
  limInvalido: string;
  /** Rótulo do cartão no Foco e na tela: "Cartão em outubro". */
  limDoMes(mes: string): string;
  /** "R$ 1.840 de R$ 3.000". */
  limGastoDe(gasto: string, limite: string): string;
  limFalta(valor: string): string;
  limPassou(valor: string): string;
  /** Uma frase curta pelo tamanho do gasto. */
  limNivel: Record<NivelDoLimite, string>;
  limListaTitulo: string;
  limVazio: string;
  limComoMarcar: string;
  limMudar: string;
  /** Atalho no Orçamento: sem limite convida a definir; com limite diz quanto falta. */
  limAtalhoDefinir: string;
  limAtalhoFalta(valor: string): string;
  limAtalhoPassou(valor: string): string;
  /** O botão no formulário do +, só para gasto. */
  limNoCartao: string;
  limNoCartaoNota: string;
  /** O aviso depois de salvar um gasto no cartão. */
  limToastFalta(valor: string): string;
  limToastPassou(valor: string): string;
  /** A notificação (e o e-mail de quem não tem notificação ligada) em 70%, 90% e 100%. */
  limAvisoTitulo(marco: number, falta: string): string;
  limAvisoCorpo(marco: number, gasto: string, limite: string, mes: string): string;
  /** No "Posso comprar?", quando há limite do cartão. */
  limCompraCabe(falta: string): string;
  limCompraPassa(falta: string): string;
};

export const PADRAO_LIMITE_CARTAO: TextosLimiteCartao = {
  limTitulo: "Limite do cartão",
  limSub: "Quanto você combinou gastar no cartão por mês. O app avisa quando chegar perto.",
  limPergunta: "Quanto você pode gastar no cartão por mês?",
  limCampo: "Limite por mês",
  limCampoHint: "Conta o que você lançar marcando “No cartão” e a fatura que você importar.",
  limSalvar: "Salvar limite",
  limRemover: "Tirar o limite",
  limSalvo: "Limite do cartão salvo.",
  limRemovido: "Limite do cartão removido.",
  limInvalido: "Digite um valor válido.",
  limDoMes: (mes) => `Cartão em ${mes}`,
  limGastoDe: (gasto, limite) => `${gasto} de ${limite}`,
  limFalta: (valor) => `Faltam ${valor}`,
  limPassou: (valor) => `Passou ${valor}`,
  limNivel: {
    ok: "Dentro do combinado.",
    atencao: "Já foi boa parte do limite.",
    perto: "Quase no limite.",
    passou: "Passou do limite deste mês.",
  },
  limListaTitulo: "No cartão este mês",
  limVazio: "Nenhum gasto no cartão neste mês ainda.",
  limComoMarcar: "Ao lançar um gasto, toque em “No cartão” para ele contar aqui.",
  limMudar: "Mudar o limite",
  limAtalhoDefinir: "Montar um limite para o cartão",
  limAtalhoFalta: (valor) => `Faltam ${valor} este mês`,
  limAtalhoPassou: (valor) => `Passou ${valor} este mês`,
  limNoCartao: "No cartão de crédito",
  limNoCartaoNota: "Conta no limite do cartão.",
  limToastFalta: (valor) => `Lançado. Faltam ${valor} no limite do cartão.`,
  limToastPassou: (valor) => `Lançado. Você passou ${valor} do limite do cartão.`,
  limAvisoTitulo: (marco, falta) => (Number(marco) >= 100 ? "Você passou do limite do cartão" : `Faltam ${falta} no limite do cartão`),
  limAvisoCorpo: (marco, gasto, limite, mes) =>
    Number(marco) >= 100 ? `${gasto} no cartão em ${mes}, de ${limite} combinados.` : `Você já usou ${marco}% dos ${limite} combinados para ${mes}.`,
  limCompraCabe: (falta) => `Se for no cartão, cabe: faltam ${falta} do seu limite do mês.`,
  limCompraPassa: (falta) => `Se for no cartão, passa do seu limite do mês: faltam só ${falta}.`,
};

/** Girly: o mesmo, com um tempero. Sem "pra", "tá" e sem emoji em toda linha. */
export const GIRLY_LIMITE_CARTAO: Partial<TextosLimiteCartao> = {
  limTitulo: "Limite do cartão 💳",
  limSub: "Quanto você combinou gastar no cartão por mês. Eu aviso quando chegar perto 💕",
  limPergunta: "Quanto você pode gastar no cartão por mês? 💳",
  limNivel: {
    ok: "Dentro do combinado 💕",
    atencao: "Já foi boa parte do limite.",
    perto: "Quase no limite, segura um pouquinho 🫣",
    passou: "Passou do limite deste mês 🫣",
  },
  limVazio: "Nenhum gasto no cartão neste mês ainda 🌸",
  limToastFalta: (valor) => `Anotado! Faltam ${valor} no limite do cartão 💕`,
  limToastPassou: (valor) => `Anotado. Você passou ${valor} do limite do cartão 🫣`,
  limAvisoTitulo: (marco, falta) => (Number(marco) >= 100 ? "Você passou do limite do cartão 🫣" : `Faltam ${falta} no limite do cartão 💳`),
};
