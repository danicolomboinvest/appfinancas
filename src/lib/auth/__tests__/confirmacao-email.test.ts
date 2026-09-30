import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CONFIRMACAO_DESDE,
  VALIDADE_DO_LINK_MS,
  criarTokenDeConfirmacao,
  emailConfirmado,
  lerTokenDeConfirmacao,
} from "../confirmacao-email";

const segredoOriginal = { auth: process.env.AUTH_SECRET, next: process.env.NEXTAUTH_SECRET };

beforeEach(() => {
  process.env.AUTH_SECRET = "segredo-de-teste";
  delete process.env.NEXTAUTH_SECRET;
});

afterEach(() => {
  process.env.AUTH_SECRET = segredoOriginal.auth;
  process.env.NEXTAUTH_SECRET = segredoOriginal.next;
  if (segredoOriginal.auth === undefined) delete process.env.AUTH_SECRET;
  if (segredoOriginal.next === undefined) delete process.env.NEXTAUTH_SECRET;
});

describe("emailConfirmado", () => {
  const depois = new Date(CONFIRMACAO_DESDE.getTime() + 1000);
  const antes = new Date(CONFIRMACAO_DESDE.getTime() - 1000);

  it("conta nova sem clique no link não entra", () => {
    expect(emailConfirmado({ emailVerifiedAt: null, createdAt: depois })).toBe(false);
  });

  it("conta nova que clicou entra", () => {
    expect(emailConfirmado({ emailVerifiedAt: depois, createdAt: depois })).toBe(true);
  });

  it("conta de antes da regra continua valendo sem confirmar", () => {
    expect(emailConfirmado({ emailVerifiedAt: null, createdAt: antes })).toBe(true);
  });
});

describe("token do link de confirmação", () => {
  const agora = Date.UTC(2026, 9, 1, 12);

  it("volta de quem é e pra qual e-mail (sempre minúsculo)", () => {
    const token = criarTokenDeConfirmacao("user_1", " Maria@Gmail.com ", agora);
    expect(lerTokenDeConfirmacao(token, agora)).toEqual({ userId: "user_1", email: "maria@gmail.com" });
  });

  it("vale 7 dias e vence depois", () => {
    const token = criarTokenDeConfirmacao("user_1", "maria@gmail.com", agora);
    expect(lerTokenDeConfirmacao(token, agora + VALIDADE_DO_LINK_MS - 1)).not.toBeNull();
    expect(lerTokenDeConfirmacao(token, agora + VALIDADE_DO_LINK_MS + 1)).toBeNull();
  });

  it("recusa conteúdo trocado (outra conta, mesma assinatura)", () => {
    const token = criarTokenDeConfirmacao("user_1", "maria@gmail.com", agora);
    const [, assinatura] = token.split(".");
    const falso = Buffer.from(JSON.stringify({ u: "user_2", e: "maria@gmail.com", x: agora + 1e9 })).toString("base64url");
    expect(lerTokenDeConfirmacao(`${falso}.${assinatura}`, agora)).toBeNull();
  });

  it("recusa assinatura mexida, cortada ou ausente", () => {
    const token = criarTokenDeConfirmacao("user_1", "maria@gmail.com", agora);
    const [corpo, assinatura] = token.split(".");
    const trocada = (assinatura[0] === "A" ? "B" : "A") + assinatura.slice(1);
    expect(lerTokenDeConfirmacao(`${corpo}.${trocada}`, agora)).toBeNull();
    expect(lerTokenDeConfirmacao(`${corpo}.${assinatura.slice(0, 10)}`, agora)).toBeNull();
    expect(lerTokenDeConfirmacao(corpo, agora)).toBeNull();
    expect(lerTokenDeConfirmacao("", agora)).toBeNull();
    expect(lerTokenDeConfirmacao(undefined, agora)).toBeNull();
  });

  it("link assinado com outro segredo não vale", () => {
    const token = criarTokenDeConfirmacao("user_1", "maria@gmail.com", agora);
    process.env.AUTH_SECRET = "outro-segredo";
    expect(lerTokenDeConfirmacao(token, agora)).toBeNull();
  });

  it("sem segredo configurado não cria link nem aceita nenhum", () => {
    const token = criarTokenDeConfirmacao("user_1", "maria@gmail.com", agora);
    delete process.env.AUTH_SECRET;
    expect(() => criarTokenDeConfirmacao("user_1", "maria@gmail.com", agora)).toThrow();
    expect(lerTokenDeConfirmacao(token, agora)).toBeNull();
  });

  it("aceita o nome antigo NEXTAUTH_SECRET", () => {
    delete process.env.AUTH_SECRET;
    process.env.NEXTAUTH_SECRET = "segredo-antigo";
    const token = criarTokenDeConfirmacao("user_1", "maria@gmail.com", agora);
    expect(lerTokenDeConfirmacao(token, agora)?.userId).toBe("user_1");
  });
});
