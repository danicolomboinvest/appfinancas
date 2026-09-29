import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envio de e-mail via SMTP (Hostinger). As credenciais vêm SEMPRE do ambiente, nunca ficam
 * no código nem vão pro Git. Configure no .env (local) e nas Environment Variables da Vercel:
 *   SMTP_HOST=smtp.hostinger.com
 *   SMTP_PORT=465
 *   SMTP_USER=app@danicolombo.com.br
 *   SMTP_PASSWORD=•••••  (só você conhece)
 */

const FROM_NAME = "SPI Finance";

let cached: Transporter | null = null;

function createTransport(pool: boolean): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  // Sem credenciais configuradas, não quebra o app, só não envia (útil em dev/preview).
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 465);
  const base = {
    host,
    port,
    secure: port === 465, // 465 = SSL direto; 587 = STARTTLS
    auth: { user, pass },
  };
  // Uma conexão só, reaproveitada: o Hostinger limita conexões simultâneas por conta.
  return pool ? nodemailer.createTransport({ ...base, pool: true, maxConnections: 1, maxMessages: 100 }) : nodemailer.createTransport(base);
}

function getTransporter(): Transporter | null {
  if (cached) return cached;
  cached = createTransport(false);
  return cached;
}

export type SendEmailResult = { ok: true } | { ok: false; reason: "not-configured" | "error" };
type EmailParams = { to: string; subject: string; html: string };

/** Envia um e-mail HTML. Nunca lança, devolve um resultado pro chamador decidir o que fazer. */
export async function sendEmail(params: EmailParams): Promise<SendEmailResult> {
  return enviarCom(getTransporter(), params);
}

/**
 * Pra envio em massa (o resumo do dia 1º): uma conexão SMTP aberta e reaproveitada em todos os
 * e-mails, fechada no fim com `fechar()`.
 *
 * Sem isso cada e-mail abria conexão nova com TLS e login no Hostinger (1 a 2 segundos), e o
 * cron estourava o teto de tempo depois de algumas dezenas de envios. Fica separado do
 * sendEmail de propósito: uma conexão parada entre uma função e outra da Vercel morre calada, e
 * o e-mail de "esqueci minha senha" não pode depender dela.
 */
export function abrirEnvioEmLote(): { enviar: (params: EmailParams) => Promise<SendEmailResult>; fechar: () => void } {
  const transporter = createTransport(true);
  return {
    enviar: (params) => enviarCom(transporter, params),
    fechar: () => transporter?.close(),
  };
}

async function enviarCom(transporter: Transporter | null, params: EmailParams): Promise<SendEmailResult> {
  if (!transporter) {
    console.warn("[email] SMTP não configurado, e-mail não enviado:", params.subject);
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

/** Verifica se o SMTP está configurado (sem expor valores), usado em diagnósticos. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}
