import { describe, expect, it } from "vitest";
import { isExtratoSaldoDoDia, parseExtratoSaldoDoDia } from "../extrato-saldo-do-dia-pdf";
import { parseStatementComLeitor } from "../statement-parser";

// Amostra FICTÍCIA: extrato agrupado por dia, com "Saldo do dia" no cabeçalho de cada dia.
const AMOSTRA = [
  "MARIA EXEMPLO",
  "Período do documento: 01/10/2026 a 28/10/2026 Valores R$",
  "Extrato da Conta Corrente",
  "Solicitado em: 29/10/2026 às 13h",
  "Ontem Saldo do dia: R$ 60,00",
  "Movimentação Descritivo Número do documento Valor",
  "Transferência enviada via Pix Padaria Boa E01858774202610281430232 - R$10,00",
  "Transferência recebida via JOAO EXEMPLO E60701190202610281535DY5 + R$100,00",
  "Transferência enviada via Pix Farmacia Sol E01858774202610281452599 - R$30,00",
  "1 de 2",
  "",
  "-- 1 of 2 --",
  "",
  "27/10/2026 Saldo do dia: R$ 0,00",
  "Movimentação Descritivo Número do documento Valor",
  "Compra no débito MERCEARIA AQUI TEM DE ALP000222291425T0100SQ37 - R$40,00",
  "27/10/2026 Saldo do dia: R$ 0,00",
  "Movimentação Descritivo Número do documento Valor",
  "Transferência enviada via Pix Cafe Bom E01858774202610271643333 - R$20,00",
  "20/10/2026 Saldo do dia: R$ 60,00",
  "Movimentação Descritivo Número do documento Valor",
  "Transferência recebida via JOAO EXEMPLO E60701190202610201535DY5 + R$5,00",
].join("\n");

describe("extrato com saldo do dia", () => {
  it("reconhece e lê, com Ontem virando 28/10", () => {
    expect(isExtratoSaldoDoDia(AMOSTRA)).toBe(true);
    const txns = parseExtratoSaldoDoDia(AMOSTRA);
    expect(txns).toHaveLength(6);
    expect(txns[0]).toMatchObject({ date: "2026-10-28", amount: -10, description: "Transferência enviada via Pix Padaria Boa" });
    expect(txns[1].amount).toBe(100);
    expect(txns.filter((t) => t.date === "2026-10-27")).toHaveLength(2);
  });

  it("não lê se algum dia não fechar", () => {
    expect(parseExtratoSaldoDoDia(AMOSTRA.replace("- R$30,00", "- R$31,00"))).toEqual([]);
  });

  it("entra pelo leitor de PDF", () => {
    const r = parseStatementComLeitor(AMOSTRA, "pdf");
    expect(r.leitor).toBe("extrato-saldo-do-dia");
    expect(r.txns).toHaveLength(6);
  });
});
