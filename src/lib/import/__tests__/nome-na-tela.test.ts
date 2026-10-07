import { describe, expect, it } from "vitest";
import { nomeNaTela } from "../nome-na-tela";

describe("nome do lançamento na tela da importação", () => {
  it("tira o meio de pagamento da frente e mostra o nome da loja", () => {
    expect(nomeNaTela("Compra no débito - SUPERMERCADO EXEMPLO")).toEqual({ nome: "Supermercado Exemplo", meio: "Débito" });
    expect(nomeNaTela("Transferência enviada pelo Pix - MARIA DA SILVA")).toEqual({ nome: "Maria da Silva", meio: "Pix enviado" });
    expect(nomeNaTela("Transferência recebida pelo Pix - EMPRESA LTDA")).toEqual({ nome: "Empresa Ltda", meio: "Pix recebido" });
    expect(nomeNaTela("Pagamento de boleto - ESCOLA DE IDIOMAS")).toEqual({ nome: "Escola de Idiomas", meio: "Boleto" });
  });
  it("sem prefixo conhecido, só ajeita as maiúsculas", () => {
    expect(nomeNaTela("Aplicação RDB")).toEqual({ nome: "Aplicação RDB", meio: null });
    expect(nomeNaTela("IFOOD *RESTAURANTE")).toEqual({ nome: "Ifood *restaurante", meio: null });
  });
  it("prefixo sem nada depois fica como veio", () => {
    expect(nomeNaTela("Compra no débito - ").nome).toBe("Compra no débito -");
  });
});
