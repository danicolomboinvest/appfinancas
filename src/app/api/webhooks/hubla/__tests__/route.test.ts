import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Webhook da Hubla, ponta a ponta, com o banco trocado por uma lista em memória.
 *
 * É o único caminho entre "a cliente pagou" e "a área paga abre" (e entre "reembolsou" e "a
 * área fecha"), e até aqui só as contas de prazo (decidirPrazoHubla) tinham teste. O que está
 * protegido aqui: token, filtro por produto (inclusive combo e nome sem acento), onde o
 * e-mail/celular/fatura vêm no payload, convite só na primeira liberação, e a revogação que
 * NÃO corta quando não dá pra saber o produto.
 *
 * O filtro de produto (allowedProduct.repo) roda de verdade contra a lista em memória; o que
 * grava a liberação (allowedEmail.repo) é espião, porque as contas dele já têm teste próprio.
 */

type Produto = { id: string; hublaProductId: string | null; name: string; active: boolean; source: string };
const produtos: Produto[] = [];

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    allowedProduct: {
      findMany: vi.fn(async ({ where }: { where?: { active?: boolean } } = {}) =>
        produtos.filter((p) => where?.active === undefined || p.active === where.active),
      ),
      findFirst: vi.fn(async ({ where }: { where: { OR: Array<{ hublaProductId?: string; name?: { equals: string } }> } }) =>
        produtos.find((p) =>
          where.OR.some(
            (c) =>
              (c.hublaProductId !== undefined && p.hublaProductId === c.hublaProductId) ||
              (c.name !== undefined && p.name.toLowerCase() === c.name.equals.toLowerCase()),
          ),
        ) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Omit<Produto, "id"> }) => {
        const novo = { id: `p${produtos.length + 1}`, ...data };
        produtos.push(novo);
        return novo;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Produto> }) => {
        const p = produtos.find((x) => x.id === where.id)!;
        Object.assign(p, data);
        return p;
      }),
    },
  },
}));

const grantFromHubla = vi.fn();
const revokeFromHubla = vi.fn();
vi.mock("@/lib/repositories/allowedEmail.repo", () => ({
  grantFromHubla: (...a: unknown[]) => grantFromHubla(...a),
  revokeFromHubla: (...a: unknown[]) => revokeFromHubla(...a),
}));

const findUserByEmail = vi.fn();
vi.mock("@/lib/repositories/user.repo", () => ({ findUserByEmail: (e: string) => findUserByEmail(e) }));

const sendEmail = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendEmail: (m: unknown) => sendEmail(m) }));

const { POST } = await import("../route");

const TOKEN = "token-de-teste";
const CURSO = { id: "prod-curso", name: "Do zero à liberdade financeira" };

function chamar(corpo: unknown, headers: Record<string, string> = { "x-hubla-token": TOKEN }) {
  return POST(
    new Request("https://financas.exemplo.test/api/webhooks/hubla", {
      method: "POST",
      headers: { "content-type": "application/json", host: "financas.exemplo.test", ...headers },
      body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    }),
  );
}

function compra(type: string, event: Record<string, unknown>) {
  return { type, event };
}

beforeEach(() => {
  process.env.HUBLA_WEBHOOK_TOKEN = TOKEN;
  produtos.length = 0;
  produtos.push({ id: "p0", hublaProductId: null, name: "Do Zero à Liberdade Financeira", active: true, source: "MANUAL" });
  grantFromHubla.mockReset().mockResolvedValue({ isNew: true, expiresAt: new Date("2027-09-30T12:00:00Z"), extended: true });
  revokeFromHubla.mockReset().mockResolvedValue({ count: 1 });
  findUserByEmail.mockReset().mockResolvedValue(null);
  sendEmail.mockReset().mockResolvedValue({ ok: true });
});

describe("webhook Hubla: quem pode chamar", () => {
  it("sem HUBLA_WEBHOOK_TOKEN configurado recusa tudo (503), mesmo com header", async () => {
    delete process.env.HUBLA_WEBHOOK_TOKEN;
    const r = await chamar(compra("invoice.payment_succeeded", { user: { email: "a@x.com" }, product: CURSO }));
    expect(r.status).toBe(503);
    expect(grantFromHubla).not.toHaveBeenCalled();
  });

  it("token errado ou ausente: 401 e não libera ninguém", async () => {
    const semToken = await chamar(compra("invoice.payment_succeeded", { user: { email: "a@x.com" }, product: CURSO }), {});
    const errado = await chamar(compra("invoice.payment_succeeded", { user: { email: "a@x.com" }, product: CURSO }), { "x-hubla-token": "chute" });
    expect(semToken.status).toBe(401);
    expect(errado.status).toBe(401);
    expect(grantFromHubla).not.toHaveBeenCalled();
    expect(revokeFromHubla).not.toHaveBeenCalled();
  });

  it("corpo que não é JSON: 400", async () => {
    const r = await chamar("isto não é json");
    expect(r.status).toBe(400);
  });
});

describe("webhook Hubla: liberação", () => {
  it("pagamento aprovado do curso libera, com fatura e celular normalizado, e convida quem não tem conta", async () => {
    const r = await chamar(
      compra("invoice.payment_succeeded", {
        invoice: { id: "fat-1", payer: { email: "compradora@x.com", phone: "(11) 98765-4321" } },
        product: { id: "prod-curso", name: "Do zero a liberdade financeira" },
      }),
    );
    const corpo = await r.json();
    expect(r.status).toBe(200);
    expect(corpo).toMatchObject({ ok: true, action: "granted", emailed: true, extended: true });
    expect(grantFromHubla).toHaveBeenCalledWith("compradora@x.com", "Hubla: Do zero a liberdade financeira", "5511987654321", "fat-1");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0][0] as { to: string; html: string };
    expect(email.to).toBe("compradora@x.com");
    expect(email.html).toContain("https://financas.exemplo.test/register");
  });

  it("o link do convite leva o e-mail da compra assinado, pra o cadastro já abrir com ele", async () => {
    const antes = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "segredo-de-teste";
    try {
      await chamar(compra("invoice.payment_succeeded", { user: { email: "Compradora@X.com" }, product: CURSO }));
      const { html } = sendEmail.mock.calls[0][0] as { html: string };
      const token = /\/register\?convite=([A-Za-z0-9_.%-]+)/.exec(html)?.[1];
      expect(token).toBeTruthy();
      const { lerTokenDeConvite } = await import("@/lib/auth/convite-cadastro");
      expect(lerTokenDeConvite(decodeURIComponent(token!))).toBe("compradora@x.com");
    } finally {
      if (antes === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = antes;
    }
  });

  it("combo: o curso como SEGUNDO produto ainda libera", async () => {
    const r = await chamar(
      compra("invoice.payment_succeeded", {
        user: { email: "b@x.com" },
        product: { id: "prod-ebook", name: "E-book de receitas" },
        products: [{ id: "prod-ebook", name: "E-book de receitas" }, { id: "outro-id", name: "DO ZERO À LIBERDADE FINANCEIRA" }],
      }),
    );
    expect((await r.json()).action).toBe("granted");
    expect(grantFromHubla).toHaveBeenCalledTimes(1);
  });

  it("produto fora da lista não libera e fica registrado DESLIGADO pra a Dani decidir", async () => {
    const r = await chamar(compra("customer.member_added", { user: { email: "c@x.com" }, product: { id: "prod-mentoria", name: "Mentoria" } }));
    const corpo = await r.json();
    expect(corpo).toMatchObject({ ok: true, action: "ignored", reason: "product not allowed" });
    expect(grantFromHubla).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(produtos.find((p) => p.hublaProductId === "prod-mentoria")).toMatchObject({ active: false, source: "HUBLA" });
  });

  it("produto desligado no painel não libera, mesmo com o nome certo", async () => {
    produtos[0].active = false;
    const r = await chamar(compra("invoice.payment_succeeded", { user: { email: "d@x.com" }, product: CURSO }));
    expect((await r.json()).action).toBe("ignored");
    expect(grantFromHubla).not.toHaveBeenCalled();
  });

  it("evento irmão da mesma compra (não é nova) não manda o convite de novo", async () => {
    grantFromHubla.mockResolvedValue({ isNew: false, expiresAt: new Date("2027-09-30T12:00:00Z"), extended: false });
    const r = await chamar(compra("customer.member_added", { user: { email: "e@x.com" }, product: CURSO }));
    expect(await r.json()).toMatchObject({ action: "granted", emailed: false, extended: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("quem já tem conta não recebe 'crie sua conta'", async () => {
    findUserByEmail.mockResolvedValue({ id: "u1", email: "f@x.com" });
    await chamar(compra("invoice.payment_succeeded", { user: { email: "f@x.com" }, product: CURSO }));
    expect(grantFromHubla).toHaveBeenCalledTimes(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("falha no envio do convite não desfaz a liberação", async () => {
    sendEmail.mockResolvedValue({ ok: false });
    const r = await chamar(compra("invoice.payment_succeeded", { user: { email: "g@x.com" }, product: CURSO }));
    expect(await r.json()).toMatchObject({ ok: true, action: "granted", emailed: false });
  });

  it("evento relevante sem e-mail responde 200 (sem reenvio infinito) e não libera", async () => {
    const r = await chamar(compra("invoice.payment_succeeded", { user: { email: "sem-arroba" }, product: CURSO }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: false, reason: "no email in payload" });
    expect(grantFromHubla).not.toHaveBeenCalled();
  });

  it("celular estrangeiro não é gravado como brasileiro", async () => {
    await chamar(compra("invoice.payment_succeeded", { user: { email: "h@x.com", phone: "+1 647 919 5010" }, product: CURSO }));
    expect(grantFromHubla.mock.calls[0][2]).toBeNull();
  });
});

describe("webhook Hubla: reembolso e cancelamento", () => {
  it("reembolso do curso revoga", async () => {
    const r = await chamar(compra("invoice.refunded", { invoice: { id: "fat-1", payer: { email: "i@x.com" } }, product: CURSO }));
    expect(await r.json()).toMatchObject({ ok: true, action: "revoked" });
    expect(revokeFromHubla).toHaveBeenCalledWith("i@x.com");
  });

  it("member_removed do curso revoga", async () => {
    await chamar(compra("customer.member_removed", { user: { email: "j@x.com" }, product: CURSO }));
    expect(revokeFromHubla).toHaveBeenCalledWith("j@x.com");
  });

  it("reembolso SEM produto no payload não corta (erra a favor de quem pagou)", async () => {
    const r = await chamar(compra("invoice.refunded", { invoice: { id: "fat-1", payer: { email: "k@x.com" } } }));
    expect(await r.json()).toMatchObject({ action: "ignored", reason: "no product" });
    expect(revokeFromHubla).not.toHaveBeenCalled();
  });

  it("reembolso de OUTRO produto (o e-book) não leva o acesso do curso junto", async () => {
    const r = await chamar(compra("invoice.refunded", { user: { email: "l@x.com" }, product: { id: "prod-ebook", name: "E-book de receitas" } }));
    expect(await r.json()).toMatchObject({ action: "ignored", reason: "product not allowed" });
    expect(revokeFromHubla).not.toHaveBeenCalled();
  });

  it("revogação nunca manda e-mail nem cria produto novo", async () => {
    await chamar(compra("invoice.refunded", { user: { email: "m@x.com" }, product: { id: "prod-x", name: "Produto X" } }));
    expect(sendEmail).not.toHaveBeenCalled();
    expect(produtos).toHaveLength(1);
  });
});

describe("webhook Hubla: eventos que não interessam", () => {
  it("tipo desconhecido responde 200 e não mexe em nada", async () => {
    const r = await chamar(compra("subscription.renewal_reminder", { user: { email: "n@x.com" }, product: CURSO }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, ignored: "subscription.renewal_reminder" });
    expect(grantFromHubla).not.toHaveBeenCalled();
    expect(revokeFromHubla).not.toHaveBeenCalled();
  });

  it("payload sem type também é ignorado com 200", async () => {
    const r = await chamar({ event: { user: { email: "o@x.com" } } });
    expect(await r.json()).toMatchObject({ ok: true, ignored: "unknown" });
  });
});
