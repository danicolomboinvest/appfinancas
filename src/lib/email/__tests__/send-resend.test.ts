import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Os dois caminhos do envio (30/10/2026): Resend pela API com a chave no ambiente, SMTP sem ela,
 * e o SMTP como reserva quando a Resend falha (com a falha anotada no AppError).
 * Rede trocada por um fetch falso; o nodemailer e o prisma por espiões.
 */

const sendMail = vi.fn<(msg: Record<string, unknown>) => Promise<unknown>>(async () => ({}));
const close = vi.fn();
const createTransport = vi.fn<(opcoes: Record<string, unknown>) => { sendMail: typeof sendMail; close: typeof close }>(() => ({ sendMail, close }));
vi.mock("nodemailer", () => ({ default: { createTransport: (opcoes: Record<string, unknown>) => createTransport(opcoes) } }));
vi.mock("server-only", () => ({}));

type Aviso = { create: { routePath: string; message: string } };
const upsert = vi.fn<(a: Aviso) => Promise<unknown>>(async () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { appError: { upsert: (a: Aviso) => upsert(a) } } }));

const fetchFalso = vi.fn();
const AMBIENTE = ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REPLY_TO", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"] as const;
const guardado: Partial<Record<(typeof AMBIENTE)[number], string | undefined>> = {};

function respostaHttp(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.resetModules();
  sendMail.mockClear();
  createTransport.mockClear();
  upsert.mockClear();
  fetchFalso.mockReset();
  for (const k of AMBIENTE) {
    guardado[k] = process.env[k];
    delete process.env[k];
  }
  process.env.SMTP_HOST = "smtp.exemplo.test";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_USER = "app@exemplo.test";
  process.env.SMTP_PASSWORD = "senha-de-teste";
  vi.stubGlobal("fetch", fetchFalso);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const k of AMBIENTE) {
    if (guardado[k] === undefined) delete process.env[k];
    else process.env[k] = guardado[k];
  }
});

const params = { to: "maria@exemplo.test", subject: "Oi", html: "<p>Oi</p>" };

describe("sendEmail com a chave da Resend", () => {
  it("manda pela API com o remetente do acesso.danicolombo.com.br e a resposta para o app@", async () => {
    process.env.RESEND_API_KEY = "re_chave_de_teste";
    fetchFalso.mockResolvedValueOnce(respostaHttp(200, { id: "abc-123" }));
    const { sendEmail } = await import("../send");

    const r = await sendEmail(params);

    expect(r).toEqual({ ok: true, via: "resend" });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_chave_de_teste");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "SPI Finance <spi@acesso.danicolombo.com.br>",
      to: ["maria@exemplo.test"],
      subject: "Oi",
      html: "<p>Oi</p>",
      reply_to: "app@danicolombo.com.br",
    });
    expect(sendMail).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("respeita EMAIL_FROM, EMAIL_REPLY_TO e o replyTo do e-mail", async () => {
    process.env.RESEND_API_KEY = "re_chave_de_teste";
    process.env.EMAIL_FROM = "SPI <oi@acesso.danicolombo.com.br>";
    process.env.EMAIL_REPLY_TO = "contato@danicolombo.com.br";
    fetchFalso.mockResolvedValue(respostaHttp(200, { id: "x" }));
    const { sendEmail } = await import("../send");

    await sendEmail(params);
    await sendEmail({ ...params, replyTo: "suporte@exemplo.test", text: "Oi" });

    const corpo1 = JSON.parse(String((fetchFalso.mock.calls[0] as [string, RequestInit])[1].body));
    const corpo2 = JSON.parse(String((fetchFalso.mock.calls[1] as [string, RequestInit])[1].body));
    expect(corpo1.from).toBe("SPI <oi@acesso.danicolombo.com.br>");
    expect(corpo1.reply_to).toBe("contato@danicolombo.com.br");
    expect(corpo2.reply_to).toBe("suporte@exemplo.test");
    expect(corpo2.text).toBe("Oi");
  });

  it("quando a Resend falha, manda pelo SMTP uma vez e anota a falha no AppError", async () => {
    process.env.RESEND_API_KEY = "re_chave_de_teste";
    fetchFalso.mockResolvedValueOnce(new Response("daily quota exceeded re_chave_de_teste", { status: 429 }));
    const { sendEmail } = await import("../send");

    const r = await sendEmail(params);

    expect(r).toEqual({ ok: true, via: "smtp-reserva" });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ from: '"SPI Finance" <app@exemplo.test>', to: "maria@exemplo.test", subject: "Oi" });
    expect(upsert).toHaveBeenCalledTimes(1);
    const aviso = upsert.mock.calls[0][0];
    expect(aviso.create.routePath).toBe("e-mail");
    expect(aviso.create.message).toContain("Resend falhou (HTTP 429: daily quota exceeded re_•••)");
    expect(aviso.create.message).toContain("o SMTP mandou");
    expect(aviso.create.message).not.toContain("re_chave_de_teste");
  });

  it("rede caída na Resend também cai no SMTP; se o SMTP falha, devolve erro e anota as duas falhas", async () => {
    process.env.RESEND_API_KEY = "re_chave_de_teste";
    fetchFalso.mockRejectedValueOnce(new Error("fetch failed"));
    sendMail.mockRejectedValueOnce(new Error("535 authentication failed"));
    const { sendEmail } = await import("../send");

    const r = await sendEmail(params);

    expect(r).toEqual({ ok: false, reason: "error" });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const aviso = upsert.mock.calls[0][0];
    expect(aviso.create.message).toBe("Resend falhou (fetch failed); o SMTP também falhou");
  });

  it("o lote vai pela Resend sem abrir conexão SMTP, e só abre se precisar da reserva", async () => {
    process.env.RESEND_API_KEY = "re_chave_de_teste";
    fetchFalso.mockResolvedValueOnce(respostaHttp(200, { id: "1" })).mockResolvedValueOnce(respostaHttp(500, { message: "erro" }));
    const { abrirEnvioEmLote } = await import("../send");

    const lote = abrirEnvioEmLote();
    expect(createTransport).not.toHaveBeenCalled();
    expect(await lote.enviar(params)).toEqual({ ok: true, via: "resend" });
    expect(createTransport).not.toHaveBeenCalled();
    expect(await lote.enviar(params)).toEqual({ ok: true, via: "smtp-reserva" });
    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport.mock.calls[0][0]).toMatchObject({ pool: true, maxConnections: 1 });
    lote.fechar();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("sendEmail sem a chave da Resend", () => {
  it("vai pelo SMTP como sempre, sem tocar na rede da Resend", async () => {
    const { sendEmail, isEmailConfigured } = await import("../send");

    const r = await sendEmail({ ...params, replyTo: "contato@exemplo.test" });

    expect(r).toEqual({ ok: true, via: "smtp" });
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toEqual({ from: '"SPI Finance" <app@exemplo.test>', to: "maria@exemplo.test", subject: "Oi", html: "<p>Oi</p>", replyTo: "contato@exemplo.test" });
    expect(upsert).not.toHaveBeenCalled();
    expect(isEmailConfigured()).toBe(true);
  });

  it("chave vazia (só espaços) conta como ausente", async () => {
    process.env.RESEND_API_KEY = "   ";
    const { sendEmail } = await import("../send");
    expect(await sendEmail(params)).toEqual({ ok: true, via: "smtp" });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("sem SMTP nem Resend, não envia e diz que não está configurado", async () => {
    delete process.env.SMTP_PASSWORD;
    const { sendEmail, isEmailConfigured } = await import("../send");
    expect(await sendEmail(params)).toEqual({ ok: false, reason: "not-configured" });
    expect(isEmailConfigured()).toBe(false);
  });

  it("com a chave da Resend e sem SMTP, isEmailConfigured é true", async () => {
    delete process.env.SMTP_PASSWORD;
    process.env.RESEND_API_KEY = "re_x";
    const { isEmailConfigured } = await import("../send");
    expect(isEmailConfigured()).toBe(true);
  });
});
