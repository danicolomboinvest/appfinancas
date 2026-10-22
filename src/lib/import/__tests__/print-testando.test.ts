import { describe, expect, it } from "vitest";
import { lerPrintTestando, lerQualquerPrint, remendarDatas } from "../print-testando";
import type { Segmento } from "../print-fatura";

// Forma do print de 21/10/2026: a página da fatura com as compras à esquerda e o resumo à direita,
// na mesma altura (valores e nomes inventados).
const seg = (texto: string, x0: number, y0: number, x1 = x0 + 60): Segmento => ({ texto, x0, y0, x1, y1: y0 + 20 });
const DIREITA = (y: number, texto: string, valor: string) => [seg(texto, 631, y, 840), seg(valor, 976, y, 1017)];
const PAGINA: Segmento[] = [
  seg("Data", 57, 1819, 87), seg("Lançamentos", 115, 1819, 300), seg("Valor R$", 520, 1819, 570),
  ...DIREITA(1819, "Resumo", "R$"),
  seg("12/05/26", 54, 1844, 97), seg("LOJA EXEMPLO 05/10", 115, 1843, 328), seg("45,90", 544, 1844, 570), ...DIREITA(1846, "Saldo anterior", "300,00"),
  seg("030826", 54, 1890, 97), seg("FARMACIA EXEMPLO 03/06", 115, 1890, 332), seg("34,10", 544, 1890, 570), ...DIREITA(1890, "Total de compras", "100,00"),
  seg("15/09/26", 54, 1915, 97), seg("PAGAMENTO VIA OR CODE PIX", 115, 1915, 330), seg("300,00", 537, 1915, 569),
  seg("2909/26", 54, 1963, 97), seg("PADARIA EXEMPLO", 115, 1962, 289), seg("20,00", 544, 1963, 570), ...DIREITA(1978, "Encargos", "0,00"),
  seg("TOTAL DESTE CARTÃO", 54, 1996, 244), seg("100,00", 520, 1999, 570), ...DIREITA(2001, "Total a pagar", "100,00"),
  ...DIREITA(2048, "Limite total", "2.000,00"), ...DIREITA(2112, "Total", "1.900,00"),
];

describe("print da página do PDF com duas colunas (22/10/2026)", () => {
  it("data sem barra vira data", () => {
    expect(remendarDatas([seg("030826", 0, 0), seg("2909/26", 0, 0), seg("123456", 0, 0)]).map((s) => s.texto)).toEqual(["03/08/26", "29/09/26", "123456"]);
  });
  it("separa as colunas e fecha com o total, sem o pagamento da anterior", () => {
    const r = lerPrintTestando(PAGINA, "2026-10-21");
    expect(r?.linhas.map((l) => [l.data, l.valor])).toEqual([
      ["2026-05-12", 45.9],
      ["2026-08-03", 34.1],
      ["2026-09-29", 20],
    ]);
  });
  it("valor trocado pelo OCR: não fecha, não lê", () => {
    expect(lerQualquerPrint(PAGINA.map((s) => (s.texto === "20,00" ? { ...s, texto: "30,00" } : s)), "2026-10-21")).toBeNull();
  });
});
