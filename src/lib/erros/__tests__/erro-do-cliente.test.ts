import { describe, expect, it } from "vitest";
import { montarErroDoCliente } from "../erro-do-cliente";
import { ACEITA_ARQUIVO_DE_EXTRATO } from "@/lib/import/limites";

describe("erro que acontece no aparelho", () => {
  it("guarda onde e a mensagem, sem e-mail nem números longos", () => {
    const e = montarErroDoCliente("lancar", new TypeError("Falhou para hadas@exemplo.com com 123.456.789-00"), "/mensal/2026/10?x=1");
    expect(e.onde).toBe("lancar");
    expect(e.mensagem).toBe("TypeError: Falhou para [email] com [número]");
    expect(e.rota).toBe("/mensal/2026/10");
  });
  it("onde desconhecido vira 'outro' e mensagem vazia não quebra", () => {
    expect(montarErroDoCliente("qualquer", undefined, "").onde).toBe("outro");
    expect(montarErroDoCliente("voz", "", "/").mensagem.length).toBeGreaterThan(0);
  });
});

describe("o campo de arquivo do extrato no iPhone", () => {
  it("aceita CSV por extensão e por todos os tipos que o iOS usa", () => {
    for (const t of [".csv", "text/csv", "text/comma-separated-values", "application/vnd.ms-excel", ".ofx", ".pdf", ".xlsx"]) {
      expect(ACEITA_ARQUIVO_DE_EXTRATO.split(",")).toContain(t);
    }
  });
});
