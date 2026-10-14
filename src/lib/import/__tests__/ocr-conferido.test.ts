import { describe, expect, it } from "vitest";
import { OCR_MARCA } from "../ocr-marca";
import { parseStatementComLeitor } from "../statement-parser";
import { textoEmbaralhado } from "../pdf-quality";
import { pixelsEmCinza } from "../ocr";

// Amostras FICTÍCIAS no jeito que o OCR devolve os extratos (13/10/2026).

const nubank = (saidaDoDia2: string) =>
  [
    OCR_MARCA,
    "Fulana Exemplo",
    "NU      CPF ---.000.000--- Agência 0001 Conta",
    "O1 DE OUTUBRO DE 2026 a 10 DE OUTUBRO DE 2026        VALORES EM R$",
    "Saldo inicial        1.000,00",
    "Movimentações",
    "02OUT2026  Totalde entradas                          + 2.500,00",
    "Transferência recebida pelo Pix    FULANA EXEMPLO - +.-.000.000-+ -      2.000,00",
    "Resgate RDB                                                        500,00",
    "Total de saídas                                                  - 1.247,20",
    "Pagamento de boleto efetuado      IMOBILIARIA EXEMPLO             1.200,00",
    `Compra no débito                   CHURRASCARIA EXEMPLO             ${saidaDoDia2}`,
    "O4OUT2026  Totalde saídas                                         -40,00",
    "Transferência enviada pelo Pix     CICRANO - «+..000.000- - CC       40,00",
  ].join("\n");

describe("Nubank lido por OCR, conferido pelos totais do dia", () => {
  it("lê quando cada dia fecha com o total impresso", () => {
    const r = parseStatementComLeitor(nubank("47,20"), "pdf");
    expect(r.leitor).toBe("nubank-ocr");
    expect(r.txns.map((t) => [t.date, t.amount])).toEqual([
      ["2026-10-02", 2000],
      ["2026-10-02", 500],
      ["2026-10-02", -1200],
      ["2026-10-02", -47.2],
      ["2026-10-04", -40],
    ]);
  });

  it("um dígito trocado pelo OCR: não sai nada", () => {
    expect(parseStatementComLeitor(nubank("47,26"), "pdf").txns).toEqual([]);
  });
});

const itau = (valor: string, extra = "") =>
  [
    OCR_MARCA,
    "saldo em conta        Limite da Conta utilizado",
    "extrato conta / lançamentos",
    "período de visualização: 13/09/2026 até 13/10/2026          emitido em: 13/10/2026",
    "data               lançamentos                          valor (R$)              saldo (R$)",
    "13/10/2026 PAY PADARIA 12/10                                -6,50",
    `13/10/2026  PIXTRANSF FULANA13/10                          ${valor}`,
    "13/10/2026 SALDO DO DIA                                                         1.293,52",
    "09/10/2026 PAY MERCADO 09/10                                -69,95",
    "09/10/2026  REND PAGO APLIC AUT APR                          0,01",
    "09/10/2026 SALDO DO DIA                                                         1.000,00",
    "07/10/2026 PAY LANCHE 07/10                                 -16,00",
    extra,
    "07/10/2026 SALDO DO DIA                                                         1.069,94",
    "06/10/2026 PAGTO SALARIO                                    1.000,00",
    "06/10/2026 SALDO DO DIA                                                         1.085,94",
  ].join("\n");

describe("Itaú lido por OCR, conferido pelo saldo do dia", () => {
  it("lê quando cada dia fecha (no dia da emissão, até 5 centavos de rendimento a mais)", () => {
    const r = parseStatementComLeitor(itau("300,00"), "pdf");
    expect(r.leitor).toBe("itau-ocr");
    expect(r.txns.map((t) => t.amount)).toEqual([-6.5, 300, -69.95, 0.01, -16, 1000]);
  });

  it("valor trocado ou linha sem valor: não sai nada", () => {
    expect(parseStatementComLeitor(itau("360,00"), "pdf").txns).toEqual([]);
    expect(parseStatementComLeitor(itau("300,00", "07/10/2026 PIXTRANSF SEM VALOR"), "pdf").txns).toEqual([]);
  });
});

describe("texto embaralhado pela fonte do PDF", () => {
  it("reconhece a cifra e não confunde com texto normal", () => {
    const cifra = Array.from({ length: 30 }, () => ",,:: \t9.'8,,,: \t!. 30@0 \t90;F0:4;@<? \tB09<>' \t?093<'").join("\n");
    expect(textoEmbaralhado(cifra)).toBe(true);
    const normal = Array.from({ length: 30 }, () => "13/10/2026 PIX TRANSF FULANA -16,00 saldo (R$) data valor (R$) conta").join("\n");
    expect(textoEmbaralhado(normal)).toBe(false);
  });
});

describe("página em cinza antes do OCR", () => {
  it("vermelho e verde viram escuros, o fundo claro vira branco", () => {
    const px = new Uint8ClampedArray([200, 30, 40, 255, 20, 140, 60, 255, 245, 245, 245, 255, 0, 0, 0, 255]);
    pixelsEmCinza(px);
    expect([px[0], px[4], px[8], px[12]]).toEqual([30, 20, 255, 0]);
  });
});
