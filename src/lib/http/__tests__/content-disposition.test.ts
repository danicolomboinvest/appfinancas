import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { contentDispositionAttachment } from "../content-disposition";

/** O download do admin quebrava (500) com nome vindo do iPhone/Mac, travessão ou emoji. */
describe("Content-Disposition do download", () => {
  const nomes = [
    "Extrato marc\u0327o.pdf", // NFD, como o iPhone manda
    "Extrato março.pdf",
    "fatura – set.pdf",
    "extrato 💸.pdf",
    'nome "com aspas"\r\n.pdf',
    "corte no meio \uD83D.pdf",
  ];

  it.each(nomes)("monta um cabeçalho que o NextResponse aceita: %s", (nome) => {
    const valor = contentDispositionAttachment(nome);
    expect(() => new NextResponse("x", { headers: { "Content-Disposition": valor } })).not.toThrow();
    expect(valor).toMatch(/^[\x20-\x7E]+$/);
  });

  it("o nome ASCII tira o acento em vez de trocar por _", () => {
    expect(contentDispositionAttachment("Extrato marc\u0327o.pdf")).toContain('filename="Extrato marco.pdf"');
  });

  it("o nome original volta inteiro pelo filename*", () => {
    const valor = contentDispositionAttachment("fatura – set.pdf");
    const codificado = valor.split("filename*=UTF-8''")[1];
    expect(decodeURIComponent(codificado)).toBe("fatura – set.pdf");
  });

  it("aspas e quebra de linha não escapam do filename", () => {
    expect(contentDispositionAttachment('a"b\r\nc.pdf')).toContain('filename="ab__c.pdf"');
  });
});
