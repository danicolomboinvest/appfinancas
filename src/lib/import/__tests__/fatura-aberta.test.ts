import { describe, expect, it } from "vitest";
import { casarComFaturaAberta, mesmaCompra, type CompraDoPrintGravada } from "../fatura-aberta";

/** Compras que entraram por prints da fatura aberta (nomes do app do banco, como o OCR leu). */
const doPrint: CompraDoPrintGravada[] = [
  { id: "p1", amount: 287.43, entryDate: "2026-10-12", year: 2026, month: 10, description: "Supermercado Bom Preço" },
  { id: "p2", amount: 8.5, entryDate: "2026-10-12", year: 2026, month: 10, description: "Café Grão Fino" },
  { id: "p3", amount: 8.5, entryDate: "2026-10-12", year: 2026, month: 10, description: "Café Grão Fino" },
  { id: "p4", amount: 150, entryDate: null, year: 2026, month: 10, description: "Loja Casa Nova - Parcela 2/3" },
  { id: "p5", amount: 56.8, entryDate: "2026-10-09", year: 2026, month: 10, description: "iFood Restaurante Sabor" },
  { id: "p6", amount: -89.9, entryDate: "2026-10-10", year: 2026, month: 10, description: "Estorno Loja Esporte Max" },
];

/** A fatura fechada do mesmo cartão: nomes do PDF, datas do processamento, e o que o print não tinha. */
const fechada = [
  { key: 0, date: "2026-10-13", description: "SUPERMERCADO BOM PRECO SAO PAULO", valor: 287.43 },
  { key: 1, date: "2026-10-12", description: "CAFE GRAO FINO", valor: 8.5 },
  { key: 2, date: "2026-10-12", description: "CAFE GRAO FINO", valor: 8.5 },
  { key: 3, date: "2026-09-11", description: "LOJA CASA NOVA PARC 02/03", valor: 150 },
  { key: 4, date: "2026-10-09", description: "IFD*RESTAURANTE SABOR", valor: 56.8 },
  { key: 5, date: "2026-10-10", description: "ESTORNO LOJA ESPORTE MAX", valor: -89.9 },
  { key: 6, date: "2026-10-14", description: "IOF COMPRA INTERNACIONAL", valor: 3.12 },
  { key: 7, date: "2026-10-15", description: "ANUIDADE DIFERENCIADA", valor: 35 },
  { key: 8, date: "2026-10-20", description: "PADARIA PAO DOURADO", valor: 23.5 },
];

describe("print da fatura aberta × fatura fechada", () => {
  const casados = casarComFaturaAberta(fechada, doPrint);

  it("as compras iguais casam e não entram de novo", () => {
    expect(casados.get(0)?.id).toBe("p1");
    expect(casados.get(4)?.id).toBe("p5");
    expect(casados.get(5)?.id).toBe("p6"); // o estorno também
  });
  it("dois cafés iguais casam com os dois do print, um cada", () => {
    expect(new Set([casados.get(1)?.id, casados.get(2)?.id])).toEqual(new Set(["p2", "p3"]));
  });
  it("parcela: a mesma N/T, mesmo com a data da compra original (agosto, parcela 3 em outubro)", () => {
    const p = { id: "px", amount: 99.9, entryDate: null, year: 2026, month: 10, description: "Ótica Visão 3/6" };
    expect(mesmaCompra({ key: 0, date: "2026-08-20", description: "OTICA VISAO PARC 03/06", valor: 99.9 }, p)).not.toBeNull();
  });
  it("parcela: a mesma N/T, no mês", () => {
    expect(casados.get(3)?.id).toBe("p4");
  });
  it("só entra o que faltava: IOF, anuidade e a compra depois do último print", () => {
    expect([6, 7, 8].map((k) => casados.has(k))).toEqual([false, false, false]);
    expect(casados.size).toBe(6);
  });
});

describe("mesmaCompra", () => {
  const g = doPrint[0];
  it("data até 2 dias", () => {
    expect(mesmaCompra({ key: 0, date: "2026-10-14", description: "Supermercado Bom Preço", valor: 287.43 }, g)).not.toBeNull();
    expect(mesmaCompra({ key: 0, date: "2026-10-15", description: "Supermercado Bom Preço", valor: 287.43 }, g)).toBeNull();
  });
  it("valor diferente não casa (até 1% quando o nome bate, o OCR troca um centavo)", () => {
    expect(mesmaCompra({ key: 0, date: "2026-10-12", description: "Supermercado Bom Preço", valor: 287.48 }, g)).not.toBeNull();
    expect(mesmaCompra({ key: 0, date: "2026-10-12", description: "Supermercado Bom Preço", valor: 297.43 }, g)).toBeNull();
  });
  it("nome diferente não casa, mesmo com valor e dia iguais", () => {
    expect(mesmaCompra({ key: 0, date: "2026-10-12", description: "POSTO ESTRADA REAL", valor: 287.43 }, g)).toBeNull();
  });
  it("parcela seguinte não é a mesma", () => {
    expect(mesmaCompra({ key: 0, date: "2026-11-11", description: "LOJA CASA NOVA PARC 03/03", valor: 150 }, doPrint[3])).toBeNull();
  });
  it("crédito não casa com compra", () => {
    expect(mesmaCompra({ key: 0, date: "2026-10-10", description: "Estorno Loja Esporte Max", valor: 89.9 }, doPrint[5])).toBeNull();
  });
  it("print novo da mesma fatura (OCR leu uma letra diferente) casa com o print anterior", () => {
    expect(mesmaCompra({ key: 0, date: "2026-10-12", description: "Supermercado Bom Prego", valor: 287.43 }, g)).not.toBeNull();
  });
});

describe("a revisão só promete as parcelas seguintes quando a gravação lança", () => {
  it("fatura fechada: promete; print da fatura aberta: não (o print não projeta)", async () => {
    const { prometeParcelasSeguintes } = await import("../fatura-aberta");
    const p = { current: 2, total: 3, confident: true };
    expect(prometeParcelasSeguintes(p, false)).toBe(true);
    expect(prometeParcelasSeguintes(p, true)).toBe(false);
    expect(prometeParcelasSeguintes({ current: 3, total: 3, confident: true }, false)).toBe(false);
    expect(prometeParcelasSeguintes({ current: 2, total: 3, confident: false }, false)).toBe(false);
  });
});
