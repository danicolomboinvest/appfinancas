import "server-only";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { SUPORTE_EMAIL } from "@/app/(app)/configuracoes/_ajustes/suporte";
import { compraDoApp } from "@/lib/assinatura/compra";
import { dataLonga, renovacaoEm } from "@/lib/assinatura/renovacao";
import { avisosDeHoje, fimDoReembolso } from "./regras";

/**
 * Os e-mails combinados no "antes de cancelar", uma vez por dia (chamado pelo cron de avisos):
 * o do prazo do reembolso (1 dia antes de acabar) e o de antes da renovação (7 dias antes). Sem
 * SMTP (local), o envio só vai para o log. Marcado como feito só quando o e-mail sai.
 */
export async function enviarAvisosAntesDeCancelar(hoje: Date, dryRun = false): Promise<number> {
  const abertos = await prisma.pedidoAntesDeCancelar.findMany({
    where: { tipo: { in: ["aviso_renovacao", "aviso_reembolso"] }, estado: "aberto", avisarEm: { lte: hoje } },
    select: { id: true, tipo: true, estado: true, avisarEm: true, user: { select: { id: true, email: true, name: true } } },
    take: 500,
  });
  let enviados = 0;
  for (const p of avisosDeHoje(abertos, hoje)) {
    const compra = await compraDoApp(p.user.id, p.user.email);
    if (!compra) continue;
    const nome = p.user.name?.split(" ")[0] ?? "";
    const [assunto, corpo] =
      p.tipo === "aviso_reembolso"
        ? ["Seu prazo de reembolso acaba amanhã", `<p>Oi${nome ? `, ${nome}` : ""}. Como combinado, o seu prazo para pedir o dinheiro de volta vai até ${dataLonga(fimDoReembolso(compra.em))}. Se quiser cancelar, é pela Hubla, com o e-mail da compra.</p><p>Se tiver dúvida, é só responder este e-mail.</p>`]
        : ["Sua assinatura renova em 7 dias", `<p>Oi${nome ? `, ${nome}` : ""}. Como combinado, o SPI Finance renova em ${dataLonga(renovacaoEm(compra.em, hoje))}. Se não quiser renovar, dá para cancelar pela Hubla até lá, e o acesso continua até a data.</p>`];
    if (dryRun) {
      enviados++;
      continue;
    }
    const r = await sendEmail({ to: p.user.email, subject: assunto, html: corpo, replyTo: SUPORTE_EMAIL });
    if (!r.ok) continue;
    await prisma.pedidoAntesDeCancelar.update({ where: { id: p.id }, data: { estado: "feito", feitoEm: new Date(), feitoPor: "aviso automático" } });
    enviados++;
  }
  return enviados;
}
