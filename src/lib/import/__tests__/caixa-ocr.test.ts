import { describe, expect, it } from "vitest";
import { isCaixaOcrStatement, parseCaixaOcrStatement } from "../caixa-ocr";
import { OCR_MARCA } from "../ocr-marca";
import { parseStatementComLeitor } from "../statement-parser";

// Amostra FICTÍCIA, no formato do "Extrato por período" da Caixa lido por OCR (mais novo primeiro).
const cabecalho = [
  OCR_MARCA,
  "CAIXA",
  "Extrato por período",
  "Cliente        FULANA EXEMPLO",
  "SALDO ANTERIOR            R$ 1.000,00 C",
  "Lançamentos   Nr. Doc   Histórico/Complemento   Favorecido   CPF/CNPJ   Valor   Saldo",
];

function texto(linhas: string[]): string {
  return [...cabecalho, ...linhas].join("\n");
}

describe("Caixa lida por OCR, conferida pelo saldo", () => {
  const certas = [
    "30/09/2026 - 00:00:00   000000   SALDO DIA     0,00 C    1.700,00 C",
    "30/09/2026 - 10:00:00   300001   DEB PIX CHAVE   Padaria Exemplo   **633.810/0**   50,00 D   1.700,00 C",
    "20/09/2026 - 09:00:00   200001   PIX RECEBIDO DADOS CONTA   Fulana   ***.694.506   750,00 C   1.750,00 C",
    "01/09/2026 - 08:00:00   010001   CREDITO SALARIO   Empresa   **489.828/0**   0,00 C   1.000,00 C",
  ];

  it("reconhece o formato e lê pela variação do saldo", () => {
    const t = texto(certas);
    expect(isCaixaOcrStatement(t)).toBe(true);
    const r = parseCaixaOcrStatement(t);
    expect(r.map((x) => x.amount)).toEqual([750, -50]);
    expect(r[0].date).toBe("2026-09-20");
  });

  it("corrige valor sem vírgula e valor com 1 dígito trocado pelo saldo", () => {
    const t = texto([
      "30/09/2026 - 10:00:00   300001   DEB PIX CHAVE   Padaria   5000 D   1.700,00 C",
      "20/09/2026 - 09:00:00   200001   PIX RECEBIDO   Fulana   760,00 C   1.750,00 C",
    ]);
    expect(parseCaixaOcrStatement(t).map((x) => x.amount)).toEqual([750, -50]);
  });

  it("saldo lido errado não troca o valor certo", () => {
    const t = texto([
      "30/09/2026 - 10:00:00   300001   DEB PIX CHAVE   Padaria   50,00 D   1.700,00 C",
      "20/09/2026 - 09:00:00   200001   PIX RECEBIDO   Fulana   750,00 C   1.760,00 C",
    ]);
    // saldo de 20/09 lido 1.760 (era 1.750): a variação erra +10 aqui e -10 na linha seguinte
    expect(parseCaixaOcrStatement(t).map((x) => x.amount)).toEqual([750, -50]);
  });

  it("linha perdida pelo OCR: devolve nada em vez de número que não fecha", () => {
    const t = texto([
      "30/09/2026 - 10:00:00   300001   DEB PIX CHAVE   Padaria   50,00 D   1.700,00 C",
      // faltou a linha de 20/09 (750,00 C)
      "01/09/2026 - 08:00:00   010001   CREDITO SALARIO   Empresa   0,01 C   1.000,01 C",
    ]);
    expect(parseCaixaOcrStatement(t)).toEqual([]);
  });

  it("\"C\" lido como \"€\" no saldo não derruba a linha (nem o extrato inteiro)", () => {
    const t = texto([
      "30/09/2026 - 10:00:00   300001   DEB PIX CHAVE   Padaria   50,00 D   1.700,00€",
      "20/09/2026 - 09:00:00   200001   PIX RECEBIDO   Fulana   750,00 C   1.750,00 C",
    ]);
    expect(parseCaixaOcrStatement(t).map((x) => x.amount)).toEqual([750, -50]);
  });

  it("texto com marca de imagem nunca cai nos leitores genéricos", () => {
    const r = parseStatementComLeitor(`${OCR_MARCA}\nPIX 10/09/2026 100,00 200,00\n`, "pdf");
    expect(r.txns).toEqual([]);
  });
});
