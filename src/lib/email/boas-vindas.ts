import { button, escaparHtml, primeiroNome, shell } from "@/lib/email/templates";

/**
 * Os cinco e-mails de boas-vindas, com o texto que a Dani aprovou em 30/09/2026
 * (prévia: https://claude.ai/artifact/A4gCtVSG6zcvWVKR3ubtjW). Mudar texto aqui é mudar o que
 * ela aprovou: mostrar pra ela antes.
 *
 * Por que existem: até aqui a compradora recebia "acesso liberado" na compra e "confirme seu
 * e-mail" no cadastro, e depois nada. Medido em 30/09: 53 pessoas liberadas no último mês nunca
 * criaram a conta, e quase todo pedido de reembolso chega perto do 7º dia, de quem não usou.
 *
 * Duas trilhas, e cada e-mail só sai pra quem precisa dele (quem decide é
 * src/lib/onboarding/boas-vindas.ts):
 *  - comprou e não criou a conta: lembrete no 1º e no 4º dia;
 *  - criou a conta: boas-vindas na confirmação do e-mail, e no 2º e no 5º dia só se continuar
 *    sem nenhum lançamento.
 *
 * Nenhum fala do prazo da garantia, de propósito: lembrar o prazo é lembrar de pedir o dinheiro.
 * Sem travessão no texto (é a voz dela).
 */

const MUTED = "#6b6b6b";
const GOLD = "#c8a86a";

export type EmailPronto = { subject: string; html: string };

function p(texto: string, estilo = ""): string {
  return `<p style="margin:0 0 16px;${estilo}">${texto}</p>`;
}

function pequeno(texto: string): string {
  return `<p style="margin:0 0 8px;color:${MUTED};font-size:13px;">${texto}</p>`;
}

function botao(href: string, rotulo: string, margem = "0 0 24px"): string {
  return `<p style="margin:${margem};">${button(href, rotulo)}</p>`;
}

function assinatura(): string {
  return p("Dani", "margin:8px 0 0;");
}

/** 1 dia depois da compra, sem conta criada. */
export function lembreteContaDia1Email(params: { email: string; registerUrl: string }): EmailPronto {
  return {
    subject: "Seu SPI Finance está esperando você",
    html: shell(
      p("Oi!") +
        p("Ontem você garantiu o SPI Finance, mas a sua conta ainda não foi criada. Leva um minuto:") +
        botao(params.registerUrl, "Criar minha conta") +
        pequeno(`Na hora do cadastro, use este mesmo e-mail (<strong>${escaparHtml(params.email)}</strong>). É ele que está liberado.`) +
        pequeno("Se aparecer algum erro, é só responder este e-mail que a gente resolve."),
    ),
  };
}

/** 4 dias depois da compra, sem conta criada. O último lembrete. */
export function lembreteContaDia4Email(params: { email: string; registerUrl: string }): EmailPronto {
  return {
    subject: "Falta só um passo para você entrar",
    html: shell(
      p("Oi!") +
        p("Passando para lembrar: o seu acesso ao SPI Finance continua liberado, esperando você criar a conta.") +
        p("Se você tentou e não conseguiu, me conta o que aconteceu respondendo aqui. Às vezes é só o cadastro feito com outro e-mail, e isso a gente arruma rapidinho.") +
        botao(params.registerUrl, "Criar minha conta") +
        pequeno(`Use o e-mail <strong>${escaparHtml(params.email)}</strong> no cadastro.`) +
        assinatura(),
    ),
  };
}

function oi(nome: string | null, pontuacao = "!"): string {
  const primeiro = primeiroNome(nome);
  return primeiro ? `Oi, ${primeiro}${pontuacao}` : `Oi${pontuacao}`;
}

/** Na confirmação do e-mail: a conta abriu. */
export function boasVindasEmail(params: { name: string | null; appUrl: string; guiaUrl: string }): EmailPronto {
  return {
    subject: "Seu primeiro minuto no SPI Finance",
    html: shell(
      p(oi(params.name)) +
        p("Sua conta está pronta. Antes de qualquer gráfico, o SPI Finance precisa de uma coisa só: o seu primeiro gasto.") +
        p("O jeito mais rápido é falar. Toca no <strong>+</strong> no meio da barra de baixo e diz, por exemplo:") +
        `<p style="margin:0 0 16px;padding:12px 16px;border-radius:12px;background:#f7f4ec;border-left:3px solid ${GOLD};font-size:15px;">“mercado, duzentos e quarenta reais”</p>` +
        p("Pronto, ele entra no mês com a categoria certa. Se preferir fazer o mês inteiro de uma vez, exporta o extrato no app do seu banco e solta lá dentro.") +
        botao(params.appUrl, "Lançar meu primeiro gasto") +
        pequeno(`Ficou com dúvida? Tem um guia curtinho de como usar dentro do app: no menu, em <a href="${params.guiaUrl}" style="color:${MUTED};"><strong>Como usar o app</strong></a>.`),
    ),
  };
}

/** 2 dias depois da confirmação, só se não há nenhum lançamento. */
export function vazioDia2Email(params: { name: string | null; appUrl: string }): EmailPronto {
  return {
    subject: "Um gasto. Só um.",
    html: shell(
      p(oi(params.name)) +
        p("Seu SPI Finance ainda está vazio, e tudo bem. Ninguém precisa organizar o mês inteiro hoje.") +
        p("Lança só o último gasto que você lembra: o café, o mercado, o Uber. Falando ou digitando, leva dez segundos.") +
        p("É a partir dele que o app começa a te mostrar quanto ainda está livre no mês e o que pede a sua atenção.") +
        botao(params.appUrl, "Lançar agora", "0 0 8px"),
    ),
  };
}

/** 5 dias depois da confirmação, só se não há nenhum lançamento. O último. */
export function vazioDia5Email(params: { name: string | null; appUrl: string }): EmailPronto {
  return {
    subject: "Posso te ajudar a começar?",
    html: shell(
      p(oi(params.name, ".")) +
        p("O seu SPI Finance continua em branco, e eu queria entender por quê. Às vezes é o extrato que não entrou, às vezes é a correria, às vezes a pessoa só não sabe por onde começar.") +
        p("Se for qualquer uma dessas, responde este e-mail me contando. A gente te ajuda a colocar o seu primeiro mês lá dentro.") +
        botao(params.appUrl, "Abrir o SPI Finance") +
        assinatura(),
    ),
  };
}
