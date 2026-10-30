import { describe, expect, it } from "vitest";
import { lerPrint, type Segmento } from "../print-fatura";
import { dimensoesDaImagem, juntarColunaDaDireita } from "../ocr-print";

/**
 * 24/10/2026: 9 prints de uma cliente numa noite, todos "Não consegui ler este print". O OCR lia a
 * data e o nome de cada compra e pulava a coluna dos valores (cinza claro, na direita). Lida
 * sozinha, a coluna aparece, na altura da data. Geometria copiada do print (1320 px de largura),
 * com nomes e valores de mentira.
 */
const seg = (texto: string, x0: number, y0: number, x1: number): Segmento => ({ texto, x0, y0, x1, y1: y0 + 40 });
const ITENS: [string, string, string][] = [
  ["15/10", "Padaria Central SP 12 10", "23,50"],
  ["15/10", "Farmacia Boa 04 10", "189,90"],
  ["16/10", "Pagamento Fatura 10 10", "500,00"],
  ["17/10", "Mercado Bom 01 03", "312,45"],
];
const primeira: Segmento[] = [seg("Movimentações nacionais em reais (R$)", 49, 393, 1059)];
const direita: Segmento[] = [seg("em reais (R$)", 726, 393, 1059)];
ITENS.forEach(([d, nome, v], i) => {
  const y = 516 + i * 255;
  primeira.push(seg(d, 51, y, 189), seg(nome, 48, y + 85, 640));
  direita.push(seg(v, 1180 - v.length * 22, y + 3, 1180));
});

describe("print com os valores apagados na direita", () => {
  it("sem a coluna da direita, nenhuma compra entra", () => {
    expect(lerPrint(primeira, "2026-10-24").linhas).toHaveLength(0);
  });

  it("com a coluna lida à parte, cada valor cai na compra da mesma altura e o pagamento fica de fora", () => {
    const juntos = juntarColunaDaDireita(primeira, direita);
    expect(juntos.filter((s) => s.texto === "em reais (R$)")).toHaveLength(0);
    const { linhas } = lerPrint(juntos, "2026-10-24");
    expect(linhas.map((l) => [l.nome, l.valor])).toEqual([
      ["Padaria Central SP 12 10", 23.5],
      ["Farmacia Boa 04 10", 189.9],
      ["Mercado Bom 01 03", 312.45],
    ]);
  });
});

describe("dimensoesDaImagem", () => {
  it("lê PNG e JPEG pelo cabeçalho", () => {
    const png = Buffer.alloc(32);
    png.writeUInt32BE(0x89504e47, 0);
    png.writeUInt32BE(1320, 16);
    png.writeUInt32BE(2868, 20);
    expect(dimensoesDaImagem(png)).toEqual({ largura: 1320, altura: 2868 });
    // SOI, um APP0 de 16 bytes, depois o SOF0 com altura 2868 e largura 1320.
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Array(14).fill(0), 0xff, 0xc0, 0x00, 0x11, 0x08, 0x0b, 0x34, 0x05, 0x28, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(dimensoesDaImagem(jpeg)).toEqual({ largura: 1320, altura: 2868 });
    expect(dimensoesDaImagem(Buffer.from("nada"))).toBeNull();
  });
});
