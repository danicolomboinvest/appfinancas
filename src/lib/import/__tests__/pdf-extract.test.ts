import { describe, expect, it } from "vitest";
import { extractUploadFromForm } from "../extract-text";
import { parseStatement } from "../statement-parser";

/**
 * Monta um PDF FICTÍCIO de verdade (nada de dado de cliente): o mínimo que o pdfjs aceita,
 * com as linhas escritas como texto de página. Serve pra provar que o caminho do PDF vai do
 * arquivo até o texto — foi exatamente esse caminho que quebrou em produção quando o arquivo
 * do worker do pdfjs não foi junto no deploy, e nenhum teste pegou.
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

function formDataComPdf(buffer: Buffer, nome = "extrato-ficticio.pdf"): FormData {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(buffer)], nome, { type: "application/pdf" }));
  form.set("encoding", "pdf");
  return form;
}

describe("leitura de PDF", () => {
  it("tira o texto de um extrato em PDF e chega nos lançamentos", async () => {
    const form = formDataComPdf(
      pdfFicticio([
        "BANCO FICTICIO - EXTRATO CONTA CORRENTE",
        "01/09/2026 PIX RECEBIDO ALUGUEL 1.234,56",
        "02/09/2026 MERCADO CENTRAL -89,90",
        "03/09/2026 CONTA DE LUZ -212,45",
      ]),
    );

    const { text, source } = await extractUploadFromForm(form);

    expect(source).toBe("pdf");
    expect(text).toContain("BANCO FICTICIO");
    expect(text).toContain("PIX RECEBIDO ALUGUEL");

    const lancamentos = parseStatement(text, source);
    expect(lancamentos.length).toBeGreaterThanOrEqual(3);
    expect(lancamentos.map((l) => l.amount)).toEqual(expect.arrayContaining([1234.56, -89.9, -212.45]));
  });

  it("não devolve texto vazio num PDF com conteúdo (o sintoma de quando o leitor não sobe)", async () => {
    const { text } = await extractUploadFromForm(formDataComPdf(pdfFicticio(["LINHA UNICA 10,00"])));
    expect(text.replace(/[^\p{L}\p{N}]/gu, "").length).toBeGreaterThan(8);
  });
});
