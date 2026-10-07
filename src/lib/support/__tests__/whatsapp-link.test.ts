import { describe, expect, it, afterEach } from "vitest";
import { ASSUNTO_IMPORTACAO, linkDoSuporte, mensagemDeErroDeImportacao } from "../whatsapp-link";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
});

describe("mensagem de erro de importação", () => {
  it("leva o arquivo e o erro, pra Dani não precisar perguntar", () => {
    const msg = mensagemDeErroDeImportacao({ arquivo: "Nubank_2026-09.csv", problema: "só li 6 de 55 linhas" });
    expect(msg).toContain("Nubank_2026-09.csv");
    expect(msg).toContain("só li 6 de 55 linhas");
  });

  it("funciona sem arquivo nem erro conhecidos", () => {
    const msg = mensagemDeErroDeImportacao({});
    expect(msg.startsWith("Oi!")).toBe(true);
    expect(msg).not.toContain("undefined");
    expect(msg).not.toContain("null");
  });
});

describe("linkDoSuporte", () => {
  // Desde 06/10/2026 o suporte é por e-mail: a janela de 24h do WhatsApp não deixava a Dani responder depois.
  it("abre o e-mail do atendimento com o assunto e a mensagem escritos", () => {
    const link = linkDoSuporte("oi tudo bem?");
    expect(link).toBe("mailto:app@danicolombo.com.br?subject=Ajuda%20com%20o%20SPI%20Finance&body=oi%20tudo%20bem%3F");
  });

  it("o assunto separa os casos na caixa de entrada", () => {
    expect(linkDoSuporte("oi", ASSUNTO_IMPORTACAO)).toContain(`subject=${encodeURIComponent(ASSUNTO_IMPORTACAO)}`);
  });

  it("não depende de número de WhatsApp configurado", () => {
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = "+55 11 93623-7276";
    expect(linkDoSuporte("oi")).toMatch(/^mailto:/);
  });
});
