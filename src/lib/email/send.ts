import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envio de e-mail via SMTP (Hostinger). As credenciais vêm SEMPRE do ambiente — nunca ficam
 * no código nem vão pro Git. Configure no .env (local) e nas Environment Variables da Vercel:
 *   SMTP_HOST=smtp.hostinger.com
 *   SMTP_PORT=465
 *   SMTP_USER=app@danicolombo.com.br
 *   SMTP_PASSWORD=•••••  (só você conhece)
 */

const FROM_NAME = "SPI Finance";

let cached: Transporter | null = null;

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  // Sem credenciais configuradas, não quebra o app — só não envia (útil em dev/preview).
  if (!host || !user || !pass) return null;
  if (cached) return cached;

  const port = Number(process.env.SMTP_PORT ?? 465);
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL direto; 587 = STARTTLS
    auth: { user, pass },
  });
  return cached;
}

export type SendEmailResult = { ok: true } | { ok: false; reason: "not-configured" | "error" };

/** Envia um e-mail HTML. Nunca lança — devolve um resultado pro chamador decidir o que fazer. */
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<SendEmailResult> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[email] SMTP não configurado — e-mail não enviado:", params.subject);
    return { ok: false, reason: "not-configured" };
  }
  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] falha ao enviar:", err);
    return { ok: false, reason: "error" };
  }
}

/** Verifica se o SMTP está configurado (sem expor valores) — usado em diagnósticos. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}
