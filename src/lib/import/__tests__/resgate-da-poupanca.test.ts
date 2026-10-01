import { describe, expect, it } from "vitest";
import { pareceAplicacao, pareceResgate } from "../dinheiro-proprio";

/**
 * Resgate escrito de outro jeito (30/09/2026). Uma cliente fez uma "retirada" da poupança e o
 * extrato do Banco do Brasil trouxe "Transferido da poupança" + o nome dela: a linha entrou como
 * renda e a carteira nunca perguntou de qual investimento o dinheiro saiu. As amostras abaixo são
 * fictícias, no formato que os extratos reais usam (nomes inventados).
 */
describe("pareceResgate: dinheiro voltando do que ela guardou", () => {
  it.each([
    "Transferido da poupança MARIA EXEMPLO SILVA", // Banco do Brasil
    "CRÉD.TRANSF.POUPANÇ", // extrato que corta a palavra
    "Retirada poupança",
    "Retirada da poupança",
    "Saque poupança",
    "Transf. poupança p/ conta",
    "Transferência da poupança",
    "Débito poupança",
    "Transf poupança",
    "Retirada da caixinha",
    "Retirada do cofrinho",
    "Resgate RDB",
    "RESGATE RDC DOC.: 123 - 4",
    "Resgate CDB Banco Exemplo",
    "Saque Tesouro Direto",
    "TED da conta investimento",
  ])("%s", (descricao) => {
    expect(pareceResgate(descricao)).toBe(true);
  });

  it.each([
    "JUROS POUP AUT 123", // rendimento é ganho, não resgate
    "REMUNER BASICA POUP AUT 123",
    "Rendimento poupança",
    "Pix recebido Joana Exemplo",
    "Salário Empresa Exemplo",
    "SAQUE CARTAO TRANSF PIX*",
    "Transferência para poupança", // o sentido contrário
  ])("não é resgate: %s", (descricao) => {
    expect(pareceResgate(descricao)).toBe(false);
  });
});

describe("pareceAplicacao continua certa com a regra nova", () => {
  it.each(["Transferência para poupança", "DÉB.TRANSF.POUPANÇA", "Aplicação na poupança", "Aplicação RDB", "APLICACAO COFRINHOS", "Débito poupança"])(
    "saída pra guardar é aplicação: %s",
    (descricao) => {
      expect(pareceAplicacao(descricao)).toBe(true);
    },
  );

  it.each(["Transferido da poupança MARIA EXEMPLO", "Retirada poupança", "Saque poupança", "Transf. poupança p/ conta", "Resgate RDB"])(
    "o que vem DA poupança nunca vira aplicação: %s",
    (descricao) => {
      expect(pareceAplicacao(descricao)).toBe(false);
    },
  );

  it.each(["SAQUE CASH RECICLADOR ( Doc.: 123 )", "(-) 12 34 Saque dinheiro ATM cartao", "SAQUE 24H BANCO24HORAS"])("saque comum no caixa não é aplicação nem resgate: %s", (descricao) => {
    expect(pareceAplicacao(descricao)).toBe(false);
    expect(pareceResgate(descricao)).toBe(false);
  });
});
