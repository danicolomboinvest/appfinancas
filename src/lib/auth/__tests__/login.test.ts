import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DESTINO_PADRAO, versaoDaSenha } from "../sessao";

/**
 * Login de ponta a ponta sem banco: o authorize() do Auth.js (trava de 5 tentativas, zera o
 * contador), o callback jwt (conta apagada, senha trocada e papel rebaixado derrubam a sessão)
 * e o loginAction (mensagem da trava, e-mail que volta pro formulário, destino depois de entrar).
 *
 * O Auth.js é trocado por um dublê que só guarda a configuração: assim dá pra chamar o
 * authorize() e os callbacks exatamente como estão escritos em auth.config.ts.
 */

const h = vi.hoisted(() => {
  class AuthError extends Error {}
  return {
    config: null as null | {
      providers: Array<{ authorize: (c: unknown) => Promise<unknown> }>;
      callbacks: {
        jwt: (a: { token: Record<string, unknown>; user?: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
        session: (a: { session: { user: Record<string, unknown> }; token: Record<string, unknown> }) => { user: Record<string, unknown> };
      };
    },
    signIn: vi.fn(),
    AuthError,
  };
});

vi.mock("next-auth", () => ({
  default: (cfg: typeof h.config) => {
    h.config = cfg;
    return { handlers: {}, auth: vi.fn(), signIn: h.signIn, signOut: vi.fn() };
  },
  AuthError: h.AuthError,
}));
vi.mock("next-auth/providers/credentials", () => ({ default: (c: unknown) => c }));

type Conta = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  passwordHash: string;
  failedLoginCount: number;
  lockedUntil: Date | null;
};
const contas = new Map<string, Conta>();

const userUpdate = vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Conta> }) => {
  const c = [...contas.values()].find((x) => x.id === where.id)!;
  Object.assign(c, data);
  return c;
});
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      update: (a: { where: { id: string }; data: Partial<Conta> }) => userUpdate(a),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const c = [...contas.values()].find((x) => x.id === where.id);
        return c ? { role: c.role, passwordHash: c.passwordHash } : null;
      }),
    },
  },
}));
vi.mock("@/lib/repositories/user.repo", () => ({
  findUserByEmail: vi.fn(async (email: string) => contas.get(email.trim().toLowerCase()) ?? null),
}));

await import("../auth.config");
const { loginAction } = await import("@/app/(public)/login/actions");

const SENHA = "senha-certa-123";
let HASH = "";

function authorize(email: unknown, password: unknown) {
  return h.config!.providers[0].authorize({ email, password });
}

function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

beforeEach(async () => {
  if (!HASH) HASH = await bcrypt.hash(SENHA, 4);
  contas.clear();
  contas.set("ana@x.com", { id: "u1", email: "ana@x.com", name: "Cliente A", role: "USER", passwordHash: HASH, failedLoginCount: 0, lockedUntil: null });
  userUpdate.mockClear();
  h.signIn.mockReset();
});

describe("authorize: senha e trava", () => {
  it("sem e-mail ou senha não tenta nada", async () => {
    expect(await authorize(undefined, SENHA)).toBeNull();
    expect(await authorize("ana@x.com", "")).toBeNull();
    expect(await authorize(["ana@x.com"], SENHA)).toBeNull();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("e-mail sem conta devolve null e não grava nada", async () => {
    expect(await authorize("ninguem@x.com", SENHA)).toBeNull();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("senha certa entra com id, papel e a marca da senha (sem gravar quando não havia erro)", async () => {
    const u = await authorize("ana@x.com", SENHA);
    expect(u).toEqual({ id: "u1", email: "ana@x.com", name: "Cliente A", role: "USER", senhaVersao: versaoDaSenha(HASH) });
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("senha errada soma 1 no contador", async () => {
    expect(await authorize("ana@x.com", "errada")).toBeNull();
    expect(contas.get("ana@x.com")!.failedLoginCount).toBe(1);
    expect(contas.get("ana@x.com")!.lockedUntil).toBeNull();
  });

  it("a 5ª senha errada trava por 15 minutos e zera o contador", async () => {
    const antes = Date.now();
    for (let i = 0; i < 5; i++) await authorize("ana@x.com", "errada");
    const c = contas.get("ana@x.com")!;
    expect(c.failedLoginCount).toBe(0);
    expect(c.lockedUntil).not.toBeNull();
    const minutos = (c.lockedUntil!.getTime() - antes) / 60_000;
    expect(minutos).toBeGreaterThanOrEqual(14.9);
    expect(minutos).toBeLessThanOrEqual(15.1);
  });

  it("travada, nem a senha certa entra (e não gasta bcrypt nem grava)", async () => {
    contas.get("ana@x.com")!.lockedUntil = new Date(Date.now() + 5 * 60_000);
    const compare = vi.spyOn(bcrypt, "compare");
    expect(await authorize("ana@x.com", SENHA)).toBeNull();
    expect(compare).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
    compare.mockRestore();
  });

  it("trava vencida: a senha certa entra e limpa trava e contador", async () => {
    Object.assign(contas.get("ana@x.com")!, { lockedUntil: new Date(Date.now() - 1000), failedLoginCount: 3 });
    expect(await authorize("ana@x.com", SENHA)).not.toBeNull();
    expect(contas.get("ana@x.com")).toMatchObject({ failedLoginCount: 0, lockedUntil: null });
  });
});

describe("callback jwt: a sessão aberta continua valendo?", () => {
  it("no login grava id, papel e marca da senha no token", async () => {
    const t = await h.config!.callbacks.jwt({ token: {}, user: { id: "u1", role: "USER", senhaVersao: "abc" } });
    expect(t).toMatchObject({ id: "u1", role: "USER", senhaVersao: "abc" });
  });

  it("conta apagada derruba a sessão (null), em vez de erro 500 com o cookie velho", async () => {
    expect(await h.config!.callbacks.jwt({ token: { id: "apagada", role: "USER", senhaVersao: "x" } })).toBeNull();
  });

  it("senha trocada em outro aparelho derruba a sessão", async () => {
    const tokenVelho = { id: "u1", role: "USER", senhaVersao: versaoDaSenha(HASH) };
    contas.get("ana@x.com")!.passwordHash = await bcrypt.hash("senha-nova-456", 4);
    expect(await h.config!.callbacks.jwt({ token: tokenVelho })).toBeNull();
  });

  it("admin rebaixado perde o papel na requisição seguinte", async () => {
    const t = await h.config!.callbacks.jwt({ token: { id: "u1", role: "ADMIN", senhaVersao: versaoDaSenha(HASH) } });
    expect(t?.role).toBe("USER");
  });

  it("token antigo sem marca continua valendo e passa a carregar a marca atual", async () => {
    const t = await h.config!.callbacks.jwt({ token: { id: "u1", role: "USER" } });
    expect(t?.senhaVersao).toBe(versaoDaSenha(HASH));
  });

  it("session copia id e papel do token", () => {
    const s = h.config!.callbacks.session({ session: { user: {} }, token: { id: "u1", role: "USER" } });
    expect(s.user).toMatchObject({ id: "u1", role: "USER" });
  });
});

describe("loginAction", () => {
  it("e-mail inválido volta com a mensagem e com o que ela digitou", async () => {
    const r = await loginAction({}, form({ email: "ana@", password: "x" }));
    expect(r).toEqual({ error: "Email inválido.", email: "ana@" });
    expect(h.signIn).not.toHaveBeenCalled();
  });

  it("conta travada: diz quantos minutos faltam (singular certo) e nem tenta entrar", async () => {
    contas.get("ana@x.com")!.lockedUntil = new Date(Date.now() + 30_000);
    const umMinuto = await loginAction({}, form({ email: "ana@x.com", password: SENHA }));
    expect(umMinuto.error).toContain("aguarde 1 minuto e");

    contas.get("ana@x.com")!.lockedUntil = new Date(Date.now() + 9 * 60_000 + 10_000);
    const dez = await loginAction({}, form({ email: "ana@x.com", password: SENHA }));
    expect(dez.error).toContain("aguarde 10 minutos");
    expect(h.signIn).not.toHaveBeenCalled();
  });

  it("senha errada: mensagem genérica e o e-mail continua no campo", async () => {
    h.signIn.mockRejectedValue(new h.AuthError("CredentialsSignin"));
    const r = await loginAction({}, form({ email: "Ana@X.com", password: "errada" }));
    expect(r).toEqual({ error: "Email ou senha incorretos.", email: "Ana@X.com" });
  });

  it("e-mail com maiúscula entra minúsculo, e sem callbackUrl cai no Foco", async () => {
    h.signIn.mockResolvedValue(undefined);
    await loginAction({}, form({ email: "  Ana@X.com ", password: SENHA }));
    expect(h.signIn).toHaveBeenCalledWith("credentials", { email: "ana@x.com", password: SENHA, redirectTo: DESTINO_PADRAO });
  });

  it("callbackUrl do próprio app é respeitado; de fora, não", async () => {
    h.signIn.mockResolvedValue(undefined);
    await loginAction({}, form({ email: "ana@x.com", password: SENHA, callbackUrl: "/configuracoes/notificacoes?off=1" }));
    expect(h.signIn.mock.calls[0][1].redirectTo).toBe("/configuracoes/notificacoes?off=1");
    await loginAction({}, form({ email: "ana@x.com", password: SENHA, callbackUrl: "https://golpe.example/entrar" }));
    expect(h.signIn.mock.calls[1][1].redirectTo).toBe(DESTINO_PADRAO);
  });

  it("o redirect do signIn (que não é AuthError) sobe, senão o login não sai da tela", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/mensal/foco;307;" });
    h.signIn.mockRejectedValue(redirect);
    await expect(loginAction({}, form({ email: "ana@x.com", password: SENHA }))).rejects.toBe(redirect);
  });
});
