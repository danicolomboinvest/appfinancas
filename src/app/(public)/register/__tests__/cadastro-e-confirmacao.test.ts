import { beforeEach, describe, expect, it, vi } from "vitest";
import { DESTINO_PADRAO } from "@/lib/auth/sessao";
import { CONFIRMACAO_DESDE, criarTokenDeConfirmacao, lerTokenDeConfirmacao } from "@/lib/auth/confirmacao-email";

/**
 * Cadastro + confirmação de e-mail, sem banco. Até aqui só o formato dos campos (auth.schema) e
 * o código assinado do link tinham teste; a ordem das travas do cadastro, o envio do link, o
 * "Reenviar" e a gravação da confirmação não tinham nenhum.
 *
 * Protegido aqui:
 *  - registerAction: campo inválido volta com o que ela digitou (sem a senha), termos
 *    obrigatórios, e-mail repetido não cria segunda conta, celular normalizado, falha no envio
 *    do link não impede a conta de nascer, e o login automático cai no Foco.
 *  - enviarConfirmacaoDeEmail: link absoluto com o host certo, limite por conta.
 *  - reenviarConfirmacaoAction: sem sessão, já confirmada, enviado, falhou, limite (com o tempo).
 *  - marcarEmailConfirmado (o que a página do link chama): link de e-mail antigo não confirma o
 *    novo, e confirmar de novo não reescreve a data.
 */

const h = vi.hoisted(() => {
  class AuthError extends Error {}
  return { AuthError };
});

vi.mock("server-only", () => ({}));
vi.mock("next-auth", () => ({ AuthError: h.AuthError }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "app.exemplo.test", "x-forwarded-proto": "https" })),
}));

const signIn = vi.fn();
const auth = vi.fn();
vi.mock("@/lib/auth/auth.config", () => ({ signIn: (...a: unknown[]) => signIn(...a), auth: () => auth() }));

const createUser = vi.fn();
const findUserByEmail = vi.fn();
const getOwnUser = vi.fn();
vi.mock("@/lib/repositories/user.repo", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/repositories/user.repo")>();
  return {
    ...real,
    createUser: (i: unknown) => createUser(i),
    findUserByEmail: (e: string) => findUserByEmail(e),
    getOwnUser: (c: unknown) => getOwnUser(c),
  };
});

const getAllowedPhone = vi.fn();
const situacaoDoAcesso = vi.fn();
const compraComOCelular = vi.fn();
vi.mock("@/lib/repositories/allowedEmail.repo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repositories/allowedEmail.repo")>()),
  getAllowedPhone: (e: string) => getAllowedPhone(e),
  situacaoDoAcesso: (e: string) => situacaoDoAcesso(e),
  compraComOCelular: (p: string) => compraComOCelular(p),
}));

const enviarConfirmacaoDeEmail = vi.fn();
vi.mock("@/lib/auth/enviar-confirmacao", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth/enviar-confirmacao")>();
  return { ...real, enviarConfirmacaoDeEmail: (u: unknown) => enviarConfirmacaoDeEmail(u), _real: real.enviarConfirmacaoDeEmail };
});

const reservarEnvio = vi.fn();
const enviosRecentes = vi.fn();
vi.mock("@/lib/auth/limite-de-envio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/limite-de-envio")>()),
  reservarEnvio: (...a: unknown[]) => reservarEnvio(...a),
  enviosRecentes: (...a: unknown[]) => enviosRecentes(...a),
}));

const sendEmail = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendEmail: (m: unknown) => sendEmail(m) }));

type Linha = { id: string; email: string; emailVerifiedAt: Date | null };
const usuarios: Linha[] = [];
const userUpdate = vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Linha> }) => {
  const u = usuarios.find((x) => x.id === where.id)!;
  Object.assign(u, data);
  return u;
});
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => usuarios.find((u) => u.id === where.id) ?? null),
      update: (a: { where: { id: string }; data: Partial<Linha> }) => userUpdate(a),
    },
  },
}));

const { registerAction } = await import("../actions");
const { reenviarConfirmacaoAction } = await import("@/app/(public)/confirmar-email/actions");
const { marcarEmailConfirmado } = await import("@/lib/repositories/user.repo");
const enviarReal = ((await import("@/lib/auth/enviar-confirmacao")) as unknown as {
  _real: typeof import("@/lib/auth/enviar-confirmacao").enviarConfirmacaoDeEmail;
})._real;

function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

const VALIDO = { name: "Cliente A", email: "Cliente.A@Exemplo.com", password: "senha-forte-1", phone: "(11) 98765-4321", acceptTerms: "on" };

beforeEach(() => {
  process.env.AUTH_SECRET = "segredo-de-teste";
  createUser.mockReset().mockImplementation(async (i: { email: string; name: string }) => ({ id: "novo", email: i.email.toLowerCase(), name: i.name }));
  findUserByEmail.mockReset().mockResolvedValue(null);
  getAllowedPhone.mockReset().mockResolvedValue(null);
  situacaoDoAcesso.mockReset().mockResolvedValue("ativo");
  compraComOCelular.mockReset().mockResolvedValue(null);
  enviarConfirmacaoDeEmail.mockReset().mockResolvedValue("enviado");
  signIn.mockReset();
  auth.mockReset();
  getOwnUser.mockReset();
  reservarEnvio.mockReset().mockResolvedValue(true);
  enviosRecentes.mockReset().mockResolvedValue([]);
  sendEmail.mockReset().mockResolvedValue({ ok: true });
  usuarios.length = 0;
  userUpdate.mockClear();
});

describe("registerAction: travas antes de criar a conta", () => {
  it("campo inválido volta com a mensagem e com o que ela digitou, nunca com a senha", async () => {
    const r = await registerAction({}, form({ ...VALIDO, password: "curta" }));
    expect(r.error).toBe("A senha deve ter ao menos 8 caracteres.");
    expect(r.values).toEqual({ name: "Cliente A", email: "Cliente.A@Exemplo.com", phone: "(11) 98765-4321", acceptTerms: true });
    expect(JSON.stringify(r)).not.toContain("curta");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("celular que não é BR com DDD vira mensagem com exemplo", async () => {
    const r = await registerAction({}, form({ ...VALIDO, phone: "123" }));
    expect(r.error).toContain("Celular inválido");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("sem aceitar os termos não cria (LGPD), e o resto do formulário volta preenchido", async () => {
    const semTermos: Record<string, string> = { ...VALIDO };
    delete semTermos.acceptTerms;
    const r = await registerAction({}, form(semTermos));
    expect(r.error).toContain("aceitar os Termos");
    expect(r.values?.acceptTerms).toBe(false);
    expect(r.values?.name).toBe("Cliente A");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("e-mail que já tem conta (qualquer caixa) não cria a segunda e aponta o 'Esqueci minha senha'", async () => {
    findUserByEmail.mockResolvedValue({ id: "antiga", email: "cliente.a@exemplo.com" });
    const r = await registerAction({}, form(VALIDO));
    expect(findUserByEmail).toHaveBeenCalledWith("cliente.a@exemplo.com");
    expect(r.error).toContain("Esqueci minha senha");
    expect(createUser).not.toHaveBeenCalled();
    expect(enviarConfirmacaoDeEmail).not.toHaveBeenCalled();
  });
});

describe("registerAction: só quem comprou cria conta", () => {
  it("e-mail sem compra não cria, e o celular que bate com uma compra aponta o e-mail dela, mascarado", async () => {
    situacaoDoAcesso.mockResolvedValue("sem-compra");
    compraComOCelular.mockResolvedValue("cl•••••@gmail.com");
    const r = await registerAction({}, form(VALIDO));
    expect(situacaoDoAcesso).toHaveBeenCalledWith("cliente.a@exemplo.com");
    expect(compraComOCelular).toHaveBeenCalledWith("5511987654321");
    expect(r.error).toContain("Use o mesmo e-mail que você usou pra comprar");
    expect(r.error).toContain("cl•••••@gmail.com");
    expect(r.values?.email).toBe("Cliente.A@Exemplo.com");
    expect(createUser).not.toHaveBeenCalled();
    expect(enviarConfirmacaoDeEmail).not.toHaveBeenCalled();
  });

  it("sem compra e sem celular conhecido: pede o e-mail da compra, sem dica", async () => {
    situacaoDoAcesso.mockResolvedValue("sem-compra");
    const r = await registerAction({}, form(VALIDO));
    expect(r.error).toContain("Não achamos compra");
    expect(r.error).not.toContain("celular");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("compra reembolsada ou vencida não cria, e não sai procurando outra compra pelo celular", async () => {
    for (const situacao of ["encerrado", "vencido"]) {
      situacaoDoAcesso.mockResolvedValue(situacao);
      const r = await registerAction({}, form(VALIDO));
      expect(r.error).toContain("não está mais ativa");
    }
    expect(compraComOCelular).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });
});

describe("registerAction: conta criada", () => {
  it("cria com e-mail minúsculo e celular normalizado, manda o link e entra logada no Foco", async () => {
    signIn.mockResolvedValue(undefined);
    await expect(registerAction({}, form(VALIDO))).rejects.toMatchObject({ url: "/login?created=1" });
    expect(createUser).toHaveBeenCalledWith({ name: "Cliente A", email: "cliente.a@exemplo.com", password: "senha-forte-1", phone: "5511987654321" });
    expect(enviarConfirmacaoDeEmail).toHaveBeenCalledWith(expect.objectContaining({ id: "novo" }));
    expect(signIn).toHaveBeenCalledWith("credentials", { email: "cliente.a@exemplo.com", password: "senha-forte-1", redirectTo: DESTINO_PADRAO });
  });

  it("o redirect do login automático (não é AuthError) sobe e leva pro app", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { url: DESTINO_PADRAO });
    signIn.mockRejectedValue(redirect);
    await expect(registerAction({}, form(VALIDO))).rejects.toBe(redirect);
  });

  it("login automático recusado cai no login com 'conta criada', sem perder a conta", async () => {
    signIn.mockRejectedValue(new h.AuthError("CredentialsSignin"));
    await expect(registerAction({}, form(VALIDO))).rejects.toMatchObject({ url: "/login?created=1" });
    expect(createUser).toHaveBeenCalledTimes(1);
  });

  it("SMTP fora do ar não impede a conta de nascer (a tela de confirmação tem o Reenviar)", async () => {
    enviarConfirmacaoDeEmail.mockRejectedValue(new Error("SMTP caiu"));
    signIn.mockResolvedValue(undefined);
    await expect(registerAction({}, form(VALIDO))).rejects.toMatchObject({ url: "/login?created=1" });
    expect(createUser).toHaveBeenCalledTimes(1);
  });
});

describe("enviarConfirmacaoDeEmail", () => {
  const conta = { id: "u1", email: "cliente.a@exemplo.com", name: "Cliente A" };

  it("manda um link absoluto do próprio app, com um código que abre pra mesma conta", async () => {
    expect(await enviarReal(conta)).toBe("enviado");
    const { to, html } = sendEmail.mock.calls[0][0] as { to: string; html: string };
    expect(to).toBe(conta.email);
    const link = html.match(/https:\/\/app\.exemplo\.test\/confirmar-email\?t=([^"&\s<]+)/);
    expect(link).not.toBeNull();
    expect(lerTokenDeConfirmacao(decodeURIComponent(link![1]))).toEqual({ userId: "u1", email: conta.email });
  });

  it("fora do limite (1/min, 5/dia) não manda nada", async () => {
    reservarEnvio.mockResolvedValue(false);
    expect(await enviarReal(conta)).toBe("limite");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("SMTP recusou ou AUTH_SECRET faltando: 'falhou', sem estourar", async () => {
    sendEmail.mockResolvedValue({ ok: false });
    expect(await enviarReal(conta)).toBe("falhou");
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(await enviarReal(conta)).toBe("falhou");
  });
});

describe("reenviarConfirmacaoAction", () => {
  const naoConfirmada = { id: "u1", email: "cliente.a@exemplo.com", name: "Cliente A", emailVerifiedAt: null, createdAt: new Date(CONFIRMACAO_DESDE.getTime() + 60_000) };

  it("sem sessão pede pra entrar de novo", async () => {
    auth.mockResolvedValue(null);
    expect(await reenviarConfirmacaoAction()).toEqual({ erro: expect.stringContaining("Entre de novo") });
    expect(enviarConfirmacaoDeEmail).not.toHaveBeenCalled();
  });

  it("já confirmada (em outra aba) não manda nada", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    getOwnUser.mockResolvedValue({ ...naoConfirmada, emailVerifiedAt: new Date() });
    expect(await reenviarConfirmacaoAction()).toEqual({});
    expect(enviarConfirmacaoDeEmail).not.toHaveBeenCalled();
  });

  it("manda pro e-mail DA CONTA da sessão", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    getOwnUser.mockResolvedValue(naoConfirmada);
    expect(await reenviarConfirmacaoAction()).toEqual({ enviado: true });
    expect(getOwnUser).toHaveBeenCalledWith({ userId: "u1", role: "USER" });
    expect(enviarConfirmacaoDeEmail).toHaveBeenCalledWith(naoConfirmada);
  });

  it("no limite, diz quanto falta em segundos", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    getOwnUser.mockResolvedValue(naoConfirmada);
    enviarConfirmacaoDeEmail.mockResolvedValue("limite");
    enviosRecentes.mockResolvedValue([new Date(Date.now() - 20_000)]);
    const r = await reenviarConfirmacaoAction();
    expect(r.erro).toMatch(/peça outro em (39|40|41) segundos\./);
  });

  it("SMTP falhou: pede pra tentar daqui a pouco", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    getOwnUser.mockResolvedValue(naoConfirmada);
    enviarConfirmacaoDeEmail.mockResolvedValue("falhou");
    expect((await reenviarConfirmacaoAction()).erro).toContain("Tente de novo daqui a pouco");
  });
});

describe("clique no link: marcarEmailConfirmado", () => {
  it("link válido confirma a conta, e clicar de novo não muda a data", async () => {
    usuarios.push({ id: "u1", email: "Cliente.A@Exemplo.com", emailVerifiedAt: null });
    const lido = lerTokenDeConfirmacao(criarTokenDeConfirmacao("u1", "cliente.a@exemplo.com"))!;
    expect(await marcarEmailConfirmado(lido.userId, lido.email)).toBe(true);
    const primeira = usuarios[0].emailVerifiedAt;
    expect(primeira).toBeInstanceOf(Date);
    expect(await marcarEmailConfirmado(lido.userId, lido.email)).toBe(true);
    expect(usuarios[0].emailVerifiedAt).toBe(primeira);
    expect(userUpdate).toHaveBeenCalledTimes(1);
  });

  it("link feito pra um e-mail que a conta não tem mais não confirma o endereço novo", async () => {
    usuarios.push({ id: "u1", email: "novo@exemplo.com", emailVerifiedAt: null });
    expect(await marcarEmailConfirmado("u1", "antigo@exemplo.com")).toBe(false);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("conta apagada: não confirma nada", async () => {
    expect(await marcarEmailConfirmado("sumiu", "x@exemplo.com")).toBe(false);
  });
});
