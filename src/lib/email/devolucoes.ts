import { prisma } from "@/lib/db/prisma";
import { mascararEmail, normalizeEmail } from "@/lib/repositories/allowedEmail.repo";
import { registrarAvisoDaRota } from "@/lib/erros/registrar-falha";

/**
 * E-mail devolvido ou marcado como spam, avisado pela Resend (30/10/2026). Sem migration: quem
 * tem conta ganha um registro `Decisao` tipo `email_devolvido` (a Jornada mostra na linha do
 * tempo); todo caso vai também para o AppError (rota "e-mail"), com o e-mail mascarado, para
 * quem ainda não criou a conta não sumir sem rastro.
 */

export const TIPO_EMAIL_DEVOLVIDO = "email_devolvido";

export type Devolucao = {
  /** "bounced" | "complained" */
  evento: "bounced" | "complained";
  email: string;
  /** Id do e-mail na Resend, a trava contra o mesmo aviso reenviado. */
  emailId: string | null;
  assunto: string | null;
  /** O que a Resend disse (o motivo da devolução), já curto. */
  motivo: string | null;
  quando: Date;
};

export type EventoDaResend = { type?: string; created_at?: string; data?: { email_id?: string; to?: string | string[]; subject?: string; bounce?: { message?: string; type?: string; subType?: string } } };

/** Lê o evento da Resend; `null` quando não é devolução nem reclamação, ou não tem destinatário. */
export function lerDevolucao(evento: EventoDaResend, agora: Date = new Date()): Devolucao | null {
  const tipo = evento.type === "email.bounced" ? "bounced" : evento.type === "email.complained" ? "complained" : null;
  if (!tipo) return null;
  const para = Array.isArray(evento.data?.to) ? evento.data?.to[0] : evento.data?.to;
  if (!para || typeof para !== "string" || !para.includes("@")) return null;
  const b = evento.data?.bounce;
  const motivo = [b?.type, b?.subType, b?.message].filter((x): x is string => typeof x === "string" && x.trim().length > 0).join(" · ");
  const criadoEm = evento.created_at ? new Date(evento.created_at) : agora;
  return {
    evento: tipo,
    email: normalizeEmail(para),
    emailId: typeof evento.data?.email_id === "string" ? evento.data.email_id : null,
    assunto: typeof evento.data?.subject === "string" ? evento.data.subject.slice(0, 200) : null,
    motivo: motivo ? motivo.slice(0, 300) : null,
    quando: Number.isNaN(criadoEm.getTime()) ? agora : criadoEm,
  };
}

export function rotuloDaDevolucao(evento: Devolucao["evento"]): string {
  return evento === "complained" ? "Marcou o e-mail como spam" : "E-mail devolvido";
}

/** Grava a devolução. Devolve onde gravou. Nunca lança. */
export async function registrarDevolucao(d: Devolucao): Promise<"conta" | "sem-conta"> {
  await registrarAvisoDaRota("e-mail", `${rotuloDaDevolucao(d.evento)}: ${mascararEmail(d.email)}${d.motivo ? ` (${d.motivo.slice(0, 120)})` : ""}`);
  try {
    const user = await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } });
    if (!user) return "sem-conta";
    if (d.emailId) {
      const repetido = await prisma.decisao.findFirst({ where: { userId: user.id, tipo: TIPO_EMAIL_DEVOLVIDO, chave: d.emailId }, select: { id: true } });
      if (repetido) return "conta";
    }
    await prisma.decisao.create({
      data: {
        userId: user.id,
        tipo: TIPO_EMAIL_DEVOLVIDO,
        chave: d.emailId,
        descricao: rotuloDaDevolucao(d.evento),
        dados: { evento: d.evento, assunto: d.assunto, motivo: d.motivo },
        createdAt: d.quando,
      },
    });
    return "conta";
  } catch (e) {
    console.error("[email] não gravou a devolução:", e);
    return "sem-conta";
  }
}
