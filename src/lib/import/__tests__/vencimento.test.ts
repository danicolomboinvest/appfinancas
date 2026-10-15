import { describe, expect, it } from "vitest";
import { detectarVencimento } from "../vencimento";

// Textos FICTÍCIOS, no formato que o extrator de PDF devolve (rótulo e valor muitas vezes em
// linhas separadas).
describe("detectarVencimento", () => {
  it("rótulo e data em linhas separadas (Bradesco, Santander, Riachuelo)", () => {
    expect(detectarVencimento(["Resumo da fatura", "Vencimento", "10/10/2026", "Lançamentos"].join("\n"))).toBe("2026-10-10");
  });

  it("rótulo com dois-pontos na mesma linha", () => {
    expect(detectarVencimento("Data de vencimento: 05/11/2026\nTotal R$ 100,00")).toBe("2026-11-05");
    expect(detectarVencimento("Vence em 07/01/27")).toBe("2027-01-07");
  });

  it("fatura do Nubank: 'FATURA 14 SET 2026' no topo", () => {
    expect(detectarVencimento("FATURA 14 SET 2026 EMISSÃO E ENVIO 07 SET 2026\nTRANSAÇÕES DE 07 AGO A 07 SET")).toBe("2026-09-14");
  });

  it("mês por extenso", () => {
    expect(detectarVencimento("Vencimento: 15 de março de 2027")).toBe("2027-03-15");
  });

  it("vale o primeiro vencimento do arquivo, não o do parcelamento lá embaixo", () => {
    const texto = ["Vencimento", "10/10/2026", "...", "Parcelamento da fatura: vencimento 10/11/2026"].join("\n");
    expect(detectarVencimento(texto)).toBe("2026-10-10");
  });

  it("não inventa: sem a palavra vencimento, nada", () => {
    expect(detectarVencimento("12/09/2026 IFOOD 45,90\n13/09/2026 UBER 18,50")).toBeNull();
    expect(detectarVencimento("EMISSÃO E ENVIO 07 SET 2026")).toBeNull();
  });

  it("data impossível não vira sugestão", () => {
    expect(detectarVencimento("Vencimento 31/02/2026")).toBeNull();
    expect(detectarVencimento("Vencimento 10/13/2026")).toBeNull();
  });
});

describe("detectarVencimento: quando a fatura não escreve a data completa", () => {
  it("BTG/EQI: 'Vencimento: 17/06' sem ano, o ano vem de 'fatura de Junho de 2026'", () => {
    const texto = "Fulana | fatura de Junho de 2026 | cartão final 0000\nVencimento: 17/06\nPagamento mínimo: R$ 10,00";
    expect(detectarVencimento(texto)).toBe("2026-06-17");
  });

  it("planilha da fatura BTG: 'Vencimento;;17/06' com o ano do 'Junho/2026' do topo", () => {
    const csv = ["Fatura Cartão de Crédito;;;;;Junho/2026;", ";;;;;;", "Fatura Atual;;;;Resumo;;", "Período de Compras;;13/05 até 13/06;;Lançamentos Nacionais;;R$ 1,000.00 ", "Vencimento;;17/06;;Lançamentos Internacionais;;R$ 0.00 "].join("\n");
    expect(detectarVencimento(csv, "fatura jul.xlsx")).toBe("2026-06-17");
  });

  it("fatura de dezembro que vence em janeiro fica no ano seguinte", () => {
    expect(detectarVencimento("fatura de Dezembro de 2026\nVencimento: 10/01")).toBe("2027-01-10");
  });

  it("sem ano em lugar nenhum do arquivo, não chuta", () => {
    expect(detectarVencimento("Vencimento: 17/06\n12/05 LOJA 10,00")).toBeNull();
  });

  it("planilha: 'Vencimento' é título de coluna e a data vem na linha de baixo (Itaú)", () => {
    const texto = ";Cartão;;;;;Valor;;Vencimento;\n;Visa Exemplo - final 0000;;;;;R$ 1,234.56;;06/10/2026;";
    expect(detectarVencimento(texto)).toBe("2026-10-06");
  });

  it("fatura aberta do Itaú: 'Valor (parcial) Vencimento' e os dois na linha de baixo", () => {
    expect(detectarVencimento("Valor (parcial) Vencimento\n6.287,65 03/11/2026")).toBe("2026-11-03");
  });

  it("coluna 'Vencimento' de investimento (posição do C6) não é vencimento de fatura", () => {
    const texto = "Produto;Instituição;Emissor;Indexador;Vencimento;Valor\nCDB;Banco;Banco;CDI;30/03/2027;1.000,00";
    expect(detectarVencimento(texto)).toBeNull();
  });

  it("CSV do Nubank só tem data, nome e valor: o vencimento está no nome do arquivo", () => {
    const csv = "date,title,amount\n2026-10-03,Loja Exemplo,\"14,30\"";
    expect(detectarVencimento(csv, "Nubank_2026-10-17.csv")).toBe("2026-10-17");
    expect(detectarVencimento(csv, "Fatura2026-11-05.csv")).toBe("2026-11-05");
    expect(detectarVencimento(csv, "2026-06-17_Fatura_Fulana_0000_BTG.pdf")).toBe("2026-06-17");
    expect(detectarVencimento(csv, "Fatura_05-10-2026.pdf")).toBe("2026-10-05");
  });

  it("a hora do download no nome do arquivo não é vencimento", () => {
    expect(detectarVencimento("12/09/2026 IFOOD 45,90", "Fatura_Itau_20261011-132518.pdf")).toBeNull();
    expect(detectarVencimento("12/09/2026 IFOOD 45,90", "extrato.csv")).toBeNull();
  });

  it("o que está escrito no arquivo vale mais que o nome dele", () => {
    expect(detectarVencimento("Vencimento: 10/10/2026", "Nubank_2026-09-17.csv")).toBe("2026-10-10");
  });
});

