/**
 * Envio pela API HTTP da Resend (30/10/2026). Sem pacote: é um POST com fetch nativo em
 * https://api.resend.com/emails, que roda igual na Vercel e no Node.
 *
 * Por que existe: o SMTP da Hostinger (app@danicolombo.com.br) aceita 100 envios por dia e o app
 * já estourou esse teto, com 73 devoluções em 30 dias. A Resend (plano Pro, 50 mil por mês) manda
 * pelo domínio `acesso.danicolombo.com.br`, que já está verificado lá (o Rota usa). O domínio
 * `danicolombo.com.br` NÃO está verificado na Resend, por isso o remetente padrão é
 * `spi@acesso.danicolombo.com.br` e a resposta volta para o app@ (reply_to).
 *
 * A chave (RESEND_API_KEY) vem SEMPRE do ambiente, nunca do código nem do Git.
 */

export const RESEND_URL = "https://api.resend.com/emails";
export const FROM_PADRAO = "SPI Finance <spi@acesso.danicolombo.com.br>";
export const REPLY_TO_PADRAO = "app@danicolombo.com.br";

export type ParamsDaResend = { to: string; subject: string; html: string; text?: string; replyTo?: string };
export type ResultadoDaResend = { ok: true; id: string | null } | { ok: false; motivo: string };

/** O remetente dos e-mails pela Resend (EMAIL_FROM no ambiente, senão o padrão). */
export function remetenteDaResend(env: NodeJS.ProcessEnv = process.env): string {
  return env.EMAIL_FROM?.trim() || FROM_PADRAO;
}

/** Para onde vai a resposta quando o e-mail não pede outro endereço (EMAIL_REPLY_TO, senão app@). */
export function respostaPadraoDaResend(env: NodeJS.ProcessEnv = process.env): string {
  return env.EMAIL_REPLY_TO?.trim() || REPLY_TO_PADRAO;
}

/** A chave está no ambiente? (sem expor o valor) */
export function resendConfigurada(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim());
}

/** O corpo que vai para a API, montado à parte para o teste conferir sem rede. */
export function corpoParaResend(params: ParamsDaResend, env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  return {
    from: remetenteDaResend(env),
    to: [params.to],
    subject: params.subject,
    html: params.html,
    ...(params.text ? { text: params.text } : {}),
    reply_to: params.replyTo ?? respostaPadraoDaResend(env),
  };
}

/**
 * Manda um e-mail pela Resend. Nunca lança: devolve `ok: false` com o motivo (HTTP, rede, chave
 * ausente) para o chamador decidir se tenta o SMTP. `fetchFn` existe para o teste.
 */
export async function enviarPelaResend(
  params: ParamsDaResend,
  opts: { fetchFn?: typeof fetch; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<ResultadoDaResend> {
  const env = opts.env ?? process.env;
  const chave = env.RESEND_API_KEY?.trim();
  if (!chave) return { ok: false, motivo: "RESEND_API_KEY ausente" };
  const fetchFn = opts.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetchFn(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpoParaResend(params, env)),
      signal: controller.signal,
    });
    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      return { ok: false, motivo: `HTTP ${res.status}${texto ? `: ${resumir(texto)}` : ""}` };
    }
    const json = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: json?.id ?? null };
  } catch (err) {
    const msg = err instanceof Error ? (err.name === "AbortError" ? "tempo esgotado" : err.message) : String(err);
    return { ok: false, motivo: resumir(msg) };
  } finally {
    clearTimeout(timer);
  }
}

/** Uma linha curta para o AppError: sem a chave, sem o corpo, no máximo 200 caracteres. */
function resumir(texto: string): string {
  return texto.replace(/\s+/g, " ").replace(/re_[A-Za-z0-9_]+/g, "re_•••").trim().slice(0, 200);
}
