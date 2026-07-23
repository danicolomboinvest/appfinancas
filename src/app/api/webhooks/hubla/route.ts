import { NextResponse } from "next/server";
import { grantFromHubla, revokeFromHubla } from "@/lib/repositories/allowedEmail.repo";
import { isProductAllowed, recordSeenProduct, type HublaProduct } from "@/lib/repositories/allowedProduct.repo";

/**
 * Webhook do Hubla (webhooks v2): libera/revoga acesso automaticamente conforme a pessoa
 * compra e o produto comprado. É o que faz o acesso ser fechado sem trabalho manual.
 *
 * Segurança: o Hubla assina cada chamada com o header `x-hubla-token` — o mesmo token que
 * você cadastra no painel do Hubla e na variável HUBLA_WEBHOOK_TOKEN da Vercel. Sem o token
 * configurado, o endpoint recusa tudo (fail closed) — melhor não liberar do que liberar geral.
 *
 * Filtro por produto: só libera se o produto comprado estiver na lista de produtos que dão
 * acesso (AllowedProduct ativo). Produto não listado numa compra é registrado como inativo
 * (aparece no painel pra a Dani decidir) e NÃO libera.
 *
 * Eventos tratados (event.type):
 *  - customer.member_added     → libera (ganhou acesso ao produto), se o produto liberar
 *  - invoice.payment_succeeded → libera (pagamento aprovado), se o produto liberar
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

/** O produto comprado pode vir como event.product ou como primeiro item de event.products[]. */
function extractProduct(event: unknown): HublaProduct {
  const asRecord = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : undefined);
  const e = asRecord(event);
  const product = asRecord(e?.product);
  const firstOfArray = Array.isArray(e?.products) ? asRecord(e?.products[0]) : undefined;
  const src = product ?? firstOfArray;
  const id = typeof src?.id === "string" ? src.id : null;
  const name = typeof src?.name === "string" ? src.name : null;
  return { id, name };
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
  const product = extractProduct(payload.event);

  if (!GRANT_EVENTS.has(type) && !REVOKE_EVENTS.has(type)) {
    return NextResponse.json({ ok: true, ignored: type || "unknown" });
  }
  if (!email) {
    // Evento relevante mas sem e-mail: responde 200 pra não gerar reenvio infinito, mas sinaliza.
    return NextResponse.json({ ok: false, reason: "no email in payload", type });
  }

  if (GRANT_EVENTS.has(type)) {
    // Só libera se o produto comprado dá acesso. Produto não listado fica registrado (inativo)
    // pra a Dani decidir depois, e não libera ninguém.
    if (!(await isProductAllowed(product))) {
      await recordSeenProduct(product);
      return NextResponse.json({ ok: true, action: "ignored", reason: "product not allowed", product: product.name });
    }
    await grantFromHubla(email, product.name ? `Hubla: ${product.name}` : `Hubla: ${type}`);
    return NextResponse.json({ ok: true, action: "granted" });
  }

  // Revogação (reembolso / perda de acesso): só corta se o produto que a pessoa perdeu é um dos
  // que dão acesso. Se não dá pra identificar o produto, não revoga — errar a favor do cliente
  // pagante é menos grave do que cortar acesso de quem tem direito (a Dani pode cortar na mão).
  if (product.id || product.name) {
    if (!(await isProductAllowed(product))) {
      return NextResponse.json({ ok: true, action: "ignored", reason: "product not allowed", product: product.name });
    }
  }
  await revokeFromHubla(email);
  return NextResponse.json({ ok: true, action: "revoked" });
}
