import { describe, expect, it } from "vitest";
import { hojeParaOPrint, INSTRUCAO_PRINT, MSG_FOTO_SEM_FATURA, pareceImagemPelosBytes, qualLeitor } from "../foto-no-lugar-do-pdf";

/**
 * Foto no lugar do PDF (30/10/2026): 31 pessoas subiram uma imagem (ou um PDF só imagem) onde o
 * app esperava o arquivo do banco, 77 vezes em 14 dias. A decisão de qual leitor usar fica aqui.
 */

const bytes = (...b: (number | string)[]) => {
  const out: number[] = [];
  for (const x of b) typeof x === "string" ? out.push(...[...x].map((c) => c.charCodeAt(0))) : out.push(x);
  while (out.length < 16) out.push(0);
  return new Uint8Array(out);
};

describe("qual leitor lê o arquivo", () => {
  it("imagem pela extensão, pelo tipo ou pelos bytes vai para o leitor de print", () => {
    expect(qualLeitor({ nome: "IMG_2041.jpg", tipo: "" })).toBe("print");
    expect(qualLeitor({ nome: "fatura.JPEG", tipo: "" })).toBe("print");
    expect(qualLeitor({ nome: "IMG_2041.HEIC", tipo: "" })).toBe("print");
    expect(qualLeitor({ nome: "print.png", tipo: "application/octet-stream" })).toBe("print");
    expect(qualLeitor({ nome: "arquivo", tipo: "image/webp" })).toBe("print");
    // "IMG_1234" sem extensão e sem tipo: os primeiros bytes dizem.
    expect(qualLeitor({ nome: "IMG_1234", tipo: "", bytes: bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a) })).toBe("print");
    expect(qualLeitor({ nome: "IMG_1234", tipo: "", bytes: bytes(0xff, 0xd8, 0xff, 0xe0) })).toBe("print");
    expect(qualLeitor({ nome: "IMG_1234", tipo: "", bytes: bytes(0, 0, 0, 0x18, "ftypheic") })).toBe("print");
  });

  it("PDF, CSV, OFX e Excel seguem pelos leitores de texto", () => {
    expect(qualLeitor({ nome: "Nubank_2026-10-05.pdf", tipo: "application/pdf", bytes: bytes("%PDF-1.7") })).toBe("arquivo");
    expect(qualLeitor({ nome: "extrato.csv", tipo: "text/csv", bytes: bytes("Data;Descr") })).toBe("arquivo");
    expect(qualLeitor({ nome: "extrato.ofx", tipo: "" })).toBe("arquivo");
    expect(qualLeitor({ nome: "fatura.xlsx", tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })).toBe("arquivo");
    expect(qualLeitor({ nome: null, tipo: null })).toBe("arquivo");
  });

  it("PDF que é só imagem (sem texto) vai para o leitor de print", () => {
    expect(qualLeitor({ nome: "fatura.pdf", tipo: "application/pdf", pdfSoImagem: true })).toBe("print");
  });

  it("bytes curtos ou de texto não são imagem", () => {
    expect(pareceImagemPelosBytes(new Uint8Array([0x89, 0x50]))).toBe(false);
    expect(pareceImagemPelosBytes(bytes("Data;Descricao;Valor"))).toBe(false);
    expect(pareceImagemPelosBytes(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe(true);
  });
});

describe("os textos", () => {
  it("a mensagem de erro é curta e diz o que mandar", () => {
    expect(MSG_FOTO_SEM_FATURA).toContain("Mande o PDF do banco ou um print da tela do app, sem zoom, uma tela por vez");
    expect(MSG_FOTO_SEM_FATURA.length).toBeLessThan(140);
    expect(MSG_FOTO_SEM_FATURA).not.toMatch(/—/);
  });

  it("a instrução do print é uma linha só", () => {
    expect(INSTRUCAO_PRINT).toBe("Print da tela do app do banco, sem zoom, uma tela por vez");
  });

  it("a data de envio do print é o dia de hoje em Brasília", () => {
    expect(hojeParaOPrint(new Date("2026-10-30T01:30:00Z"))).toBe("2026-10-29");
    expect(hojeParaOPrint(new Date("2026-10-30T12:00:00Z"))).toBe("2026-10-30");
  });
});
