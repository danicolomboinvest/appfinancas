import { describe, expect, it } from "vitest";
import { pareceAplicacao, pareceContaPropria, parecePagamentoDeFatura, pareceResgate } from "../dinheiro-proprio";

describe("dinheiro indo pra ela mesma", () => {
  it("aplicação vira aporte; resgate não é aplicação", () => {
    for (const d of ["Aplicação RDB", "APLICACAO CDB DI", "Guardado na Caixinha", "Tesouro Direto", "Aplic. Poupança"]) expect(pareceAplicacao(d)).toBe(true);
    expect(pareceAplicacao("Resgate RDB")).toBe(false);
    expect(pareceAplicacao("Mercado Bom Preço")).toBe(false);
    expect(pareceResgate("Resgate RDB")).toBe(true);
    expect(pareceResgate("Retirada da Caixinha")).toBe(true);
  });

  it("pagamento de fatura", () => {
    expect(parecePagamentoDeFatura("Pagamento de fatura")).toBe(true);
    expect(parecePagamentoDeFatura("PGTO FATURA CARTAO")).toBe(true);
    expect(parecePagamentoDeFatura("Fatura Claro")).toBe(false);
  });

  it("conta própria: pela descrição ou pelo nome dela, primeiro e último", () => {
    expect(pareceContaPropria("TED MESMA TITULARIDADE", null)).toBe(true);
    expect(pareceContaPropria("Transferência enviada pelo Pix - DANIELA COLOMBO - •••.123", "Daniela Colombo")).toBe(true);
    expect(pareceContaPropria("Transferência enviada pelo Pix - DANIELA SOUZA", "Daniela Colombo")).toBe(false);
    expect(pareceContaPropria("Padaria Colombo Daniela", "Daniela Colombo")).toBe(false);
  });
  it("investimento no plural e as outras palavras do guardar (12/10/2026)", () => {
    for (const d of ["Pix enviado - XP INVESTIMENTOS", "Transferência para investimentos", "Aplicações automáticas", "Aplicação CDB", "TED TESOURO DIRETO", "Depósito poupança", "Previdência privada mensal"]) {
      expect(pareceAplicacao(d), d).toBe(true);
    }
    for (const d of ["Resgate CDB", "Resgate investimentos", "Resgate poupança"]) expect(pareceResgate(d), d).toBe(true);
    expect(pareceAplicacao("Aplicação de cílios")).toBe(false);
  });
});

describe("conta própria com o nome cortado pelo banco (28/10/2026)", () => {
  it("reconhece o nome cortado no fim da descrição ou antes do saldo colado", () => {
    expect(pareceContaPropria("Pix - Recebido 38392308883 Isabela Espago 4.519,85 (+) Saldo do dia", "Isabela Espagolla Santos")).toBe(true);
    expect(pareceContaPropria("PIX ENVIADO DES: Letícia Gonçalves Bez", "Letícia Gonçalves Bezerra de Carvalho")).toBe(true);
    expect(pareceContaPropria("Transferência recebida pelo Pix LETICIA GONCALVES BEZERRA DE CARVALHO", "Letícia Gonçalves Bezerra de Carvalho")).toBe(true);
  });
  it("não confunde com outra pessoa nem com o primeiro nome sozinho", () => {
    expect(pareceContaPropria("PIX ENVIADO DES: Letícia Gonçalves Silva", "Letícia Gonçalves Bezerra de Carvalho")).toBe(false);
    expect(pareceContaPropria("Pix - Recebido Isabela Souza 100,00", "Isabela Espagolla Santos")).toBe(false);
    expect(pareceContaPropria("PIX ENVIADO DES: Letícia", "Letícia Gonçalves Bezerra de Carvalho")).toBe(false);
    expect(pareceContaPropria("Transferência enviada pelo Pix Margareth Espagolla Santos", "Isabela Espagolla Santos")).toBe(false);
    expect(pareceContaPropria("Compra Isabela Espago", "Isabela Espagolla Santos")).toBe(false);
  });
});
