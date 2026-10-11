import "server-only";
import { prisma } from "@/lib/db/prisma";
import { compraDoApp } from "@/lib/assinatura/compra";
import { dataLonga, renovacaoEm } from "@/lib/assinatura/renovacao";
import { avisosDeHoje, fimDoReembolso, lembretesDeEstender } from "./regras";
import { emailDaRenovacao, emailDoReembolso, emailEstenderNaHubla } from "./emails";
import { sendEmail } from "@/lib/email/send";
import { SUPORTE_EMAIL } from "@/app/(app)/configuracoes/_ajustes/suporte";
import { destinatario, enviarDoPedido, URL_DO_APP } from "./envio";

/**
 * Os e-mails combinados no "antes de cancelar", uma vez por dia pelo cron de avisos: o do prazo
 * do reembolso (1 dia antes de acabar) e o de antes da renovação (7 dias antes). Uma vez só, no
 * dia certo, para a pessoa certa, e nunca para quem cancelou ou pediu reembolso.
 */
export async function enviarAvisosAntesDeCancelar(hoje: Date, dryRun = false): Promise<number> {
  const abertos = await prisma.pedidoAntesDeCancelar.findMany({
    where: { tipo: { in: ["aviso_renovacao", "aviso_reembolso"] }, estado: "aberto", emailEnviadoEm: null, avisarEm: { lte: hoje } },
    select: { id: true, tipo: true, estado: true, avisarEm: true, emailEnviadoEm: true, userId: true },
    take: 500,
  });
  let enviados = 0;
  for (const p of avisosDeHoje(abertos, hoje)) {
    const para = await destinatario(p.userId);
    const compra = para ? await compraDoApp(p.userId, para.email) : null;
    if (!para || !compra) continue;
    const base = { tema: para.tema, nome: para.nome, urlDoApp: URL_DO_APP };
    const email = p.tipo === "aviso_reembolso" ? emailDoReembolso({ ...base, ate: dataLonga(fimDoReembolso(compra.em)) }) : emailDaRenovacao({ ...base, renova: dataLonga(renovacaoEm(compra.em, hoje)) });
    if (dryRun) {
      enviados++;
      continue;
    }
    if (await enviarDoPedido(p.id, para, email)) {
      await prisma.pedidoAntesDeCancelar.update({ where: { id: p.id }, data: { estado: "feito", feitoEm: new Date(), feitoPor: "aviso automático" } });
      enviados++;
    }
  }
  return enviados;
}

/** Os 2 meses grátis sem "Feito na Hubla" há 24 horas: um lembrete para a Dani, uma vez só. */
export async function lembrarEstenderNaHubla(agora: Date = new Date(), dryRun = false): Promise<number> {
  const abertos = await prisma.pedidoAntesDeCancelar.findMany({
    where: { tipo: "meses_gratis", estado: "aberto", lembreteEm: null },
    select: { id: true, tipo: true, estado: true, createdAt: true, lembreteEm: true, dados: true, user: { select: { name: true, email: true } } },
    take: 200,
  });
  let n = 0;
  for (const p of lembretesDeEstender(abertos, agora)) {
    if (dryRun) {
      n++;
      continue;
    }
    const marcado = await prisma.pedidoAntesDeCancelar.updateMany({ where: { id: p.id, lembreteEm: null }, data: { lembreteEm: agora } });
    if (marcado.count === 0) continue;
    const link = (p.dados as { link?: string } | null)?.link ?? "";
    const e = emailEstenderNaHubla({ nome: p.user.name, email: p.user.email, link, lembrete: true });
    await sendEmail({ to: SUPORTE_EMAIL, subject: e.subject, html: e.html });
    n++;
  }
  return n;
}
