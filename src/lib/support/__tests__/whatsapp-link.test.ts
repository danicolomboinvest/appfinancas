import { describe, expect, it, afterEach } from "vitest";
import { linkDoSuporte, mensagemDeErroDeImportacao, PALAVRA_CHAVE_IMPORTACAO } from "../whatsapp-link";

/**
 * O gatilho do ManyChat está configurado como "a mensagem contém ERRO-IMPORTACAO".
 * Se esta palavra mudar aqui e não lá (ou o contrário), o botão continua abrindo o WhatsApp e
 * o fluxo simplesmente não responde — falha silenciosa, do tipo que ninguém percebe até alguém
 * reclamar que pediu ajuda e ficou no vácuo.
 */
const GATILHO_CONFIGURADO_NO_MANYCHAT = "ERRO-IMPORTACAO";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
});

describe("mensagem de suporte", () => {
  it("carrega a palavra que o ManyChat espera", () => {
    expect(PALAVRA_CHAVE_IMPORTACAO).toBe(GATILHO_CONFIGURADO_NO_MANYCHAT);
    const msg = mensagemDeErroDeImportacao({ arquivo: "extrato.pdf", problema: "não consegui ler" });
    expect(msg).toContain(GATILHO_CONFIGURADO_NO_MANYCHAT);
  });

  it("leva o arquivo e o erro, pra Dani não precisar perguntar", () => {
    const msg = mensagemDeErroDeImportacao({ arquivo: "Nubank_2026-09.csv", problema: "só li 6 de 55 linhas" });
    expect(msg).toContain("Nubank_2026-09.csv");
    expect(msg).toContain("só li 6 de 55 linhas");
  });

  it("funciona sem arquivo nem erro conhecidos", () => {
    const msg = mensagemDeErroDeImportacao({});
    expect(msg).toContain(GATILHO_CONFIGURADO_NO_MANYCHAT);
    expect(msg).not.toContain("undefined");
    expect(msg).not.toContain("null");
  });
});

describe("linkDoSuporte", () => {
  it("monta o wa.me só com dígitos e com o texto escapado", () => {
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = "+55 11 93623-7276";
    const link = linkDoSuporte("oi tudo bem?");
    expect(link).toBe("https://wa.me/5511936237276?text=oi%20tudo%20bem%3F");
  });

  /** Sem número o botão some, em vez de virar um link quebrado. Foi o estado real do app. */
  it("devolve null quando não há número configurado", () => {
    expect(linkDoSuporte("oi")).toBeNull();
  });
});
