import { describe, expect, it } from "vitest";
import { ehNaoGasto, SUBCATEGORIA_NAO_E_GASTO, TERMOS_NAO_E_GASTO } from "../nao-e-gasto";

/**
 * A regra de "saída que NÃO é gasto" (aplicação, pagamento de fatura). Ela tira dinheiro da
 * média de gastos (sugestão da Reserva) e do caixa da Empresa, então errar pro lado de "não é
 * gasto" faz o custo de vida parecer MENOR do que é.
 *
 * Os casos de "BUG" eram `it.fails` (bug achado e não corrigido); corrigidos em set/2026.
 */
describe("ehNaoGasto", () => {
  it("sem descrição nem subcategoria é gasto", () => {
    expect(ehNaoGasto({})).toBe(false);
    expect(ehNaoGasto({ description: null, subcategory: null })).toBe(false);
    expect(ehNaoGasto({ description: "" })).toBe(false);
  });

  it("a subcategoria Investimento sempre é 'não é gasto'", () => {
    expect(ehNaoGasto({ subcategory: SUBCATEGORIA_NAO_E_GASTO, description: "Mercado" })).toBe(true);
  });

  it("aplicação e pagamento de fatura, com ou sem acento e em qualquer caixa", () => {
    expect(ehNaoGasto({ description: "APLICAÇÃO RDB" })).toBe(true);
    expect(ehNaoGasto({ description: "Aplicacao CDB Liquidez" })).toBe(true);
    expect(ehNaoGasto({ description: "Pagamento de Fatura" })).toBe(true);
    expect(ehNaoGasto({ description: "Tesouro Direto" })).toBe(true);
  });

  it("gasto comum continua sendo gasto", () => {
    expect(ehNaoGasto({ description: "Supermercado Dia" })).toBe(false);
    expect(ehNaoGasto({ description: "Netflix" })).toBe(false);
  });

  // BUG: a regra é "contém o termo", sem fronteira de palavra. "Aplicação de cílios", "aplicação
  // de botox" ou "caixinha de som" são GASTO de verdade (o público do app é majoritariamente
  // feminino, e esse tipo de serviço aparece com essa descrição), mas saem da média de gastos
  // e a sugestão da Reserva de Emergência fica menor. Mesma regra no SQL de typical-expense.ts.
  it("serviço de estética com 'aplicação' na descrição é gasto", () => {
    expect(ehNaoGasto({ description: "Aplicação de cílios" })).toBe(false);
  });

  it("'caixinha' de som comprada na loja é gasto", () => {
    expect(ehNaoGasto({ description: "Caixinha de som JBL" })).toBe(false);
  });

  // BUG: "rdb"/"cdb" casam no meio da palavra.
  it("loja com 'rdb' no meio do nome é gasto", () => {
    expect(ehNaoGasto({ description: "NERDBURGER LANCHES" })).toBe(false);
  });

  // 13/10/2026: o Pix pro pai que ela pôs em Moradia. Pix para pessoa é gasto (a categoria dela
  // diz de quê); "não é gasto" é só aplicação e fatura.
  it("Pix ou transferência para uma pessoa é gasto, com ou sem CPF mascarado", () => {
    expect(ehNaoGasto({ description: "13h52 Transferência Pix enviado Ricardo Souza Lima" })).toBe(false);
    expect(ehNaoGasto({ description: "Transferência enviada pelo Pix - Ricardo Souza Lima - •••.123.456-•• - ITAÚ" })).toBe(false);
    for (const t of TERMOS_NAO_E_GASTO) expect(t).not.toMatch(/pix|transf/);
  });
});

/**
 * 16/10/2026: o gasto típico (Reserva, plano da meta) tirava o "não é gasto" com o "contém" do
 * SQL, uma lista de frases que discordava de `ehNaoGasto`. Descrições genéricas, do jeito que os
 * bancos e as pessoas escrevem; nenhuma é de cliente.
 */
describe("filtro do SQL x ehNaoGasto", () => {
  /** O "contém" sem diferenciar caixa, como o `mode: "insensitive"` do Prisma. */
  const contem = (termos: string[], d: string) => termos.some((t) => d.toLowerCase().includes(t.toLowerCase()));
  const ANTIGOS = [
    "aplicação", "aplicacao", "caixinha", "rdb", "cdb", "tesouro direto",
    "pagamento de fatura", "pagamento fatura", "pgto fatura", "pagto fatura", "pag fatura", "fatura do cartão", "fatura do cartao",
    "pagto cartão", "pagto cartao",
  ];
  const FATURAS_QUE_O_ANTIGO_PERDIA = [
    "Pagamento cartão de crédito",
    "PAGAMENTO CARTAO",
    "Pgto. cartao",
    "Fatura Nubank",
    "Fatura cartão Inter",
    "Pagamento de boleto NU PAGAMENTOS S.A.",
    "PAG BOLETO ITAUCARD",
    "PAGO TARJETA VISA",
  ];
  const NAO_E_GASTO = [
    ...FATURAS_QUE_O_ANTIGO_PERDIA,
    "Pagamento de Fatura", "PGTO FATURA CARTAO", "Pag fatura via internet banking", "Pagto cartão crédito",
    "Pagamento de boleto NU.PAGAMENTOS", "BOLETO PORTO SEGURO CARTOES", "PAGO DE TARJETA DE CREDITO", "PAGO RESUMEN MASTERCARD",
    "APLICAÇÃO RDB", "Aplicacao CDB Liquidez", "Guardado na caixinha", "TED Tesouro Direto",
  ];

  it("o filtro antigo deixava a fatura no gasto, e ehNaoGasto tira", () => {
    for (const d of FATURAS_QUE_O_ANTIGO_PERDIA) {
      expect(contem(ANTIGOS, d), d).toBe(false);
      expect(ehNaoGasto({ description: d }), d).toBe(true);
    }
  });

  it("o filtro antigo tirava a conta do celular, e ehNaoGasto deixa no gasto", () => {
    expect(contem(ANTIGOS, "Pagamento de fatura CLARO")).toBe(true);
    expect(ehNaoGasto({ description: "Pagamento de fatura CLARO" })).toBe(false);
  });

  it("todo 'não é gasto' passa pela lista de candidatos do SQL (senão fica no gasto sem ninguém ver)", () => {
    for (const d of NAO_E_GASTO) {
      expect(ehNaoGasto({ description: d }), d).toBe(true);
      expect(contem(TERMOS_NAO_E_GASTO, d), d).toBe(true);
    }
  });

  // Ainda NÃO reconhecido por nenhum dos dois: sem verbo de pagar nem "fatura", pode ser a compra
  // lançada à mão com o nome do cartão. Se a regra mudar, é ehNaoGasto que muda.
  it("'<banco> cartão de crédito' sozinho continua gasto", () => {
    expect(ehNaoGasto({ description: "Itaú cartão de crédito" })).toBe(false);
  });
});
