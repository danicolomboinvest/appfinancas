import { assunto, criarBlocos, escaparHtml } from "@/lib/email/blocos";
import { emailSimples, primeiroNome, type EmailPronto } from "@/lib/email/templates";

/**
 * Os cinco e-mails de boas-vindas, com o texto que a Dani aprovou em 30/09/2026
 * (prévia: https://claude.ai/artifact/A4gCtVSG6zcvWVKR3ubtjW). Mudar texto aqui é mudar o que
 * ela aprovou: mostrar pra ela antes. Desde 11/10/2026 eles vestem a moldura B ("Aurora"): o
 * herói com o logo do tema e um cartão embaixo. O texto não mudou.
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

export type { EmailPronto };

/** Tema do perfil ativo, quando já existe (só na trilha de quem criou a conta). */
type ComTema = { tema?: string | null };

function oi(nome: string | null, pontuacao = "!"): string {
  const primeiro = primeiroNome(nome);
  return primeiro ? `Oi, ${primeiro}${pontuacao}` : `Oi${pontuacao}`;
}

/** 1 dia depois da compra, sem conta criada. */
export function lembreteContaDia1Email(params: { email: string; registerUrl: string }): EmailPronto {
  return emailSimples({
    b: criarBlocos(null),
    subject: "Seu SPI Finance está esperando você",
    preheader: "Leva um minuto para criar a conta.",
    saudacao: "Oi!",
    tituloDoHeroi: "Seu SPI Finance está esperando você",
    paragrafos: ["Você garantiu o SPI Finance, mas a sua conta ainda não foi criada. Leva um minuto:"],
    botao: { href: params.registerUrl, rotulo: "Criar minha conta" },
    notas: [`Na hora do cadastro, use este mesmo e-mail (<b>${escaparHtml(params.email)}</b>). É ele que está liberado.`, "Se aparecer algum erro, é só responder este e-mail que a gente resolve."],
    rodape: "Respondendo este e-mail, você fala com a gente.",
  });
}

/** 4 dias depois da compra, sem conta criada. O último lembrete. */
export function lembreteContaDia4Email(params: { email: string; registerUrl: string }): EmailPronto {
  const b = criarBlocos(null);
  return emailSimples({
    b,
    subject: "Falta só um passo para você entrar",
    preheader: "O seu acesso continua liberado.",
    saudacao: "Oi!",
    tituloDoHeroi: "Falta só um passo",
    paragrafos: [
      "Passando para lembrar: o seu acesso ao SPI Finance continua liberado, esperando você criar a conta.",
      "Se você tentou e não conseguiu, me conta o que aconteceu respondendo aqui. Às vezes é só o cadastro feito com outro e-mail, e isso a gente arruma rapidinho.",
    ],
    botao: { href: params.registerUrl, rotulo: "Criar minha conta" },
    notas: [`Use o e-mail <b>${escaparHtml(params.email)}</b> no cadastro.`],
    fim: b.texto("Dani", "margin-top:8px;"),
    rodape: "Respondendo este e-mail, você fala com a gente.",
  });
}

/** Na confirmação do e-mail: a conta abriu. */
export function boasVindasEmail(params: { name: string | null; appUrl: string; guiaUrl: string } & ComTema): EmailPronto {
  const b = criarBlocos(params.tema);
  const topo = `${b.texto(oi(params.name), "text-align:center;margin-bottom:6px;")}${b.titulo("Sua conta está pronta", 30, "text-align:center;")}${b.espaco(10)}<div${b.sx({ c: "ink" }, "font-size:16px;line-height:24px;text-align:center;")}>Antes de qualquer gráfico, o SPI Finance precisa de uma coisa só: o seu primeiro gasto.</div>`;
  const fim =
    b.suave("O jeito mais rápido é falar. Toca no <b>+</b> no meio da barra de baixo e diz, por exemplo:", "margin-bottom:14px;") +
    b.caixaDeFala("Toque no + e diga:", "“mercado, duzentos e quarenta reais”") +
    b.espaco(14) +
    b.suave("Pronto, ele entra no mês com a categoria certa. Se preferir fazer o mês inteiro de uma vez, exporta o extrato no app do seu banco e solta lá dentro.", "font-size:14px;line-height:21px;") +
    b.espaco(24) +
    b.botao(params.appUrl, "Lançar meu primeiro gasto", { cheio: true }) +
    b.espaco(14) +
    b.pequeno(`Ficou com dúvida? Tem um guia curtinho de como usar dentro do app: no menu, em ${b.link(params.guiaUrl, "<b>Como funciona</b>")}.`, "text-align:center;");
  const subject = assunto("Seu primeiro minuto no SPI Finance");
  return {
    subject,
    html: b.moldura({
      titulo: escaparHtml(subject),
      preheader: "Uma coisa só: o seu primeiro gasto.",
      cartoes: [b.heroi(topo, true), b.pad(fim, "26px 28px 28px")],
      rodape: "Respondendo este e-mail, você fala com a gente.",
    }),
  };
}

/** 2 dias depois da confirmação, só se não há nenhum lançamento. */
export function vazioDia2Email(params: { name: string | null; appUrl: string } & ComTema): EmailPronto {
  return emailSimples({
    b: criarBlocos(params.tema),
    subject: "Um gasto. Só um.",
    preheader: "Lança só o último gasto que você lembra.",
    saudacao: oi(params.name),
    tituloDoHeroi: "Um gasto. Só um.",
    paragrafos: [
      "Seu SPI Finance ainda está vazio, e tudo bem. Ninguém precisa organizar o mês inteiro hoje.",
      "Lança só o último gasto que você lembra: o café, o mercado, o Uber. Falando ou digitando, leva dez segundos.",
      "É a partir dele que o app começa a te mostrar quanto ainda está livre no mês e o que pede a sua atenção.",
    ],
    botao: { href: params.appUrl, rotulo: "Lançar agora" },
    rodape: "Respondendo este e-mail, você fala com a gente.",
  });
}

/** 5 dias depois da confirmação, só se não há nenhum lançamento. O último. */
export function vazioDia5Email(params: { name: string | null; appUrl: string } & ComTema): EmailPronto {
  const b = criarBlocos(params.tema);
  return emailSimples({
    b,
    subject: "Posso te ajudar a começar?",
    preheader: "Responde este e-mail me contando.",
    saudacao: oi(params.name, "."),
    tituloDoHeroi: "Posso te ajudar a começar?",
    paragrafos: [
      "O seu SPI Finance continua em branco, e eu queria entender por quê. Às vezes é o extrato que não entrou, às vezes é a correria, às vezes a pessoa só não sabe por onde começar.",
      "Se for qualquer uma dessas, responde este e-mail me contando. A gente te ajuda a colocar o seu primeiro mês lá dentro.",
    ],
    botao: { href: params.appUrl, rotulo: "Abrir o SPI Finance" },
    fim: b.texto("Dani", "margin-top:8px;"),
    rodape: "Respondendo este e-mail, você fala com a gente.",
  });
}
