import { describe, expect, it } from "vitest";
import { ehNaoGasto, SUBCATEGORIA_NAO_E_GASTO } from "../nao-e-gasto";

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
});
