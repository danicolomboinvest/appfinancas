import { describe, expect, it } from "vitest";
import { nomeEParcela, nomeNaTela } from "../nome-na-tela";

describe("nome do lançamento na tela da importação", () => {
  it("tira o meio de pagamento da frente e mostra o nome da loja", () => {
    expect(nomeNaTela("Compra no débito - SUPERMERCADO EXEMPLO")).toEqual({ nome: "Supermercado Exemplo", meio: "Débito" });
    expect(nomeNaTela("Transferência enviada pelo Pix - MARIA DA SILVA")).toEqual({ nome: "Maria da Silva", meio: "Pix enviado" });
    expect(nomeNaTela("Transferência recebida pelo Pix - EMPRESA LTDA")).toEqual({ nome: "Empresa", meio: "Pix recebido" });
    expect(nomeNaTela("Pagamento de boleto - ESCOLA DE IDIOMAS")).toEqual({ nome: "Escola de Idiomas", meio: "Boleto" });
  });
  it("sem prefixo conhecido, só ajeita as maiúsculas", () => {
    expect(nomeNaTela("Aplicação RDB")).toEqual({ nome: "Aplicação RDB", meio: null });
    expect(nomeNaTela("IFOOD *RESTAURANTE")).toEqual({ nome: "Ifood *restaurante", meio: null });
  });
  it("prefixo sem nada depois fica como veio", () => {
    expect(nomeNaTela("Compra no débito - ").nome).toBe("Compra no débito -");
  });
  it("nome de verdade: sem o começo genérico, sem CNPJ, banco e sufixo da empresa (12/10/2026)", () => {
    expect(nomeNaTela("Transferência recebida pelo Pix HUBLA TECNOLOGIA LIMITADA - 36.062.381/0001-80 - ITAÚ UNIBANCO S.A. (0341)")).toEqual({ nome: "Hubla Tecnologia", meio: "Pix recebido" });
    expect(nomeNaTela("Transferência Pix recebido MARINA SOUZA")).toEqual({ nome: "Marina Souza", meio: "Pix recebido" });
    expect(nomeNaTela("Transferência Pix enviado DANIELA COLOMBO - •••.123.456-•• - NU PAGAMENTOS")).toEqual({ nome: "Daniela Colombo", meio: "Pix enviado" });
    expect(nomeNaTela("Compra no débito PADARIA PAO QUENTE")).toEqual({ nome: "Padaria Pao Quente", meio: "Débito" });
    expect(nomeNaTela("Pix enviado para JOÃO PEREIRA")).toEqual({ nome: "João Pereira", meio: "Pix enviado" });
  });
});

describe("nomeNaTela: planilha que junta transação e nome com ' · '", () => {
  it("'Pix recebido · Fulana' mostra Fulana, sem o ponto na frente", () => {
    expect(nomeNaTela("Pix recebido · Empresa Exemplo")).toEqual({ nome: "Empresa Exemplo", meio: "Pix recebido" });
    expect(nomeNaTela("Pix enviado · Loja Exemplo S A").nome).toBe("Loja Exemplo S A");
  });
});

describe("nomeNaTela: boleto 'efetuado' e 'devolvido'", () => {
  it("o nome é o do boleto, sem 'efetuado' nem 'devolvido' na frente", () => {
    expect(nomeNaTela("Pagamento de boleto efetuado DAS-SIMPLES NACIONAL")).toEqual({ nome: "Das-simples Nacional", meio: "Boleto" });
    expect(nomeNaTela("Pagamento de boleto devolvido DAS-SIMPLES NACIONAL").nome).toBe("Das-simples Nacional");
  });
});

describe("nomeEParcela: a parcela sai do nome e volta ao lado, com dois dígitos (30/10/2026)", () => {
  it("fatura importada, nos jeitos dos bancos", () => {
    expect(nomeEParcela("ZARA PARC 02/03")).toEqual({ nome: "Zara", meio: null, parcela: "02/03" });
    expect(nomeEParcela("ZARA 2/3 PARCELA")).toMatchObject({ parcela: "02/03" });
    expect(nomeEParcela("Mercado Pago (6/6)")).toEqual({ nome: "Mercado Pago", meio: null, parcela: "06/06" });
    expect(nomeEParcela("Parcela 2 de 6 - Notebook")).toEqual({ nome: "Notebook", meio: null, parcela: "02/06" });
    expect(nomeEParcela("Amazon Marketplace Cc - Parcela 9/10")).toEqual({ nome: "Amazon Marketplace Cc", meio: null, parcela: "09/10" });
    expect(nomeEParcela("GELADEIRA 05/24")).toEqual({ nome: "Geladeira", meio: null, parcela: "05/24" });
  });
  it("parcela lançada à mão no Digitar, com o (k/N) no fim", () => {
    expect(nomeEParcela("Sapato (1/3)")).toEqual({ nome: "Sapato", meio: null, parcela: "01/03" });
  });
  it("número que é data, não parcela, fica no nome como veio", () => {
    expect(nomeEParcela("POSTO SHELL 03/09")).toEqual({ nome: "Posto Shell 03/09", meio: null, parcela: null });
    expect(nomeEParcela("Compra no débito - SUPERMERCADO EXEMPLO")).toEqual({ nome: "Supermercado Exemplo", meio: "Débito", parcela: null });
  });
  it("a data da compra antes da parcela fica; a parcela sai", () => {
    expect(nomeEParcela("LOJA 03/09 PARCELA 2/10")).toEqual({ nome: "Loja 03/09", meio: null, parcela: "02/10" });
  });
});
