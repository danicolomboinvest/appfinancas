import { describe, expect, it } from "vitest";
import { parseCsv, parseStatementComLeitor, parseTextLines } from "../statement-parser";
import { checarPlausibilidade } from "../plausibility";

// Leitor GENÉRICO de PDF (o que lê quando nenhum banco tem leitor próprio). Textos FICTÍCIOS,
// escritos à mão no molde do internet banking de cada banco: nomes e valores inventados.

const lidos = (texto: string) => parseStatementComLeitor(texto, "pdf", 2026);
const valores = (texto: string) => lidos(texto).txns.map((t) => [t.description, t.amount]);

describe("extrato do Itaú (sem leitor próprio): salário e Pix recebido não viram gasto", () => {
  // O Itaú marca só a saída, com "-". A entrada vem sem sinal nenhum.
  const ITAU = [
    "Itaú Unibanco S.A.",
    "extrato conta corrente",
    "período de visualização: 31/08/2026 até 03/09/2026",
    "data lançamentos valor (R$)",
    "31/08/2026 SALDO ANTERIOR 500,00",
    "01/09/2026 SISPAG SALARIOS EMPRESA MODELO 3.000,00",
    "01/09/2026 PIX TRANSF MARIA EX 250,00",
    "01/09/2026 SALDO DO DIA 3.750,00",
    "02/09/2026 PAG BOLETO LUZ EXEMPLO -180,00",
    "02/09/2026 PIX QRS PADARIA FICTICIA -25,90",
    "02/09/2026 TED 341.1234 FULANO EX 500,00",
    "03/09/2026 CARTAO DEBITO MERCADO MODELO -120,00",
    "03/09/2026 SALDO DO DIA 3.924,10",
  ].join("\n");

  it("quem vem sem '-' é entrada; quem vem com '-' é saída", () => {
    const { txns, leitor } = lidos(ITAU);
    expect(leitor).toBeNull();
    expect(txns.map((t) => [t.description, t.amount])).toEqual([
      ["SISPAG SALARIOS EMPRESA MODELO", 3000],
      ["PIX TRANSF MARIA EX", 250],
      ["PAG BOLETO LUZ EXEMPLO", -180],
      ["PIX QRS PADARIA FICTICIA", -25.9],
      ["TED 341.1234 FULANO EX", 500],
      ["CARTAO DEBITO MERCADO MODELO", -120],
    ]);
  });

  it("com o saldo no fim de cada linha, o valor é o lançamento e não o saldo", () => {
    const comSaldo = [
      "Itaú Unibanco S.A.",
      "31/08/2026 SALDO ANTERIOR 500,00",
      "01/09/2026 SISPAG SALARIOS EMPRESA MODELO 3.000,00 3.500,00",
      "02/09/2026 PAG BOLETO LUZ EXEMPLO -180,00 3.320,00",
      "02/09/2026 PIX TRANSF MARIA EX 250,00 3.570,00",
    ].join("\n");
    expect(valores(comSaldo)).toEqual([
      ["SISPAG SALARIOS EMPRESA MODELO", 3000],
      ["PAG BOLETO LUZ EXEMPLO", -180],
      ["PIX TRANSF MARIA EX", 250],
    ]);
  });

  it("fatura com um pagamento negativo continua com as compras como gasto", () => {
    // Na fatura o "-" é o pagamento da fatura anterior; o resto é compra, mesmo sem sinal.
    const fatura = [
      "Resumo da fatura",
      "Total da fatura R$ 300,00",
      "05/08 PAGAMENTO RECEBIDO -1.671,14",
      "06/08 LOJA EXEMPLO 100,00",
      "07/08 MERCADO MODELO 150,00",
      "08/08 FARMACIA FICTICIA 50,00",
    ].join("\n");
    expect(parseTextLines(fatura, 2026).map((t) => t.amount)).toEqual([-1671.14, -100, -150, -50]);
  });

  it("sem nenhuma entrada num extrato comprido, a revisão pergunta do salário", () => {
    const soSaidas = Array.from({ length: 8 }, (_, i) => ({ date: "2026-09-02", description: `PIX TRANSF FULANO ${i}`, amount: -(10.5 + i) }));
    const aviso = checarPlausibilidade(soSaidas, "extrato");
    expect(aviso.map((s) => s.texto).join(" ")).toMatch(/nenhuma entrada/i);
    expect(aviso[0].exemplos[0]).toMatch(/PIX TRANSF FULANO/);
    // Fatura só tem compra: aí não é suspeita nenhuma.
    expect(checarPlausibilidade(soSaidas, "fatura")).toEqual([]);
    // Extrato curto também não: numa semana sem salário é normal.
    expect(checarPlausibilidade(soSaidas.slice(0, 5), "extrato")).toEqual([]);
  });
});

describe("Caixa e Santander (internet banking): o genérico não pega o SALDO como valor", () => {
  it("Caixa: o C/D do lançamento vale, não o do saldo no fim da linha", () => {
    const CAIXA = [
      "Caixa Econômica Federal - Internet Banking",
      "Extrato de conta corrente",
      "Data Mov. Nr. Doc. Histórico Valor Saldo",
      "01/09/2026 000123 SALDO ANTERIOR 0,00 1.000,00 C",
      "01/09/2026 000124 CRED PIX 250,00 C 1.250,00 C",
      "02/09/2026 000125 PAG BOLETO 150,00 D 1.100,00 C",
      "03/09/2026 000126 ENVIO PIX 1.300,00 D 200,00 D",
    ].join("\n");
    const { txns, leitor } = lidos(CAIXA);
    expect(leitor).toBeNull();
    expect(txns.map((t) => [t.description, t.amount])).toEqual([
      ["000124 CRED PIX", 250],
      ["000125 PAG BOLETO", -150],
      ["000126 ENVIO PIX", -1300],
    ]);
  });

  it("Santander: 'PIX RECEBIDO 250,00 1.250,00' é entrada de 250", () => {
    const SANTANDER = [
      "Santander Internet Banking",
      "Conta Corrente - Extrato",
      "Data Descrição Docto Valor (R$) Saldo (R$)",
      "01/09/2026 SALDO ANTERIOR 1.000,00",
      "01/09/2026 PIX RECEBIDO MARIA EXEMPLO 250,00 1.250,00",
      "02/09/2026 PAGAMENTO DE BOLETO -150,00 1.100,00",
      "03/09/2026 COMPRA CARTAO DEBITO PADARIA -30,50 1.069,50",
    ].join("\n");
    expect(valores(SANTANDER)).toEqual([
      ["PIX RECEBIDO MARIA EXEMPLO", 250],
      ["PAGAMENTO DE BOLETO", -150],
      ["COMPRA CARTAO DEBITO PADARIA", -30.5],
    ]);
  });

  it("colunas Entrada/Saída/Saldo sem sinal: quem decide é o saldo subir ou descer", () => {
    const texto = [
      "Data Descrição Entrada Saída Saldo",
      "01/09/2026 Saldo anterior 80,00",
      "02/09/2026 Cashback exemplo 1,50 81,50",
      "03/09/2026 Mercado Exemplo 31,50 50,00",
      "04/09/2026 Pix recebido Joana Exemplo 100,00 150,00",
    ].join("\n");
    expect(valores(texto)).toEqual([
      ["Cashback exemplo", 1.5],
      ["Mercado Exemplo", -31.5],
      ["Pix recebido Joana Exemplo", 100],
    ]);
  });

  it("sem cabeçalho, reconhece o saldo porque ele corre de uma linha pra outra", () => {
    const texto = [
      "02/09/2026 PIX ENVIADO PADARIA -50,00 950,00",
      "03/09/2026 SALARIO EMPRESA 3.000,00 3.950,00",
      "04/09/2026 MERCADO EXEMPLO -200,00 3.750,00",
    ].join("\n");
    expect(valores(texto)).toEqual([
      ["PIX ENVIADO PADARIA", -50],
      ["SALARIO EMPRESA", 3000],
      ["MERCADO EXEMPLO", -200],
    ]);
  });

  it("fatura com valor em dólar e em real na mesma linha continua pegando o valor em real", () => {
    const texto = [
      "Fatura do cartão",
      "10/08 LOJA EXTERIOR US$ 10,00 52,30",
      "11/08 SITE EXEMPLO US$ 20,00 104,60",
      "12/08 PADARIA FICTICIA 15,00",
    ].join("\n");
    expect(parseTextLines(texto, 2026).map((t) => t.amount)).toEqual([-52.3, -104.6, -15]);
  });
});

describe("CSV com coluna de sinal: gasto não vira renda", () => {
  it("coluna 'Tipo' com D/C dá o sinal e não suja a descrição", () => {
    const csv = ["Data;Histórico;Valor;Tipo", "28/07/2026;Mercado Exemplo;45,90;D", "29/07/2026;Pix recebido Joana;100,00;C"].join("\n");
    expect(parseCsv(csv).map((t) => [t.description, t.amount])).toEqual([
      ["Mercado Exemplo", -45.9],
      ["Pix recebido Joana", 100],
    ]);
  });

  it("'Saída'/'Entrada' e 'Débito'/'Crédito' por extenso também valem", () => {
    const csv = ["Data;Descrição;Valor;Tipo", "28/07/2026;Mercado Exemplo;45,90;Saída", "29/07/2026;Salário Empresa Modelo;3.000,00;Entrada", "30/07/2026;Farmácia Fictícia;20,00;Débito"].join("\n");
    expect(parseCsv(csv).map((t) => t.amount)).toEqual([-45.9, 3000, -20]);
    const natureza = ["Data;Descrição;Valor;Natureza", "28/07/2026;Mercado Exemplo;45,90;Saída"].join("\n");
    expect(parseCsv(natureza).map((t) => t.amount)).toEqual([-45.9]);
  });

  it("coluna 'Entrada/Saída' numa célula só é o sinal, não um par de colunas", () => {
    const csv = ["Data;Descrição;Valor;Entrada/Saída", "28/07/2026;Mercado Exemplo;45,90;Saída", "29/07/2026;Pix recebido Joana;100,00;Entrada"].join("\n");
    expect(parseCsv(csv).map((t) => t.amount)).toEqual([-45.9, 100]);
  });

  it("'Tipo' com o nome da operação continua enriquecendo a descrição", () => {
    const csv = ["Data;Tipo;Descrição;Valor", "28/07/2026;Pix enviado;Padaria Fictícia;-12,50", "29/07/2026;Pix recebido;Joana Exemplo;80,00"].join("\n");
    expect(parseCsv(csv).map((t) => [t.description, t.amount])).toEqual([
      ["Pix enviado · Padaria Fictícia", -12.5],
      ["Pix recebido · Joana Exemplo", 80],
    ]);
  });

  it("valor que já vem negativo não é invertido pela coluna", () => {
    const csv = ["Data;Descrição;Valor;Tipo", "28/07/2026;Mercado Exemplo;-45,90;D"].join("\n");
    expect(parseCsv(csv).map((t) => t.amount)).toEqual([-45.9]);
  });
});

describe("saldo só no último lançamento do dia", () => {
  it("a linha com saldo usa o penúltimo número; as outras seguem as regras de sempre", () => {
    const texto = [
      "Data Histórico Valor Saldo",
      "01/09/2026 SALDO ANTERIOR 1.000,00",
      "01/09/2026 PIX ENVIADO PADARIA -20,00",
      "01/09/2026 COMPRA DEBITO MERCADO -80,00 900,00",
      "02/09/2026 PIX RECEBIDO JOANA 300,00",
      "02/09/2026 BOLETO ESCOLA EXEMPLO -150,00 1.050,00",
      "03/09/2026 TARIFA PACOTE -30,00",
      "03/09/2026 FARMACIA FICTICIA -45,00 975,00",
    ].join("\n");
    expect(valores(texto).map(([, v]) => v)).toEqual([-20, -80, 300, -150, -30, -45]);
  });
});

describe("o que o leitor genérico NÃO pode confundir com saldo", () => {
  it("extrato de fundo com bruto, IR, IOF e líquido na linha continua pegando o líquido", () => {
    const texto = [
      "Data Tipo Valor bruto IR IOF Valor líquido Saldo",
      "08/06/2026 Resgate R$ 1.500,00 R$ 0,00 R$ 0,00 R$ 1.500,00",
      "10/06/2026 Resgate R$ 2.500,00 R$ 0,00 R$ 0,00 R$ 2.500,00",
      "17/06/2026 Compra por aplicação R$ 800,00 R$ 0,00 R$ 0,00 R$ 800,00",
    ].join("\n");
    expect(parseTextLines(texto, 2026).map((t) => Math.abs(t.amount))).toEqual([1500, 2500, 800]);
  });

  it("'Lançamentos: R$ X' no topo da página é total, não lançamento", () => {
    const texto = [
      "01/09/2026 10h21 Lançamentos: R$ 1.290,88",
      "02/09/2026 14h37 Transferência Pix enviado Fulano Exemplo -R$ 7,00",
      "02/09/2026 19h55 Pix recebido Joana Exemplo R$ 1.000,00",
      "03/09/2026 08h00 Pagamento de boleto Escola Exemplo -R$ 295,00",
    ].join("\n");
    expect(parseTextLines(texto, 2026).map((t) => t.amount)).toEqual([-7, 1000, -295]);
  });

  it("no banco que só marca a saída, 'Transferência estornada' sem sinal é dinheiro voltando", () => {
    const texto = [
      "02/09/2026 Pix enviado Fulano Exemplo -R$ 100,00",
      "03/09/2026 Pagamento de boleto Luz Exemplo -R$ 80,00",
      "04/09/2026 Canc. Transferência Pix enviada Fulano Exemplo R$ 100,00",
    ].join("\n");
    expect(parseTextLines(texto, 2026).map((t) => t.amount)).toEqual([-100, -80, 100]);
  });
});
