import "server-only";
import { headers } from "next/headers";
import { criarTokenDeConfirmacao } from "@/lib/auth/confirmacao-email";
import { LIMITES_CONFIRMACAO, reservarEnvio } from "@/lib/auth/limite-de-envio";
import { sendEmail } from "@/lib/email/send";
import { confirmEmailEmail } from "@/lib/email/templates";

/** Monta a URL absoluta do app a partir do request (funciona em localhost e na Vercel). */
async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type ResultadoDoEnvio = "enviado" | "limite" | "falhou";

/**
 * Manda o "Confirme seu e-mail" com o link assinado. Usado no cadastro e no "Reenviar".
 *
 * Passa pelo limite por conta (1 por minuto, 5 por dia): o "Reenviar" fica na tela de quem
 * ainda não confirmou, e um laço nele gastaria a cota diária do SMTP de todo mundo.
 */
export async function enviarConfirmacaoDeEmail(user: { id: string; email: string; name: string | null }): Promise<ResultadoDoEnvio> {
  if (!(await reservarEnvio(user.id, "confirmar-email", LIMITES_CONFIRMACAO))) return "limite";
  try {
    const token = criarTokenDeConfirmacao(user.id, user.email);
    const confirmUrl = `${await baseUrl()}/confirmar-email?t=${encodeURIComponent(token)}`;
    const { subject, html } = confirmEmailEmail({ name: user.name, confirmUrl });
    const res = await sendEmail({ to: user.email, subject, html });
    return res.ok ? "enviado" : "falhou";
  } catch {
    return "falhou";
  }
}
