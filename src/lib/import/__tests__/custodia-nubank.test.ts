import { describe, expect, it } from "vitest";
import { profileDocument } from "../profile";

// Amostra fictícia do extrato de custódia do Nubank (saldo das caixinhas, sem entradas e saídas).
const AMOSTRA = `Extrato de Custódia Custódia em: 05/10/2026
Pessoa física titular
Fulana Exemplo
Resumo da posição consolidada
Tipo de investimento Saldo bruto (R$) IR (R$) IOF (R$) Saldo líquido (R$)
Caixinhas 1.950,11 22,54 0,25 1.927,32
Total geral 1.950,11 22,54 0,25 1.927,32
Custódia em Caixinhas
Caixinha "Viagem"
RDB Resgate Imediato Nubank 62,17 1,68 0,00 60,49 No mesmo dia
NU PAGAMENTOS S.A.`;

describe("extrato de custódia do Nubank", () => {
  it("é posição de investimentos, não extrato bancário", () => {
    const p = profileDocument(AMOSTRA, "Nubank_Extrato_de_Custodia.pdf");
    expect(p.kind).toBe("position");
    expect(p.reason).toMatch(/custódia/);
  });
});
