import { describe, expect, it } from "vitest";
import { parseAmountFlexible, parseBrazilianNumber, parseStatement } from "../statement-parser";

/**
 * CSV FICTÍCIO no formato "data,hora,tipo,origem / destino,valor,forma de pagamento", com o
 * menos tipográfico (U+2212) nas saídas. Uma cliente subiu um desses com 77 linhas e o app leu
 * só as 10 entradas: toda saída virava NaN e sumia.
 */
const CSV = [
  "﻿data,hora,tipo,\"origem / destino\",valor,\"forma de pagamento\"",
  "2026-10-05,14:12,\"Pix enviado\",\"FULANA DE TAL\",\"−R$ 170,00\",\"Com saldo\"",
  "2026-10-01,10:24,\"Rendimento recebido\",\"Rendimento de conta\",\"+R$ 155,51\",",
  "2026-10-01,08:11,\"Pagamento realizado\",\"BANCO EXEMPLO S/A\",\"−R$ 4.552,92\",\"Com saldo\"",
  "2026-09-30,09:39,\"Pix recebido\",\"CICLANO DE SOUZA\",\"+R$ 9.788,20\",",
  "2026-09-04,08:13,\"Dinheiro guardado\",\"No cofrinho Reserva\",\"−R$ 400,00\",\"Com saldo\"",
].join("\n");

describe("menos tipográfico (−) no valor", () => {
  it("vale como sinal de menos", () => {
    expect(parseAmountFlexible("−R$ 170,00")).toBe(-170);
    expect(parseAmountFlexible("– 1.234,56")).toBe(-1234.56);
    expect(parseBrazilianNumber("−R$ 4.552,92")).toBe(-4552.92);
  });

  it("CSV com − nas saídas lê entradas E saídas", () => {
    const txns = parseStatement(CSV, "auto", 2026);
    expect(txns.map((t) => t.amount)).toEqual([-170, 155.51, -4552.92, 9788.2, -400]);
    expect(txns[0]).toMatchObject({ date: "2026-10-05" });
  });
});
