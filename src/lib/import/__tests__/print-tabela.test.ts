import { describe, expect, it } from "vitest";
import { lerTabelaDaFatura } from "../print-tabela";
import type { Segmento } from "../print-fatura";

// Forma do print de 21/10/2026 (fatura Bradesco em PDF, "Histórico de despesas"); valores inventados.
const seg = (texto: string, x0: number, y0: number, x1 = x0 + 80): Segmento => ({ texto, x0, y0, x1, y1: y0 + 30 });
const PRINT: Segmento[] = [
  seg("Histórico de despesas", 101, 1228, 509),
  seg("Valor R$", 912, 1371), seg("Data", 101, 1372), seg("Descrição", 211, 1372),
  seg("12/05/26", 97, 1416), seg("LOJA EXEMPLO 05/10 SAO PAULO", 206, 1416, 588), seg("45,90", 974, 1417),
  seg("03/08/26", 97, 1458), seg("FARMACIA EXEMPLO DE X 03/06", 206, 1458, 652), seg("34,10", 973, 1458),
  seg("PAGAMENTO VIA QR CODE PIX", 206, 1543, 504), seg("15/09/26", 97, 1544),
  seg("29/09/26", 97, 1586), seg("PADARIA EXEMPLO", 206, 1585, 588), seg("20,00", 973, 1586),
  seg("TOTAL DESTE CARTÃO", 96, 1689, 438), seg("100,00", 933, 1695),
];

describe("print da fatura em PDF (22/10/2026)", () => {
  it("lê a tabela quando a soma fecha com o total do print", () => {
    const r = lerTabelaDaFatura(PRINT);
    expect(r?.totalDaFatura).toBe(100);
    expect(r?.linhas.map((l) => [l.data, l.nome, l.valor, l.parcela?.atual ?? null])).toEqual([
      ["2026-05-12", "LOJA EXEMPLO SAO PAULO", 45.9, 5],
      ["2026-08-03", "FARMACIA EXEMPLO DE X", 34.1, 3],
      ["2026-09-29", "PADARIA EXEMPLO", 20, null],
    ]);
  });

  it("não fechou (o OCR trocou um dígito): não lê nada", () => {
    expect(lerTabelaDaFatura(PRINT.map((s) => (s.texto === "20,00" ? { ...s, texto: "29,00" } : s)))).toBeNull();
  });

  it("sem total no print: não lê nada", () => {
    expect(lerTabelaDaFatura(PRINT.filter((s) => !/TOTAL|100,00/.test(s.texto)))).toBeNull();
  });
});
