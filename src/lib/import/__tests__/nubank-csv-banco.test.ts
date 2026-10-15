import { describe, expect, it } from "vitest";
import { profileDocument } from "../profile";

describe("CSV da conta do Nubank", () => {
  it("o banco é o Nubank, mesmo com outro banco citado nas descrições", () => {
    // Cabeçalho do CSV do Nubank; linhas inventadas.
    const csv = [
      "Data,Valor,Identificador,Descrição",
      "01/10/2026,-10.00,00000000-0000-0000-0000-000000000001,Transferência enviada pelo Pix - LOJA EXEMPLO - BCO BRADESCO S.A.",
      "02/10/2026,150.00,00000000-0000-0000-0000-000000000002,Transferência recebida pelo Pix - FULANA - BANCO BRADESCO",
    ].join("\n");
    expect(profileDocument(csv, "NU_123.csv").institution).toBe("Nubank");
  });
});
