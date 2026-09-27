import { describe, expect, it } from "vitest";
import { extractUploadFromForm } from "../extract-text";
import { parseStatement } from "../statement-parser";

/**
 * Um extrato em PDF de uma cliente chegou com um caractere NULO (código 0, invisível) no meio
 * do texto. A tela de revisão mostrou os 32 lançamentos normalmente, mas na hora de gravar o
 * banco de dados recusou ("invalid byte sequence for encoding UTF8: 0x00") e a importação
 * inteira caiu — 12 tentativas seguidas, nenhum lançamento salvo. Arquivo FICTÍCIO aqui.
 */
function pdfFicticio(linhas: string[]): Buffer {
  const escapa = (s: string) => s.replace(/([\\()])/g, "\\$1");
  const conteudo = `BT /F1 11 Tf 40 760 Td 14 TL\n${linhas.map((l) => `(${escapa(l)}) Tj T*`).join("\n")}\nET`;
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


function formDataCom(conteudo: Buffer | string, encoding: "pdf" | "text", nome: string): FormData {
  const form = new FormData();
  const bytes = typeof conteudo === "string" ? new TextEncoder().encode(conteudo) : new Uint8Array(conteudo);
  form.set("file", new File([bytes], nome));
  form.set("encoding", encoding);
  return form;
}

describe("caractere nulo no arquivo", () => {
  it("PDF: o texto sai limpo e os lançamentos continuam sendo lidos", async () => {
    const pdf = pdfFicticio([
      "BANCO FICTICIO - EXTRATO CONTA CORRENTE",
      "01/09/2026 PIX RECEBIDO\\000 ALUGUEL 1.234,56",
      "02/09/2026 MERCADO\\000 CENTRAL -89,90",
    ]);
    const { text, source } = await extractUploadFromForm(formDataCom(pdf, "pdf", "extrato-ficticio.pdf"));

    expect(text).not.toContain("\u0000");
    const lancamentos = parseStatement(text, source);
    expect(lancamentos.map((l) => l.amount)).toEqual(expect.arrayContaining([1234.56, -89.9]));
    for (const l of lancamentos) expect(l.description).not.toContain("\u0000");
  });

  it("CSV: o nulo some e a descrição fica gravável", async () => {
    const csv = "Data;Descrição;Valor\n01/09/2026;PADARIA\u0000 DO BAIRRO;-12,50\n02/09/2026;SALARIO\u0000;3.000,00\n";
    const { text, source } = await extractUploadFromForm(formDataCom(csv, "text", "extrato-ficticio.csv"));

    expect(text).not.toContain("\u0000");
    const lancamentos = parseStatement(text, source);
    expect(lancamentos.map((l) => l.description)).toEqual(expect.arrayContaining([expect.stringContaining("PADARIA")]));
    for (const l of lancamentos) expect(l.description).not.toContain("\u0000");
  });
});
