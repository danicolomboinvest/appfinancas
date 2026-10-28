import { describe, expect, it } from "vitest";
import { extractUploadFromForm } from "../extract-text";

/** PDF FICTÍCIO mínimo, com uma linha de texto. */
function pdfFicticio(linha: string): Buffer {
  const conteudo = `BT /F1 11 Tf 40 760 Td (${linha}) Tj ET`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const posicoes: number[] = [];
  objetos.forEach((corpo, i) => {
    posicoes.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${corpo}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf +=
    `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` +
    posicoes.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

describe("PDF enviado sem extensão", () => {
  it("lê como PDF mesmo chegando marcado como texto", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(pdfFicticio("05/10 MERCADO EXEMPLO 42,90"))], "fatura outubro"));
    form.set("encoding", "text");
    const { text, source } = await extractUploadFromForm(form);
    expect(source).toBe("pdf");
    expect(text).toContain("MERCADO EXEMPLO");
    expect(text).not.toContain("%PDF");
  });

  it("CSV comum continua sendo lido como texto", async () => {
    const form = new FormData();
    form.set("file", new File(["Data;Descricao;Valor\n05/10/2026;Mercado;-42,90\n"], "extrato.csv"));
    form.set("encoding", "text");
    const { text, source } = await extractUploadFromForm(form);
    expect(source).toBe("auto");
    expect(text).toContain("Mercado");
  });
});
