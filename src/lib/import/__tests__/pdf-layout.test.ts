import { describe, expect, it } from "vitest";
import { escolherTextoDoPdf } from "../escolher-texto-do-pdf";
import { extractUploadFromForm } from "../extract-text";
import { isFaturaSummaryLine } from "../fatura-lines";
import { inicioDasColunas, remendarPedaco, temEspacoFalso, textoPorLayout, type PaginaDoPdf, type PedacoComTamanho } from "../pdf-layout";
import { parseStatementComLeitor } from "../statement-parser";

/**
 * Fatura FICTÍCIA de um "Banco Exemplo" em duas colunas, montada pedaço a pedaço como o PDF
 * guarda: cada pedaço com a posição na página. A ordem dos pedaços é a do arquivo real que
 * motivou isto (23/10/2026): linha a linha, as duas colunas emendadas, e o número com espaço
 * dentro ("120 ,00").
 */
const fs = 6.3;
const p = (str: string, x: number, y: number, w = str.length * 3): PedacoComTamanho => ({ str, x, y, w, fs });
const ESQ = 140;
const DIR = 360;

function compra(x: number, y: number, data: string, loja: string, valor: string, cidade: string): PedacoComTamanho[] {
  return [p(data, x, y, 15), p(loja, x + 28, y, 70), p(valor, x + 175, y, 18), p(cidade, x + 28, y - 9, 50)];
}

function faturaEmDuasColunas(): PaginaDoPdf[] {
  const cabeca = [
    p("BANCO EXEMPLO S.A. - Fatura do cartão", 40, 800, 150),
    p("Vencimento: 10/10/2026", 40, 790, 80),
    p("Total da fatura", 400, 800, 50),
    p("R$ 355,90", 470, 800, 30),
    p("La nça me nt os : co m pr as e sa qu es", ESQ, 720, 120),
    p("La nça me nt os : co m pr as e sa qu es", DIR, 720, 120),
  ];
  // Linha a linha, esquerda e direita emendadas, como o arquivo guarda.
  const linhas = [
    ...compra(ESQ, 700, "02/09", "LOJA UM", "120 ,00", "SAO PAULO"),
    ...compra(DIR, 700, "05/09", "MERCADO DOIS", "45,9 0", "CAMPINAS"),
    ...compra(ESQ, 680, "03/09", "FARMACIA TRES", "80,00", "SANTOS"),
    ...compra(DIR, 680, "06/09", "POSTO QUATRO", "60,00", "SANTOS"),
    ...compra(ESQ, 660, "04/09", "PADARIA CINCO", "40,00", "SAO PAULO"),
    ...compra(DIR, 660, "07/09", "CINEMA SEIS", "1 0,00", "CAMPINAS"),
  ];
  const futuro = [
    p("C om p ras p ar cel ad as - p ró x im as fa tur as", ESQ, 600, 140),
    ...compra(ESQ, 580, "02/09", "LOJA UM 02/03", "120,00", "SAO PAULO"),
  ];
  return [{ largura: 595, pedacos: [...cabeca, ...linhas, ...futuro] }];
}

/** O que a leitura de sempre faz: pedaço atrás de pedaço, uma linha por altura, sem colunas. */
function textoNaOrdemDoArquivo(paginas: PaginaDoPdf[]): string {
  const linhas = new Map<number, string[]>();
  for (const q of paginas[0].pedacos) linhas.set(q.y, [...(linhas.get(q.y) ?? []), q.str]);
  return [...linhas.entries()].sort((a, b) => b[0] - a[0]).map(([, v]) => v.join(" ")).join("\n");
}

const compras = (texto: string) => parseStatementComLeitor(texto, "pdf", 2026).txns.filter((t) => !isFaturaSummaryLine(t));

describe("PDF lido pela posição (colunas)", () => {
  it("tira o espaço de dentro do número, só quando o pedaço é só número", () => {
    expect(remendarPedaco("120 ,00")).toBe("120,00");
    expect(remendarPedaco("-9.999 ,99")).toBe("-9.999,99");
    expect(remendarPedaco("12 3,45")).toBe("123,45");
    expect(remendarPedaco("12/ 09")).toBe("12/09");
    expect(remendarPedaco("R$ 9.9 99 ,99 -")).toBe("R$ 9.999,99-");
    // Dois valores de verdade na mesma célula continuam separados.
    expect(remendarPedaco("45,90 12,00")).toBe("45,90 12,00");
    expect(remendarPedaco("LOJA 12 ,00")).toBe("LOJA 12 ,00");
  });

  it("junta o título com espaço falso, mas não o nome de loja com palavras curtas", () => {
    expect(temEspacoFalso("La nça me nt os : co m pr as e sa qu es")).toBe(true);
    expect(remendarPedaco("C om p ras p ar cel ad as - p ró x im as fa tur as")).toBe("Comprasparceladas - próximasfaturas");
    expect(temEspacoFalso("PAG E SA LOJA DO ZE")).toBe(false);
    expect(temEspacoFalso("Uber do Brasil")).toBe(false);
  });

  it("acha as duas colunas pelas datas alinhadas", () => {
    const [pagina] = faturaEmDuasColunas();
    expect(inicioDasColunas(pagina.pedacos, pagina.largura)).toEqual([ESQ, DIR]);
  });

  it("data da compra e data do lançamento lado a lado não são duas colunas", () => {
    const pedacos = [700, 680, 660].flatMap((y) => [p("02/09", 40, y), p("03/09", 70, y), p("LOJA", 100, y), p("10,00", 300, y)]);
    expect(inicioDasColunas(pedacos, 595)).toEqual([40]);
  });

  it("fatura em duas colunas: as 6 compras e a soma igual ao total, sem as parcelas futuras", () => {
    const paginas = faturaEmDuasColunas();
    const texto = textoPorLayout(paginas);
    const naOrdem = textoNaOrdemDoArquivo(paginas);
    // Na ordem do arquivo, as duas colunas saem emendadas e a leitura não confere.
    expect(escolherTextoDoPdf(naOrdem, texto, 2026)).toBe(texto);
    const lidas = compras(escolherTextoDoPdf(naOrdem, texto, 2026));
    expect(lidas.map((t) => [t.date, t.description, t.amount])).toEqual([
      ["2026-09-02", "LOJA UM", 120],
      ["2026-09-03", "FARMACIA TRES", 80],
      ["2026-09-04", "PADARIA CINCO", 40],
      ["2026-09-05", "MERCADO DOIS", 45.9],
      ["2026-09-06", "POSTO QUATRO", 60],
      ["2026-09-07", "CINEMA SEIS", 10],
    ]);
  });

  it("fica com a leitura de sempre quando ela já confere, e quando nenhuma confere", () => {
    const certo = ["BANCO EXEMPLO S.A. - Fatura do cartão", "Vencimento: 10/10/2026", "Total da fatura R$ 30,00", "Lançamentos", "02/09 LOJA UM 10,00", "03/09 LOJA DOIS 20,00"].join("\n");
    expect(escolherTextoDoPdf(certo, "qualquer outra coisa", 2026)).toBe(certo);
    const naoFecha = certo.replace("30,00", "99,00");
    expect(escolherTextoDoPdf(naoFecha, naoFecha.replace("20,00", "21,00"), 2026)).toBe(naoFecha);
  });
});

/** Um PDF FICTÍCIO de verdade com os pedaços nas posições da página, na ordem do arquivo real. */
function pdfComPedacos(pedacos: PedacoComTamanho[]): Buffer {
  const escapa = (t: string) => t.replace(/([\\()])/g, "\\$1");
  const conteudo = `BT /F1 ${fs} Tf\n${pedacos.map((q) => `1 0 0 1 ${q.x} ${q.y} Tm (${escapa(q.str)}) Tj`).join("\n")}\nET`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(conteudo, "latin1")} >>\nstream\n${conteudo}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const posicoes: number[] = [];
  objetos.forEach((corpo, i) => {
    posicoes.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${corpo}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf +=
    `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` +
    posicoes.map((q) => `${String(q).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

describe("PDF de duas colunas, do arquivo até as compras", () => {
  it("o leitor do app entrega a leitura por coluna e ela fecha com o total", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(pdfComPedacos(faturaEmDuasColunas()[0].pedacos))], "fatura-ficticia.pdf", { type: "application/pdf" }));
    form.set("encoding", "pdf");
    const { text, layout } = await extractUploadFromForm(form);
    expect(layout).toBeTruthy();
    const lidas = compras(escolherTextoDoPdf(text, layout, 2026));
    expect(lidas).toHaveLength(6);
    expect(Math.round(lidas.reduce((a, t) => a + t.amount, 0) * 100) / 100).toBe(355.9);
  });
});
