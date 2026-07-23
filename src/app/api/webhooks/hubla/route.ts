import { NextResponse } from "next/server";
import { grantFromHubla, revokeFromHubla } from "@/lib/repositories/allowedEmail.repo";

/**
 * Webhook do Hubla (webhooks v2): libera/revoga acesso automaticamente conforme a pessoa
 * compra o curso ou a assinatura muda. É o que faz o acesso ser fechado sem trabalho manual.
 *
 * Segurança: o Hubla assina cada chamada com o header `x-hubla-token` — o mesmo token que
 * você cadastra no painel do Hubla e na variável HUBLA_WEBHOOK_TOKEN da Vercel. Sem o token
 * configurado, o endpoint recusa tudo (fail closed) — melhor não liberar do que liberar geral.
 *
 * Eventos tratados (event.type):
 *  - customer.member_added     → libera o e-mail (ganhou acesso ao produto/assinatura)
 *  - invoice.payment_succeeded → libera o e-mail (pagamento aprovado)
 *  - customer.member_removed   → revoga (perdeu acesso: cancelou, expirou)
 *  - invoice.refunded          → revoga (reembolso)
 * Qualquer outro tipo é ignorado com 200, pra o Hubla não ficar reenviando.
 */

const GRANT_EVENTS = new Set(["customer.member_added", "invoice.payment_succeeded"]);
const REVOKE_EVENTS = new Set(["customer.member_removed", "invoice.refunded"]);

/** O e-mail do comprador vem em lugares diferentes conforme o evento (membro vs. fatura). */
function extractEmail(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const e = event as Record<string, unknown>;
  const user = e.user as Record<string, unknown> | undefined;
  const invoice = e.invoice as Record<string, unknown> | undefined;
  const payer = invoice?.payer as Record<string, unknown> | undefined;
  const email = user?.email ?? payer?.email;
  return typeof email === "string" && email.includes("@") ? email : null;
}

export async function POST(request: Request) {
  const expected = process.env.HUBLA_WEBHOOK_TOKEN;
  if (!expected) {
    // Fail closed: sem token configurado não dá pra confiar em ninguém.
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }
  if (request.headers.get("x-hubla-token") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { type?: string; event?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const type = payload.type ?? "";
  const email = extractEmail(payload.event);

  if (!GRANT_EVENTS.has(type) && !REVOKE_EVENTS.has(type)) {
    return NextResponse.json({ ok: true, ignored: type || "unknown" });
  }
  if (!email) {
    // Evento relevante mas sem e-mail: responde 200 pra não gerar reenvio infinito, mas sinaliza.
    return NextResponse.json({ ok: false, reason: "no email in payload", type });
  }

  if (GRANT_EVENTS.has(type)) {
    await grantFromHubla(email, `Hubla: ${type}`);
    return NextResponse.json({ ok: true, action: "granted" });
  }

  await revokeFromHubla(email);
  return NextResponse.json({ ok: true, action: "revoked" });
}
