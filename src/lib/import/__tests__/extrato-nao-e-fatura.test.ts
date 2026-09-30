import { describe, expect, it } from "vitest";
import { detectDocKind, sinaisDesmentemExtrato } from "../detect";
import { profileDocument } from "../profile";

// Extrato tomado por fatura por causa de palavras soltas ("Pagamento de fatura", "vencimento").
// Textos FICTÍCIOS no molde dos PDFs do Nubank e do Inter: nomes, contas e valores inventados.

/** Um dia do extrato do Nubank com o pagamento do cartão pela conta, o caso mais comum. */
const diaNubank = (dia: string) =>
  [
    `${dia} MAI 2026 Total de saídas - 1.250,00`,
    "Pagamento de fatura",
    "1.200,00",
    "Transferência enviada pelo Pix Fulano de Tal - •••.111.222-•• - BANCO EXEMPLO",
    "50,00",
    "Saldo do dia 2.000,00",
    `${dia} MAI 2026 Total de entradas + 300,00`,
    "Transferência recebida pelo Pix Joana Exemplo - •••.333.444-••",
    "300,00",
  ].join("\n");

/** O rodapé "Extrato gerado dia" só aparece no fim, longe do começo do arquivo. */
const NUBANK_LONGO = [
  "MARIA EXEMPLO",
  "a\t01 DE MAIO DE 2026 31 DE MAIO DE 2026 VALORES EM R$",
  "Saldo inicial",
  "Total de entradas",
  "Total de saídas",
  "Saldo final do período",
  "Movimentações",
  ...["02", "03", "05", "06", "08", "09", "11", "12", "14", "15", "17", "18", "20", "21", "23", "24", "26", "28", "29", "30"].map(diaNubank),
  "Extrato gerado dia 01 de junho de 2026 às 10:00 1 de 1",
].join("\n");

const INTER = [
  "Solicitado em: 27/09/2026 - 11h05",
  "PESSOA DE EXEMPLO",
  "Período: 27/08/2026 a 27/09/2026",
  "Valor \tSaldo por transação",
  "27 de Agosto de 2026 \tSaldo do dia: R$ 1.084,56",
  'Pagamento efetuado: "Boleto vencimento 05/09 ESCOLA EXEMPLO" \t-R$ 50,00 \tR$ 1.034,56',
  "1 de Setembro de 2026 \tSaldo do dia: R$ 3.534,56",
  'Pix recebido: "Cp :00000000-EMPRESA MODELO" \tR$ 2.500,00 \tR$ 3.534,56',
].join("\n");

describe("extrato do Nubank e do Inter não viram fatura por palavra solta", () => {
  it("Nubank: 'Pagamento de fatura' antes do rodapé não faz do extrato uma fatura", () => {
    expect(NUBANK_LONGO.indexOf("Extrato")).toBeGreaterThan(4000);
    expect(detectDocKind(NUBANK_LONGO, "extrato.pdf")).toEqual({ kind: "extrato", reason: "extrato do Nubank" });
    expect(profileDocument(NUBANK_LONGO, "extrato.pdf").kind).toBe("statement");
  });

  it("Inter: 'vencimento' na descrição de um boleto não faz do extrato uma fatura", () => {
    expect(detectDocKind(INTER, null).kind).toBe("extrato");
    expect(profileDocument(INTER, null).kind).toBe("statement");
  });

  it("o molde do banco é estrutura: os sinais não desmentem", () => {
    const quaseTudoEntrada = Array.from({ length: 10 }, (_, i) => ({ date: "2026-05-02", description: `Resgate ${i}`, amount: 100 + i }));
    expect(sinaisDesmentemExtrato(quaseTudoEntrada, detectDocKind(NUBANK_LONGO).reason)).toBe(false);
  });

  it("sem molde conhecido, 'Pagamento de fatura' numa linha de lançamento não decide", () => {
    const generico = ["Banco Exemplo S.A.", "Movimentação da conta", "01/09/2026 PAGAMENTO DE FATURA CARTAO -800,00", "02/09/2026 PIX RECEBIDO 100,00"].join("\n");
    expect(detectDocKind(generico).kind).not.toBe("fatura");
  });

  it("fatura de verdade continua fatura", () => {
    expect(detectDocKind("Fatura do cartão\nVencimento 10/10/2026\nTotal da fatura R$ 500,00\n01/09 LOJA EXEMPLO 500,00").kind).toBe("fatura");
    expect(detectDocKind("Resumo\nData de vencimento: 10/10/2026\nLimite disponível R$ 1.000,00").kind).toBe("fatura");
  });
});
