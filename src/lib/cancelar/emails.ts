import { assunto, criarBlocos, escaparHtml } from "@/lib/email/blocos";
import type { Resposta } from "./assuntos";

/**
 * Os e-mails do "antes de cancelar", todos na direção B (Aurora) com o tema da pessoa: o herói com
 * o logo do tema, um título curto e um cartão com o texto. Sem emoji e sem travessão. Puros: quem
 * envia escolhe para quem e quando (ver envio.ts).
 */
export type EmailPronto = { subject: string; html: string };

type Base = { tema: string | null; nome: string | null; urlDoApp: string };

function montar(p: Base & { subject: string; preheader: string; titulo: string; paragrafos: string[]; passos?: string[]; botao?: { href: string; rotulo: string }; notas?: string[] }): EmailPronto {
  const b = criarBlocos(p.tema);
  const nome = p.nome?.trim().split(" ")[0];
  const topo = `${b.texto(nome ? `Oi, ${escaparHtml(nome)}!` : "Oi!", "text-align:center;margin-bottom:6px;")}${b.titulo(p.titulo, 28, "text-align:center;")}`;
  const passos = p.passos?.length
    ? b.caixa(p.passos.map((x, i) => b.texto(`<b>${i + 1}.</b> ${x}`, i ? "margin-top:8px;" : "")).join(""))
    : "";
  const corpo =
    p.paragrafos.map((x) => b.texto(x, "margin-bottom:14px;")).join("") +
    (passos ? passos + b.espaco(16) : "") +
    (p.botao ? `${b.botao(p.botao.href, p.botao.rotulo, { cheio: true })}${b.espaco(16)}` : "") +
    (p.notas ?? []).map((n) => b.pequeno(n, "margin-bottom:8px;")).join("");
  const subject = assunto(p.subject);
  return {
    subject,
    html: b.moldura({ titulo: escaparHtml(subject), preheader: escaparHtml(p.preheader), cartoes: [b.heroi(topo) + b.pad(corpo, "28px 28px 24px")], rodape: "Você recebeu este e-mail porque pediu no app SPI Finance." }),
  };
}

/** "Pronto. Seu plano ganhou 2 meses". */
export function emailDosMeses(p: Base & { ate: string }): EmailPronto {
  return montar({ ...p, subject: "Seu plano ganhou 2 meses", preheader: `Agora vale até ${p.ate}.`, titulo: "Seu plano ganhou 2 meses", paragrafos: [`Pronto. Seu SPI Finance agora vale até <b>${p.ate}</b>.`, "Nada muda na sua cobrança: os 2 meses são acesso a mais, por nossa conta."], botao: { href: p.urlDoApp, rotulo: "Abrir o SPI Finance" } });
}

/** A resposta da dúvida, na hora, com o passo a passo e o vídeo. */
export function emailDaDuvida(p: Base & { resposta: Resposta; duvida: string }): EmailPronto {
  const r = p.resposta;
  return montar({
    ...p,
    subject: `Sua dúvida: ${r.titulo.toLowerCase()}`,
    preheader: "O passo a passo e um vídeo curto.",
    titulo: r.titulo,
    paragrafos: [`Você perguntou: <i>${escaparHtml(p.duvida.slice(0, 400))}</i>`, "Aqui vai o passo a passo:"],
    passos: r.passos,
    botao: r.video ? { href: `${p.urlDoApp}${r.video}`, rotulo: `Ver o vídeo: ${r.rotuloDoVideo}` } : { href: `${p.urlDoApp}${r.guia}`, rotulo: "Abrir o guia do app" },
    notas: [`O guia completo: <a href="${p.urlDoApp}${r.guia}" target="_blank">${p.urlDoApp.replace(/^https?:\/\//, "")}${r.guia}</a>`, "Se não resolveu, responda este e-mail."],
  });
}

/** "Algo não está certo": a confirmação, prometendo retorno (não conserto) em 48 horas. */
export function emailDoErrado(p: Base): EmailPronto {
  return montar({ ...p, subject: "Recebemos o seu aviso", preheader: "A gente te responde em até 48 horas.", titulo: "Recebemos", paragrafos: ["Recebemos o que você marcou como errado. A gente te responde em até 48 horas.", "Se quiser mandar mais detalhes ou um print, responda este e-mail."] });
}

/** O "Me avisa" dos 7 dias: sai 1 dia antes de o prazo do reembolso acabar. */
export function emailDoReembolso(p: Base & { ate: string }): EmailPronto {
  return montar({ ...p, subject: "Seu prazo de reembolso acaba amanhã", preheader: `Vai até ${p.ate}.`, titulo: "Seu prazo acaba amanhã", paragrafos: [`Como combinado, o seu prazo para pedir o dinheiro de volta vai até <b>${p.ate}</b>.`, "Se decidir cancelar, é pela Hubla, com o e-mail da compra. Se ficar, não precisa fazer nada."], notas: ["Ficou alguma dúvida? Responda este e-mail."] });
}

/** O aviso de quem escolheu "Não uso mais": 7 dias antes da renovação. */
export function emailDaRenovacao(p: Base & { renova: string }): EmailPronto {
  return montar({ ...p, subject: "Sua assinatura renova em 7 dias", preheader: `Renova em ${p.renova}.`, titulo: "Renova em 7 dias", paragrafos: [`Como combinado, o SPI Finance renova em <b>${p.renova}</b>.`, "Se não quiser renovar, dá para cancelar pela Hubla até lá, e o acesso continua até a data."], botao: { href: p.urlDoApp, rotulo: "Abrir o SPI Finance" } });
}
