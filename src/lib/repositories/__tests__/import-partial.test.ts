import { describe, expect, it } from "vitest";
import { isPartialRead, safeHeader } from "../import-diagnostic.repo";

/**
 * A régua de "leu só parte do arquivo" decide DUAS coisas ao mesmo tempo: o que entra no
 * relatório diário e quando o arquivo da pessoa fica guardado pro suporte. Se as duas usassem
 * contas diferentes, o relatório acusaria uma leitura parcial cujo arquivo não foi guardado —
 * exatamente o buraco que fez a gente perder o arquivo da cliente do Itaú.
 */
describe("isPartialRead", () => {
  it("acusa quando leu menos da metade das linhas com valor", () => {
    expect(isPartialRead(210, 21)).toBe(true); // fatura do Itaú: 21 de 210
    expect(isPartialRead(124, 8)).toBe(true); // Ourocard do BB: 8 de 124
    expect(isPartialRead(55, 7)).toBe(true); // fatura do Nubank: 7 de 55
  });

  it("não acusa leitura que veio inteira ou quase", () => {
    expect(isPartialRead(38, 38)).toBe(false);
    expect(isPartialRead(94, 94)).toBe(false);
    expect(isPartialRead(10, 6)).toBe(false);
  });

  it("não acusa arquivo pequeno demais pra conclusão ter valor", () => {
    // Extrato com 3 linhas e 1 lida pode ser só um arquivo curto; não vale acordar ninguém.
    expect(isPartialRead(3, 1)).toBe(false);
    expect(isPartialRead(0, 0)).toBe(false);
  });

  it("na fronteira da metade, não acusa", () => {
    expect(isPartialRead(100, 50)).toBe(false);
    expect(isPartialRead(100, 49)).toBe(true);
  });
});

describe("safeHeader", () => {
  it("guarda a linha de cabeçalho mas apaga números longos (conta, cartão, CPF)", () => {
    expect(safeHeader("Fatura;00061613539380;2026-08")).toBe("Fatura;…;2026-08");
    expect(safeHeader("Data,Valor,Identificador,Descrição")).toBe("Data,Valor,Identificador,Descrição");
  });

  it("pula linhas em branco no começo e corta cabeçalho gigante", () => {
    expect(safeHeader("\n\n  \nData;Valor")).toBe("Data;Valor");
    expect(safeHeader("x".repeat(400))).toHaveLength(160);
  });
});
