import { describe, expect, it } from "vitest";
import { parseCsv } from "../statement-parser";

// Amostra fictícia: extrato CSV com ";" cuja descrição vem em duas linhas dentro de aspas.
const CSV = [
  "Extrato de conta corrente",
  "Nome;Fulano",
  "Agência;0001",
  "Conta;00.000000.0",
  "Período do extrato;01/09/2026 a 18/10/2026",
  "",
  "Lançamentos:",
  "Data;Descrição;Valor;Saldo",
  '16/10/2026;"Pagamento a fornecedores\nEmpresa exemplo 00000000000000";344,00;400,00',
  '06/10/2026;"Mensalidade de seguro\nParc 019/036";-56,31;56,00',
  '05/10/2026;"Pix recebido\nBeltrano de tal";56,00;112,31',
].join("\n");

describe("CSV com descrição em duas linhas", () => {
  it("lê os lançamentos com o sinal do valor", () => {
    const r = parseCsv(CSV, 2026);
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ date: "2026-10-16", amount: 344 });
    expect(r[0].description).toBe("Pagamento a fornecedores Empresa exemplo 00000000000000");
    expect(r[1]).toMatchObject({ date: "2026-10-06", amount: -56.31 });
  });
});
