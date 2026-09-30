import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VALIDADE_DO_CONVITE_MS, caminhoDoCadastro, criarTokenDeConvite, lerTokenDeConvite } from "../convite-cadastro";

/**
 * O código do convite: é o que faz o cadastro abrir com o e-mail da compra já preenchido. Se ele
 * aceitasse qualquer coisa, dava pra mandar a alguém um link de cadastro com um e-mail inventado
 * travado no campo; se recusasse o que é válido, voltávamos ao cadastro em branco, com a
 * compradora digitando outro e-mail e caindo nos cadeados.
 */

const AGORA = Date.parse("2026-09-30T12:00:00Z");
let antes: string | undefined;

beforeEach(() => {
  antes = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "segredo-de-teste";
});
afterEach(() => {
  if (antes === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = antes;
});

describe("convite do cadastro", () => {
  it("ida e volta: devolve o e-mail normalizado (minúsculo, sem espaço), como a liberação grava", () => {
    const token = criarTokenDeConvite("  Maria.Silva@Gmail.com ", AGORA)!;
    expect(lerTokenDeConvite(token, AGORA)).toBe("maria.silva@gmail.com");
  });

  it("vale até o fim do prazo e vence depois", () => {
    const token = criarTokenDeConvite("a@x.com", AGORA)!;
    expect(lerTokenDeConvite(token, AGORA + VALIDADE_DO_CONVITE_MS)).toBe("a@x.com");
    expect(lerTokenDeConvite(token, AGORA + VALIDADE_DO_CONVITE_MS + 1)).toBeNull();
  });

  it("recusa código mexido: trocar o e-mail sem a assinatura não passa", () => {
    const token = criarTokenDeConvite("a@x.com", AGORA)!;
    const [, assinatura] = token.split(".");
    const outroCorpo = Buffer.from(JSON.stringify({ e: "b@x.com", x: AGORA + 1000 })).toString("base64url");
    expect(lerTokenDeConvite(`${outroCorpo}.${assinatura}`, AGORA)).toBeNull();
    expect(lerTokenDeConvite(`${token}x`, AGORA)).toBeNull();
  });

  it("recusa assinado com outro segredo (outro ambiente, ou segredo trocado)", () => {
    const token = criarTokenDeConvite("a@x.com", AGORA)!;
    process.env.AUTH_SECRET = "outro-segredo";
    expect(lerTokenDeConvite(token, AGORA)).toBeNull();
  });

  it("recusa lixo sem lançar: vazio, sem ponto, não-texto, gigante", () => {
    for (const lixo of [undefined, null, "", "abc", "a.b.c", 123, ["a.b"], "x".repeat(2000)]) {
      expect(lerTokenDeConvite(lixo, AGORA)).toBeNull();
    }
  });

  it("sem AUTH_SECRET: não cria código e o link cai no cadastro em branco (o convite sai do mesmo jeito)", () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(criarTokenDeConvite("a@x.com", AGORA)).toBeNull();
    expect(caminhoDoCadastro("a@x.com", AGORA)).toBe("/register");
  });

  it("com segredo, o caminho leva o código que a tela de cadastro lê", () => {
    const caminho = caminhoDoCadastro("a@x.com", AGORA);
    expect(caminho.startsWith("/register?convite=")).toBe(true);
    const token = decodeURIComponent(caminho.slice("/register?convite=".length));
    expect(lerTokenDeConvite(token, AGORA)).toBe("a@x.com");
  });
});
