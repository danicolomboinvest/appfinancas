import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { enviarPelaResend, resendConfigurada } from "@/lib/email/resend";

/**
 * Envio de e-mail do app. Dois caminhos (30/10/2026):
 *
 *  1. Resend (API HTTP), quando RESEND_API_KEY está no ambiente. Remetente
 *     `SPI Finance <spi@acesso.danicolombo.com.br>` (EMAIL_FROM), resposta para app@ (EMAIL_REPLY_TO).
 *  2. SMTP da Hostinger (app@danicolombo.com.br), exatamente como antes, quando a chave da Resend
 *     não existe. Também é a RESERVA: se a Resend falhar, o e-mail tenta o SMTP uma vez e a falha
 *     fica registrada no AppError (rota "e-mail").
 *
 * Por quê: o SMTP aceita 100 envios por dia e o app estourou o teto (73 devoluções em 30 dias).
 *
 * As credenciais vêm SEMPRE do ambiente, nunca ficam no código nem vão pro Git. Configure no
 * .env (local) e nas Environment Variables da Vercel:
 *   RESEND_API_KEY=•••••  (só ela conhece)
 *   SMTP_HOST=smtp.hostinger.com
 *   SMTP_PORT=465
 *   SMTP_USER=app@danicolombo.com.br
 *   SMTP_PASSWORD=•••••  (só ela conhece)
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

/** Por onde o e-mail saiu: `smtp-reserva` = a Resend falhou e o SMTP salvou. */
export type CaminhoDoEmail = "resend" | "smtp" | "smtp-reserva";
export type SendEmailResult = { ok: true; via: CaminhoDoEmail } | { ok: false; reason: "not-configured" | "error" };
/** `replyTo`: pra onde vai a resposta. Os e-mails que pedem "responde aqui" mandam pra caixa de
 * suporte (contato@), que alguém lê; o remetente do app (app@) ninguém olha. Pela Resend, sem
 * `replyTo`, a resposta vai para EMAIL_REPLY_TO (app@). `text` é opcional: versão sem HTML. */
export type EmailParams = { to: string; subject: string; html: string; text?: string; replyTo?: string };

/** Envia um e-mail HTML. Nunca lança, devolve um resultado pro chamador decidir o que fazer. */
export async function sendEmail(params: EmailParams): Promise<SendEmailResult> {
  return enviar(params, () => getTransporter());
}

/**
 * Pra envio em massa (o resumo do dia 1º): uma conexão SMTP aberta e reaproveitada em todos os
 * e-mails, fechada no fim com `fechar()`.
 *
 * Sem isso cada e-mail abria conexão nova com TLS e login no Hostinger (1 a 2 segundos), e o
 * cron estourava o teto de tempo depois de algumas dezenas de envios. Fica separado do
 * sendEmail de propósito: uma conexão parada entre uma função e outra da Vercel morre calada, e
 * o e-mail de "esqueci minha senha" não pode depender dela.
 *
 * Com a Resend no ar, o lote vai pela API (sem conexão para manter) e a conexão SMTP só abre se
 * precisar de reserva.
 */
export function abrirEnvioEmLote(): { enviar: (params: EmailParams) => Promise<SendEmailResult>; fechar: () => void } {
  let transporter: Transporter | null | undefined;
  const abrir = () => {
    if (transporter === undefined) transporter = createTransport(true);
    return transporter;
  };
  return {
    enviar: (params) => enviar(params, abrir),
    fechar: () => transporter?.close(),
  };
}

/** Resend primeiro (se tem chave); SMTP como caminho normal sem chave e como reserva com ela. */
async function enviar(params: EmailParams, smtp: () => Transporter | null): Promise<SendEmailResult> {
  if (!resendConfigurada()) return enviarPeloSmtp(smtp(), params, "smtp");

  const r = await enviarPelaResend(params);
  if (r.ok) return { ok: true, via: "resend" };

  console.error("[email] Resend falhou, tentando o SMTP:", r.motivo);
  const reserva = await enviarPeloSmtp(smtp(), params, "smtp-reserva");
  await registrarFalhaDaResend(r.motivo, reserva.ok);
  return reserva;
}

async function enviarPeloSmtp(transporter: Transporter | null, params: EmailParams, via: CaminhoDoEmail): Promise<SendEmailResult> {
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
      ...(params.text ? { text: params.text } : {}),
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    });
    return { ok: true, via };
  } catch (err) {
    console.error("[email] falha ao enviar:", err);
    return { ok: false, reason: "error" };
  }
}

/**
 * A falha da Resend fica no AppError (rota "e-mail"), agrupada pelo motivo, para a Dani ver no
 * admin que a reserva entrou em ação. Import tardio para não puxar o banco em quem só importa
 * este módulo (os testes trocam o prisma). Nunca lança.
 */
async function registrarFalhaDaResend(motivo: string, smtpSalvou: boolean): Promise<void> {
  try {
    const { registrarAvisoDaRota } = await import("@/lib/erros/registrar-falha");
    await registrarAvisoDaRota("e-mail", `Resend falhou (${motivo}); ${smtpSalvou ? "o SMTP mandou" : "o SMTP também falhou"}`);
  } catch {
    // o e-mail em si já foi tratado
  }
}

/** Verifica se algum caminho de envio está configurado (sem expor valores), usado em diagnósticos. */
export function isEmailConfigured(): boolean {
  return resendConfigurada() || Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}
