import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { grantFromHubla, revokeFromHubla } from "@/lib/repositories/allowedEmail.repo";
import { oQueACompraLibera, recordSeenProduct, type HublaProduct } from "@/lib/repositories/allowedProduct.repo";
import { liberarProdutoDaHubla, MONEY_RESET, revogarProdutoDaHubla } from "@/lib/repositories/produtoLiberado.repo";
import { findUserByEmail } from "@/lib/repositories/user.repo";
import { sendEmail } from "@/lib/email/send";
import { accessGrantedEmail } from "@/lib/email/templates";
import { caminhoDoCadastro } from "@/lib/auth/convite-cadastro";

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
 * Money Reset (05/10/2026): produto da lista marcado "money_reset" libera SÓ o programa de 21
 * dias (ProdutoLiberado), nunca o app. No order bump a compra traz os dois produtos e libera
 * os dois; o reembolso tira os dois.
 *
 * Eventos tratados (event.type):
 *  - customer.member_added     → libera (ganhou acesso ao produto), se o produto liberar
 *  - invoice.payment_succeeded → libera (pagamento aprovado), se o produto liberar
 *
 * Assinatura ANUAL: cada pagamento dá (ou estende) 1 ano de acesso, contado a partir do
 * vencimento atual quando a renovação chega antes de vencer — quem renova adiantado não perde
 * os dias já pagos. A trava de fatura evita que reenvio do mesmo evento vire ano de brinde.
 *  - customer.member_removed   → revoga (perdeu acesso: cancelou, expirou)
 *  - invoice.refunded          → revoga (reembolso)
 * Qualquer outro tipo é ignorado com 200, pra o Hubla não ficar reenviando.
 */

const GRANT_EVENTS = new Set(["customer.member_added", "invoice.payment_succeeded"]);
const REVOKE_EVENTS = new Set(["customer.member_removed", "invoice.refunded"]);

/**
 * Os e-mails do comprador: o da conta Hubla (event.user) e o digitado no checkout
 * (invoice.payer). Quase sempre são o mesmo, mas não sempre: em out/2026 a Tamires pagou com
 * tamireslara@ numa conta Hubla fatinhame@, a liberação e o convite foram só pro fatinhame@, e
 * ela entrou no app pelo próprio e-mail, achou que o app era pago à parte e pediu estorno. Dos
 * 14 casos assim até ali, 3 a Dani liberou na mão. Por isso libera os dois.
 */
function extractEmails(event: unknown): string[] {
  if (!event || typeof event !== "object") return [];
  const e = event as Record<string, unknown>;
  const user = e.user as Record<string, unknown> | undefined;
  const invoice = e.invoice as Record<string, unknown> | undefined;
  const payer = invoice?.payer as Record<string, unknown> | undefined;
  const emails: string[] = [];
  for (const email of [user?.email, payer?.email]) {
    if (typeof email !== "string" || !email.includes("@")) continue;
    if (!emails.some((x) => x.trim().toLowerCase() === email.trim().toLowerCase())) emails.push(email);
  }
  return emails;
}

/** Id da fatura (event.invoice.id) — trava anti-duplicata da renovação: o Hubla manda mais de
 * um evento pra mesma compra, e sem isso cada reenvio esticaria o acesso em mais um ano. */
function extractInvoiceId(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const invoice = (event as Record<string, unknown>).invoice as Record<string, unknown> | undefined;
  const id = invoice?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Celular que a pessoa preencheu na compra (event.user.phone ou invoice.payer.phone). */
function extractPhone(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const e = event as Record<string, unknown>;
  const user = e.user as Record<string, unknown> | undefined;
  const invoice = e.invoice as Record<string, unknown> | undefined;
  const payer = invoice?.payer as Record<string, unknown> | undefined;
  const phone = user?.phone ?? payer?.phone ?? user?.phoneNumber ?? payer?.phoneNumber;
  return typeof phone === "string" ? normalizePhone(phone) : null;
}

/**
 * TODOS os produtos da compra: event.product E cada item de event.products[]. Uma compra pode
 * ter mais de um produto (order bump / combo) — se o curso que dá acesso for o SEGUNDO item,
 * olhar só o primeiro negaria acesso a um comprador legítimo.
 */
function extractProducts(event: unknown): HublaProduct[] {
  const asRecord = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : undefined);
  const e = asRecord(event);
  const sources = [asRecord(e?.product), ...(Array.isArray(e?.products) ? e.products.map(asRecord) : [])];
  const seen = new Set<string>();
  const result: HublaProduct[] = [];
  for (const src of sources) {
    if (!src) continue;
    const id = typeof src.id === "string" ? src.id : null;
    const name = typeof src.name === "string" ? src.name : null;
    if (!id && !name) continue;
    const key = `${id ?? ""}|${(name ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ id, name });
  }
  return result;
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
  const emails = extractEmails(payload.event);
  const products = extractProducts(payload.event);

  if (!GRANT_EVENTS.has(type) && !REVOKE_EVENTS.has(type)) {
    return NextResponse.json({ ok: true, ignored: type || "unknown" });
  }
  if (emails.length === 0) {
    // Evento relevante mas sem e-mail: responde 200 pra não gerar reenvio infinito, mas sinaliza.
    return NextResponse.json({ ok: false, reason: "no email in payload", type });
  }

  if (GRANT_EVENTS.has(type)) {
    // Só libera se ALGUM produto da compra dá acesso (combo/order bump conta). Produto não
    // listado fica registrado (inativo) pra a Dani decidir depois, e não libera ninguém.
    const { app: allowed, moneyReset, foraDaLista } = await oQueACompraLibera(products);
    for (const product of foraDaLista) await recordSeenProduct(product);
    if (moneyReset) for (const email of emails) await liberarProdutoDaHubla(email, MONEY_RESET);
    if (!allowed) {
      return NextResponse.json({
        ok: true,
        action: moneyReset ? "granted_money_reset" : "ignored",
        ...(moneyReset ? {} : { reason: "product not allowed" }),
        products: products.map((p) => p.name ?? p.id),
      });
    }
    const note = allowed.name ? `Hubla: ${allowed.name}` : `Hubla: ${type}`;
    const phone = extractPhone(payload.event);
    const invoiceId = extractInvoiceId(payload.event);
    const liberacoes = [];
    for (const email of emails) liberacoes.push({ email, ...(await grantFromHubla(email, note, phone, invoiceId)) });
    const { expiresAt, extended } = liberacoes[0];

    // Convite por e-mail ("crie sua conta") só na 1ª liberação — o Hubla manda mais de um
    // evento pra mesma compra — e só se a pessoa ainda não tem conta em NENHUM dos e-mails
    // dela. Vai pros dois quando são diferentes: não dá pra saber qual ela lê. Melhor esforço:
    // se o envio falhar, o acesso continua liberado (a pessoa ainda consegue se cadastrar sozinha).
    let emailed = false;
    let temConta = false;
    for (const email of emails) if (await findUserByEmail(email)) temConta = true;
    if (!temConta) {
      const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "financas.danicolombo.com.br";
      const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      for (const { email, isNew } of liberacoes) {
        if (!isNew) continue;
        // O link já leva o e-mail da compra (assinado) pro cadastro: quem digitava outro e-mail
        // ali ficava com a conta sem a compra, vendo cadeado em tudo (ver convite-cadastro.ts).
        const { subject, html } = accessGrantedEmail({ email, registerUrl: `${proto}://${host}${caminhoDoCadastro(email)}` });
        const result = await sendEmail({ to: email, subject, html });
        if (result.ok) emailed = true;
      }
    }
    return NextResponse.json({
      ok: true,
      action: "granted",
      moneyReset: Boolean(moneyReset),
      emailed,
      // `extended: false` = evento irmão/reenvio da mesma fatura, acesso seguiu com o prazo
      // que já tinha (é o comportamento certo, não uma falha).
      extended,
      expiresAt: expiresAt?.toISOString() ?? null,
    });
  }

  // Revogação (reembolso / perda de acesso): só corta se ALGUM produto que a pessoa perdeu é
  // dos que dão acesso. Se não dá pra identificar o produto, não revoga — errar a favor do
  // cliente pagante é menos grave do que cortar acesso de quem tem direito (a Dani pode cortar
  // na mão).
  // Antes a conferência só rodava com produto na lista, e o evento SEM produto caía direto na
  // revogação — o contrário do que está escrito acima.
  if (products.length === 0) {
    return NextResponse.json({ ok: true, action: "ignored", reason: "no product" });
  }
  const { app, moneyReset } = await oQueACompraLibera(products);
  if (!app && !moneyReset) {
    return NextResponse.json({
      ok: true,
      action: "ignored",
      reason: "product not allowed",
      products: products.map((p) => p.name ?? p.id),
    });
  }
  // Só desativa liberação que veio do Hubla: a MANUAL da Dani fica (ver revokeFromHubla).
  if (moneyReset) for (const email of emails) await revogarProdutoDaHubla(email, MONEY_RESET);
  if (!app) return NextResponse.json({ ok: true, action: "revoked_money_reset" });
  for (const email of emails) await revokeFromHubla(email);
  return NextResponse.json({ ok: true, action: "revoked", moneyReset: Boolean(moneyReset) });
}
