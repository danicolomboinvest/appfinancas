import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assinarSvix, conferirAssinaturaSvix } from "@/lib/email/svix";

/**
 * Webhook da Resend (30/10/2026): 503 sem o segredo (e nada gravado), 401 com assinatura errada
 * ou velha, e os eventos de devolução/spam gravados no AppError (e-mail mascarado) e, para quem
 * tem conta, num Decisao `email_devolvido`, sem repetir o mesmo aviso. Banco em memória.
 */

const SEGREDO = `whsec_${Buffer.from("segredo-de-teste-com-32-bytes!!!").toString("base64")}`;

type Usuario = { id: string; email: string };
const usuarios: Usuario[] = [];
const decisoes: { userId: string; tipo: string; chave: string | null; descricao: string | null; dados: unknown; createdAt: Date }[] = [];
const avisos: { routePath: string; message: string }[] = [];

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appError: { upsert: vi.fn(async ({ create }: { create: { routePath: string; message: string } }) => void avisos.push(create)) },
    user: { findUnique: vi.fn(async ({ where }: { where: { email: string } }) => usuarios.find((u) => u.email === where.email) ?? null) },
    decisao: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string; tipo: string; chave: string } }) => decisoes.find((d) => d.userId === where.userId && d.tipo === where.tipo && d.chave === where.chave) ?? null),
      create: vi.fn(async ({ data }: { data: (typeof decisoes)[number] }) => void decisoes.push(data)),
    },
  },
}));

const guardado = process.env.RESEND_WEBHOOK_SECRET;

beforeEach(() => {
  usuarios.length = 0;
  decisoes.length = 0;
  avisos.length = 0;
  process.env.RESEND_WEBHOOK_SECRET = SEGREDO;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  if (guardado === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
  else process.env.RESEND_WEBHOOK_SECRET = guardado;
});

function chamada(corpo: unknown, opts: { segredo?: string; assinatura?: string; timestamp?: string } = {}): Request {
  const texto = JSON.stringify(corpo);
  const id = "msg_teste";
  const timestamp = opts.timestamp ?? String(Math.floor(Date.now() / 1000));
  const assinatura = opts.assinatura ?? assinarSvix(opts.segredo ?? SEGREDO, id, timestamp, texto);
  return new Request("https://financas.exemplo.test/api/webhooks/resend", {
    method: "POST",
    headers: { "Content-Type": "application/json", "svix-id": id, "svix-timestamp": timestamp, "svix-signature": assinatura },
    body: texto,
  });
}

const devolvido = (email: string, emailId = "e1") => ({
  type: "email.bounced",
  created_at: "2026-10-30T12:00:00.000Z",
  data: { email_id: emailId, to: [email], subject: "Seu acesso ao SPI Finance", bounce: { type: "Permanent", subType: "General", message: "mailbox does not exist" } },
});

async function post(req: Request) {
  const { POST } = await import("../route");
  return POST(req);
}

describe("POST /api/webhooks/resend", () => {
  it("responde 503 e não grava nada quando o segredo não está configurado", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    usuarios.push({ id: "u1", email: "maria@exemplo.test" });

    const res = await post(chamada(devolvido("maria@exemplo.test")));

    expect(res.status).toBe(503);
    expect(avisos).toEqual([]);
    expect(decisoes).toEqual([]);
  });

  it("recusa assinatura errada com 401 e não grava", async () => {
    const outro = `whsec_${Buffer.from("outro-segredo-qualquer-de-32-byt").toString("base64")}`;
    const res = await post(chamada(devolvido("maria@exemplo.test"), { segredo: outro }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ motivo: "assinatura-invalida" });
    expect(avisos).toEqual([]);
  });

  it("recusa sem os cabeçalhos do Svix e com carimbo de hora velho", async () => {
    const semCabecalho = new Request("https://financas.exemplo.test/api/webhooks/resend", { method: "POST", body: JSON.stringify(devolvido("a@b.test")) });
    expect((await post(semCabecalho)).status).toBe(401);

    const velho = String(Math.floor(Date.now() / 1000) - 10 * 60);
    const res = await post(chamada(devolvido("a@b.test"), { timestamp: velho }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ motivo: "fora-do-prazo" });
  });

  it("corpo alterado depois de assinado não passa", async () => {
    const original = chamada(devolvido("maria@exemplo.test"));
    const alterado = new Request(original.url, { method: "POST", headers: original.headers, body: JSON.stringify(devolvido("ladra@exemplo.test")) });
    expect((await post(alterado)).status).toBe(401);
  });

  it("devolução de quem tem conta vira Decisao email_devolvido e aviso com o e-mail mascarado", async () => {
    usuarios.push({ id: "u1", email: "maria@exemplo.test" });

    const res = await post(chamada(devolvido("Maria@Exemplo.test")));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "recorded", evento: "bounced", onde: "conta" });
    expect(decisoes).toHaveLength(1);
    expect(decisoes[0]).toMatchObject({
      userId: "u1",
      tipo: "email_devolvido",
      chave: "e1",
      descricao: "E-mail devolvido",
      dados: { evento: "bounced", assunto: "Seu acesso ao SPI Finance", motivo: "Permanent · General · mailbox does not exist" },
      createdAt: new Date("2026-10-30T12:00:00.000Z"),
    });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].routePath).toBe("e-mail");
    expect(avisos[0].message).toContain("E-mail devolvido: ma•••@exemplo.test");
    expect(avisos[0].message).not.toContain("maria@");
  });

  it("o mesmo aviso reenviado pela Resend não grava duas vezes", async () => {
    usuarios.push({ id: "u1", email: "maria@exemplo.test" });
    await post(chamada(devolvido("maria@exemplo.test")));
    await post(chamada(devolvido("maria@exemplo.test")));
    expect(decisoes).toHaveLength(1);
  });

  it("quem ainda não criou a conta fica só no aviso", async () => {
    const res = await post(chamada(devolvido("semconta@exemplo.test")));
    expect(await res.json()).toMatchObject({ status: "recorded", onde: "sem-conta" });
    expect(decisoes).toEqual([]);
    expect(avisos).toHaveLength(1);
  });

  it("reclamação de spam grava como 'Marcou o e-mail como spam'", async () => {
    usuarios.push({ id: "u2", email: "joao@exemplo.test" });
    const res = await post(chamada({ type: "email.complained", data: { email_id: "e9", to: "joao@exemplo.test", subject: "Resumo do mês" } }));
    expect(await res.json()).toMatchObject({ evento: "complained", onde: "conta" });
    expect(decisoes[0]).toMatchObject({ descricao: "Marcou o e-mail como spam", dados: { evento: "complained", motivo: null } });
    expect(avisos[0].message).toContain("Marcou o e-mail como spam: jo•••@exemplo.test");
  });

  it("outros eventos respondem 200 ignored sem gravar", async () => {
    const res = await post(chamada({ type: "email.delivered", data: { email_id: "e2", to: ["maria@exemplo.test"] } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ignored", type: "email.delivered" });
    expect(avisos).toEqual([]);
  });

  it("corpo que não é JSON responde 400 depois de conferir a assinatura", async () => {
    const texto = "isso não é json";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const req = new Request("https://financas.exemplo.test/api/webhooks/resend", {
      method: "POST",
      headers: { "svix-id": "m", "svix-timestamp": timestamp, "svix-signature": assinarSvix(SEGREDO, "m", timestamp, texto) },
      body: texto,
    });
    expect((await post(req)).status).toBe(400);
  });
});

describe("conferirAssinaturaSvix", () => {
  it("aceita quando uma das várias assinaturas do header bate", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const certa = assinarSvix(SEGREDO, "id1", ts, "{}");
    expect(conferirAssinaturaSvix(SEGREDO, { id: "id1", timestamp: ts, signature: `v1,abcd ${certa}` }, "{}")).toEqual({ ok: true });
  });

  it("segredo vazio ou inválido é recusado", () => {
    expect(conferirAssinaturaSvix("whsec_", { id: "a", timestamp: "1", signature: "v1,x" }, "{}")).toEqual({ ok: false, motivo: "segredo-invalido" });
  });
});
