import { describe, expect, it } from "vitest";
import { EMAIL_DO_SUPORTE, mensagemDeAcessoTrancado } from "../contato";

describe("contato do suporte no cadeado", () => {
  it("o e-mail de atendimento é o da caixa do app", () => {
    expect(EMAIL_DO_SUPORTE).toBe("app@danicolombo.com.br");
  });

  it("a mensagem pronta diz o que está trancado e o e-mail da conta, pra achar a compra", () => {
    const msg = mensagemDeAcessoTrancado("Carteira de Investimentos", "maria@x.com");
    expect(msg).toContain("Carteira de Investimentos");
    expect(msg).toContain("maria@x.com");
    expect(msg.startsWith("Oi!")).toBe(true);
  });

  it("sem e-mail (leitura da conta falhou), a mensagem sai mesmo assim", () => {
    expect(mensagemDeAcessoTrancado("Análises", null)).not.toContain("e-mail da minha conta");
  });
});
