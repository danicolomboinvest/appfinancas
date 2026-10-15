import { describe, expect, it } from "vitest";
import { periodoSemMovimento } from "../detect";
import { profileDocument } from "../profile";
import { isSofisaStatement, parseSofisaStatement } from "../sofisa-pdf";
import { parseStatementComLeitor } from "../statement-parser";

/** Layout do extrato do Sofisa Direto em PDF; nomes, conta e valores inventados. */
const cabecalho = [
  "Banco Sofisa S.A. | Al. Exemplo, 100 - São Paulo / SP",
  "CNPJ 00.000.000/0001-00",
  "www.sofisadireto.com.br",
  "0800 000 0000",
  "Extrato do período de 01/04/2026 até 30/04/2026",
  "Cliente: Fulana de Tal",
  "CPF/CNPJ: 000.000.000-00 Agência: 0001 Conta: 0000000",
  "Extrato do período de 01/04/2026 à 30/04/2026",
];
const quadro = [
  "A - 14/10/2026 Saldo Disponível R$ 0,00",
  "B - Juros Previstos (6,99% am) R$ 0,00",
  "C - IOF previsto R$ 0,00",
  "D - Limite Especial R$ 5.000,00",
  "Total disponível para transferência (A+D) R$ 5.000,00",
  "Aviso Legal: O Banco Sofisa Direto é um segmento operacional do Banco Sofisa",
  "",
  "-- 1 of 1 --",
];
const COM_LANCAMENTOS = [
  ...cabecalho,
  "15/04/2026 Recebimento de transferência via PIX - De Fulana de Tal R$ 4.000,00",
  "15/04/2026 Aplicação - Meus Investimentos - CDB DIRETO DI -R$ 4.000,00",
  "15/04/2026 Saldo em 15/04/2026 R$ 0,00",
  "16/04/2026 Recebimento de transferência via PIX - De Empresa Exemplo LTDA R$ 2.000,00",
  "16/04/2026 Saldo em 16/04/2026 R$ 2.000,00",
  ...quadro,
].join("\n");

describe("extrato do Sofisa em PDF", () => {
  it("lê os lançamentos e deixa de fora o saldo do dia e o quadro de limite", () => {
    expect(isSofisaStatement(COM_LANCAMENTOS)).toBe(true);
    expect(parseSofisaStatement(COM_LANCAMENTOS)).toEqual([
      { date: "2026-04-15", description: "Recebimento de transferência via PIX - De Fulana de Tal", amount: 4000 },
      { date: "2026-04-15", description: "Aplicação - Meus Investimentos - CDB DIRETO DI", amount: -4000 },
      { date: "2026-04-16", description: "Recebimento de transferência via PIX - De Empresa Exemplo LTDA", amount: 2000 },
    ]);
    expect(parseStatementComLeitor(COM_LANCAMENTOS, "pdf").leitor).toBe("sofisa");
    expect(profileDocument(COM_LANCAMENTOS, "extrato.pdf").institution).toBe("Sofisa");
  });

  it("mês sem lançamento é período sem movimento, não formato desconhecido", () => {
    const vazio = [...cabecalho, ...quadro].join("\n");
    expect(parseSofisaStatement(vazio)).toEqual([]);
    expect(periodoSemMovimento(vazio)).toBe(true);
    expect(periodoSemMovimento(COM_LANCAMENTOS)).toBe(false);
  });
});
