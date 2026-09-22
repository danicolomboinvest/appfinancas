import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractUploadFromForm, PasswordRequiredError } from "../extract-text";
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

function formDataComPdf(buffer: Buffer, nome = "extrato-ficticio.pdf", senha?: string): FormData {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(buffer)], nome, { type: "application/pdf" }));
  form.set("encoding", "pdf");
  if (senha !== undefined) form.set("password", senha);
  return form;
}

/**
 * Monta o MESMO PDF fictício, mas TRANCADO COM SENHA — do jeito que o Banco do Brasil e as
 * lojas mandam a fatura de cartão (pede CPF ou data de nascimento pra abrir).
 *
 * É o esquema de proteção mais antigo e mais comum do PDF (RC4 de 40 bits, revisão 2). Está
 * escrito à mão aqui porque não dá pra provar esse conserto com um arquivo de cliente: o
 * arquivo trancado de verdade é a fatura de alguém.
 */
const PAD = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00,
  0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = Buffer.alloc(data.length);
  let i = 0;
  j = 0;
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
    out[k] = data[k] ^ s[(s[i] + s[j]) & 0xff];
  }
  return out;
}

const md5 = (b: Buffer) => createHash("md5").update(b).digest();
const senhaPreenchida = (senha: string) => Buffer.concat([Buffer.from(senha, "latin1"), PAD]).subarray(0, 32);

function pdfFicticioComSenha(linhas: string[], senha: string): Buffer {
  const escapa = (s: string) => s.replace(/([\\()])/g, "\\$1");
  const conteudo = Buffer.from(
    `BT /F1 11 Tf 40 760 Td 14 TL\n${linhas.map((l) => `(${escapa(l)}) Tj T*`).join("\n")}\nET`,
    "latin1",
  );

  const id = Buffer.from("0123456789abcdef0123456789abcdef", "hex");
  const permissoes = -1;
  const O = rc4(md5(senhaPreenchida(senha)).subarray(0, 5), senhaPreenchida(senha));
  const p = Buffer.alloc(4);
  p.writeInt32LE(permissoes);
  const chave = md5(Buffer.concat([senhaPreenchida(senha), O, p, id])).subarray(0, 5);
  const U = rc4(chave, PAD);
  // A chave de cada objeto sai da chave do arquivo + o número do objeto (3 bytes) e a geração (2).
  const chaveDoObjeto = (num: number) =>
    md5(Buffer.concat([chave, Buffer.from([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, 0, 0])])).subarray(0, 10);
  const fluxo = rc4(chaveDoObjeto(4), conteudo);
  const hex = (b: Buffer) => b.toString("hex");

  const objetos: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "latin1"),
    Buffer.from(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
      "latin1",
    ),
    Buffer.concat([Buffer.from(`<< /Length ${fluxo.length} >>\nstream\n`, "latin1"), fluxo, Buffer.from("\nendstream", "latin1")]),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "latin1"),
    Buffer.from(`<< /Filter /Standard /V 1 /R 2 /O <${hex(O)}> /U <${hex(U)}> /P ${permissoes} >>`, "latin1"),
  ];

  const partes: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  const posicoes: number[] = [];
  let tamanho = partes[0].length;
  objetos.forEach((corpo, i) => {
    posicoes.push(tamanho);
    const bloco = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), corpo, Buffer.from("\nendobj\n", "latin1")]);
    partes.push(bloco);
    tamanho += bloco.length;
  });
  const total = objetos.length + 1;
  partes.push(
    Buffer.from(
      `xref\n0 ${total}\n0000000000 65535 f \n` +
        posicoes.map((pos) => `${String(pos).padStart(10, "0")} 00000 n \n`).join("") +
        `trailer\n<< /Size ${total} /Root 1 0 R /Encrypt 6 0 R /ID [<${hex(id)}> <${hex(id)}>] >>\n` +
        `startxref\n${tamanho}\n%%EOF\n`,
      "latin1",
    ),
  );
  return Buffer.concat(partes);
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

/**
 * Fatura de cartão em PDF quase sempre vem trancada. Em produção o app respondia "não consegui
 * ler PDF neste servidor, manda em CSV ou Excel" — e a pessoa ia procurar um arquivo que o
 * banco não oferece. Quatro tentativas da MESMA pessoa num dia só, todas nessa parede.
 */
describe("PDF protegido por senha", () => {
  const LINHAS = [
    "BANCO FICTICIO - FATURA DO CARTAO",
    "01/09/2026 MERCADO CENTRAL 89,90",
    "02/09/2026 POSTO DA ESQUINA 212,45",
  ];

  it("pede a senha em vez de dizer que o servidor não lê PDF", async () => {
    const form = formDataComPdf(pdfFicticioComSenha(LINHAS, "12345678909"), "fatura-trancada.pdf");
    const erro = await extractUploadFromForm(form).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(PasswordRequiredError);
    expect((erro as Error).message).toContain("protegido por senha");
  });

  it("com a senha certa, lê a fatura inteira", async () => {
    const form = formDataComPdf(pdfFicticioComSenha(LINHAS, "12345678909"), "fatura-trancada.pdf", "12345678909");

    const { text, source } = await extractUploadFromForm(form);

    expect(source).toBe("pdf");
    expect(text).toContain("MERCADO CENTRAL");
    const lancamentos = parseStatement(text, source);
    expect(lancamentos.map((l) => Math.abs(l.amount))).toEqual(expect.arrayContaining([89.9, 212.45]));
  });

  it("senha errada diz que é a senha, e deixa tentar de novo", async () => {
    const form = formDataComPdf(pdfFicticioComSenha(LINHAS, "12345678909"), "fatura-trancada.pdf", "00000000000");
    const erro = await extractUploadFromForm(form).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(PasswordRequiredError);
    expect((erro as Error).message).toContain("Senha incorreta");
  });
});
