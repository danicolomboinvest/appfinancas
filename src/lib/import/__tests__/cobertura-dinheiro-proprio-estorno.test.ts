import { describe, expect, it } from "vitest";
import { pareceAplicacao, pareceContaPropria, parecePagamentoDeFatura, pareceResgate } from "../dinheiro-proprio";
import { pareceEstorno } from "../estorno";

// Cobertura extra (set/2026). Descrições FICTÍCIAS no jeito dos bancos; nenhum dado de cliente.
// Os `it.fails` são BUGS CONHECIDOS: o teste descreve o comportamento CERTO e hoje falha. Quando
// alguém consertar, o vitest avisa (o it.fails passa a "falhar") e é só trocar por `it`.

describe("pareceAplicacao / pareceResgate: bordas", () => {
  it("aceita null, vazio e acento", () => {
    expect(pareceAplicacao(null)).toBe(false);
    expect(pareceAplicacao(undefined)).toBe(false);
    expect(pareceAplicacao("")).toBe(false);
    expect(pareceAplicacao("APLICAÇÃO AUTOMÁTICA")).toBe(true);
    expect(pareceAplicacao("Guardar dinheiro - Cofrinho")).toBe(true);
    expect(pareceAplicacao("LCI BANCO EXEMPLO")).toBe(true);
  });

  it("resgate nunca é aplicação, mesmo quando a descrição cita o produto", () => {
    for (const d of ["RESGATE CDB", "Resg. Poupança", "Retirada do cofrinho", "Valor resgatado - Caixinha", "RESG AUTOMATICO"]) {
      expect(pareceResgate(d), d).toBe(true);
      expect(pareceAplicacao(d), d).toBe(false);
    }
  });

  it("palavra inteira: 'cdb' dentro de outra palavra não conta", () => {
    expect(pareceAplicacao("CDBX IMPORTADORA")).toBe(false);
    expect(pareceAplicacao("APLICATIVO DE TRANSPORTE")).toBe(false);
  });

  // "LCA", "LCI", "CDB" e "Tesouro" também são nome de loja. O Pix pra uma loja chamada
  // "LCA Modas" vira aporte sozinho (sai do gasto do mês sem perguntar).
  it("BUG: Pix pra uma loja chamada 'LCA Modas' não é aplicação", () => {
    expect(pareceAplicacao("Pix enviado - LCA MODAS")).toBe(false);
  });
});

describe("parecePagamentoDeFatura: bordas", () => {
  it("reconhece os jeitos comuns", () => {
    for (const d of ["Pagamento de fatura", "PGTO FATURA CARTAO", "Pag fatura", "Débito automático fatura cartão", "PAGAMENTO FATURA CARTAO EXEMPLO"]) {
      expect(parecePagamentoDeFatura(d), d).toBe(true);
    }
  });

  it("conta de consumo que não fala de pagamento nem de cartão fica de fora", () => {
    expect(parecePagamentoDeFatura("Fatura Claro")).toBe(false);
    expect(parecePagamentoDeFatura(null)).toBe(false);
  });

  // "PAGTO" é a abreviação mais comum depois de "PGTO" e não está na lista (`/pagament|pgto|pag /`).
  it("BUG: 'PAGTO FATURA' também é pagamento de fatura", () => {
    expect(parecePagamentoDeFatura("PAGTO FATURA NUBANK")).toBe(true);
  });

  // Com fatura importada nos últimos 120 dias, o item é IGNORADO (import-actions.ts:483-486): a
  // conta de celular paga "via fatura" some do mês sem ninguém ver.
  it("BUG: pagar a fatura da operadora de celular é gasto, não pagamento de cartão", () => {
    expect(parecePagamentoDeFatura("Pagamento fatura Claro")).toBe(false);
    expect(parecePagamentoDeFatura("Pagamento de fatura Vivo")).toBe(false);
  });
});

describe("pareceContaPropria: bordas", () => {
  it("nome com acento bate com a descrição sem acento", () => {
    expect(pareceContaPropria("PIX ENVIADO JOSE CONCEICAO", "José Conceição")).toBe(true);
  });

  it("vale pra entrada também (Pix recebido de mim mesma)", () => {
    expect(pareceContaPropria("Pix recebido - Maria Souza", "Maria Souza")).toBe(true);
  });

  it("nome com uma palavra só, ou palavras curtas, não arrisca", () => {
    expect(pareceContaPropria("Pix enviado - MARIA", "Maria")).toBe(false);
    expect(pareceContaPropria("Pix enviado - ANA LI", "Ana Li")).toBe(false);
    expect(pareceContaPropria("Pix enviado - MARIA", null)).toBe(false);
  });

  it("sem Pix/TED/transferência na descrição, o nome sozinho não basta", () => {
    expect(pareceContaPropria("MARIA SOUZA MODAS", "Maria Souza")).toBe(false);
  });

  it("usa primeiro e último nome, ignorando os do meio", () => {
    expect(pareceContaPropria("TED - MARIA SOUZA", "Maria Clara da Souza")).toBe(true);
  });

  // O nome vem do perfil (texto livre, até 80 letras). Ele entra CRU num `new RegExp` em
  // dinheiro-proprio.ts:48: um ")" ou "***" no nome derruba a leitura do extrato inteiro
  // (separarDinheiroProprio em import-actions.ts) e a revisão de antigos (revisao-antigos.ts).
  it("BUG: nome com caractere especial não pode derrubar a importação", () => {
    expect(() => pareceContaPropria("Pix enviado - ANA", "Ana Silva)")).not.toThrow();
    expect(() => pareceContaPropria("Pix enviado - ANA", "Ana Paula :-)")).not.toThrow();
    expect(() => pareceContaPropria("Pix enviado - ANA", "Ana ***")).not.toThrow();
  });
});

describe("pareceEstorno: bordas", () => {
  it("palavra inteira: 'reembolso' dentro de outra palavra não conta", () => {
    expect(pareceEstorno("REEMBOLSOSX LTDA")).toBe(false);
    expect(pareceEstorno(undefined)).toBe(false);
    expect(pareceEstorno("")).toBe(false);
  });

  it("estorno de tarifa e devolução de Pix também são dinheiro voltando", () => {
    expect(pareceEstorno("Estorno tarifa")).toBe(true);
    expect(pareceEstorno("Devolução de Pix")).toBe(true);
    expect(pareceEstorno("ESTORNADA COMPRA LOJA EXEMPLO")).toBe(true);
  });

  // Sem reconhecer, a entrada vira RENDA e o mês parece ter ganhado mais (estorno.ts:2-4).
  it("BUG: plural e particípio também são estorno ('ESTORNOS', 'Pix devolvido', 'reembolsado')", () => {
    expect(pareceEstorno("ESTORNOS DE COMPRA")).toBe(true);
    expect(pareceEstorno("Pix devolvido")).toBe(true);
    expect(pareceEstorno("Valor reembolsado")).toBe(true);
  });
});
