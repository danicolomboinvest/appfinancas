import { describe, expect, it } from "vitest";
import { lerNotificacoes } from "../print-notificacao";
import type { Segmento } from "../print-fatura";

const seg = (texto: string, y: number): Segmento => ({ texto, x0: 0, y0: y, x1: 100, y1: y + 30 });
const ENVIO = "2026-10-26";

describe("print de notificação de compra no cartão", () => {
  it("lê a notificação do Nubank como uma compra no dia do envio", () => {
    const r = lerNotificacoes(
      [seg("Compra no crédito aprovada", 0), seg("há 2h", 0), seg("Compra de R$ 40,08 APROVADA em", 40), seg("Loja Exemplo *Lanche pend para o cartão", 80), seg("com final 1234.", 120)],
      ENVIO,
    );
    expect(r?.linhas).toHaveLength(1);
    expect(r?.linhas[0]).toMatchObject({ data: ENVIO, nome: "Loja Exemplo Lanche", valor: 40.08, credito: false });
  });

  it("lê várias notificações e valor com milhar", () => {
    const r = lerNotificacoes(
      [seg("Compra de R$ 1.250,00 APROVADA em Mercado Teste para o cartão com final 1111.", 0), seg("Compra de R$ 9,90 APROVADA em Padaria Teste para o cartão com final 1111.", 50)],
      ENVIO,
    );
    expect(r?.linhas.map((l) => [l.nome, l.valor])).toEqual([["Mercado Teste", 1250], ["Padaria Teste", 9.9]]);
  });

  it("não aceita compra no débito (sai da conta, não do cartão)", () => {
    expect(lerNotificacoes([seg("Compra no débito aprovada", 0), seg("Compra de R$ 10,00 APROVADA em Loja Teste para o cartão com final 1.", 40)], ENVIO)).toBeNull();
  });

  it("devolve null quando não é notificação", () => {
    expect(lerNotificacoes([seg("Fatura atual", 0), seg("R$ 100,00", 40)], ENVIO)).toBeNull();
  });
});
