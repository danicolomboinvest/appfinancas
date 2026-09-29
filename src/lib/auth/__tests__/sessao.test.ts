import { describe, expect, it } from "vitest";
import { DESTINO_PADRAO, destinoDepoisDoLogin, sessaoValeParaSenha, versaoDaSenha } from "../sessao";

describe("versaoDaSenha / sessaoValeParaSenha", () => {
  it("muda quando a senha muda e se mantém para o mesmo hash", () => {
    const antes = versaoDaSenha("$2a$10$abcdefghijklmnopqrstuuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    const depois = versaoDaSenha("$2a$10$zyxwvutsrqponmlkjihgfeBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
    expect(antes).toHaveLength(16);
    expect(antes).not.toBe(depois);
    expect(versaoDaSenha("$2a$10$abcdefghijklmnopqrstuuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe(antes);
  });

  it("derruba a sessão cuja marca é de outra senha", () => {
    expect(sessaoValeParaSenha("aaaa", "bbbb")).toBe(false);
    expect(sessaoValeParaSenha("aaaa", "aaaa")).toBe(true);
  });

  it("token antigo, sem marca, continua valendo (não desloga todo mundo no deploy)", () => {
    expect(sessaoValeParaSenha(undefined, "bbbb")).toBe(true);
  });
});

describe("destinoDepoisDoLogin", () => {
  it("volta pra tela que o link do e-mail prometia, com a query", () => {
    expect(destinoDepoisDoLogin("/configuracoes/notificacoes")).toBe("/configuracoes/notificacoes");
    expect(destinoDepoisDoLogin("/mensal/2026/9?aba=gastos")).toBe("/mensal/2026/9?aba=gastos");
  });

  it("sem destino cai no Foco", () => {
    expect(destinoDepoisDoLogin(null)).toBe(DESTINO_PADRAO);
    expect(destinoDepoisDoLogin("")).toBe(DESTINO_PADRAO);
  });

  it("não deixa mandar pra fora do app", () => {
    expect(destinoDepoisDoLogin("https://golpe.com")).toBe(DESTINO_PADRAO);
    expect(destinoDepoisDoLogin("//golpe.com/x")).toBe(DESTINO_PADRAO);
    expect(destinoDepoisDoLogin("/\\golpe.com")).toBe(DESTINO_PADRAO);
    expect(destinoDepoisDoLogin("javascript:alert(1)")).toBe(DESTINO_PADRAO);
  });

  it("não volta pro login nem pro cadastro (laço)", () => {
    expect(destinoDepoisDoLogin("/login?callbackUrl=/x")).toBe(DESTINO_PADRAO);
    expect(destinoDepoisDoLogin("/register")).toBe(DESTINO_PADRAO);
  });
});
