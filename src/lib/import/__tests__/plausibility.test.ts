import { describe, it, expect } from "vitest";
import { checarPlausibilidade } from "../plausibility";

type T = { date: string; description: string; amount: number };
const t = (description: string, amount: number): T => ({ date: "2026-08-17", description, amount });

describe("checarPlausibilidade", () => {
  /**
   * O caso real que motivou o freio: o extrato da cliente entrou com o número do documento no
   * lugar do valor. Tudo virou entrada, nenhum valor tinha centavo, e "TV POR ASSINATURA" virou
   * uma receita de oito milhões. Ficou dias assim, sem ninguém perceber.
   */
  it("pega a leitura que corrompeu o extrato de verdade", () => {
    const corrompido = [
      t("RENTAB.INVEST FACILCRED*", 2),
      t("COMPRA CARTAO VISA", 569892),
      t("TV POR ASSINATURA", 8159526),
      t("PIX ENVIADO", 1134391),
      t("PIX ENVIADO", 2339097),
      t("PIX RECEBIDO", 758561),
      t("PAGAMENTO BOLETO", 445100),
      t("TARIFA PACOTE SERVICOS", 331200),
      t("DEBITO AUTOMATICO", 129400),
      t("COMPRA CARTAO VISA", 87300),
    ];
    const suspeitas = checarPlausibilidade(corrompido, "extrato");
    const tudo = suspeitas.map((s) => s.texto).join(" | ");
    expect(tudo).toMatch(/fora de escala/);
    expect(tudo).toMatch(/ENTRADA de dinheiro/);
    expect(tudo).toMatch(/centavos/);
    // O aviso serve pra pessoa reconhecer o próprio extrato, então precisa citar linha de verdade.
    expect(suspeitas.some((s) => s.exemplos.some((e) => e.includes("TV POR ASSINATURA")))).toBe(true);
  });

  it("não reclama de um extrato normal", () => {
    const normal = [
      t("SALARIO", 7200.45),
      t("PIX ENVIADO ALUGUEL", -2300),
      t("MERCADO EXTRA", -412.87),
      t("FARMACIA", -96.3),
      t("UBER", -23.9),
      t("NETFLIX", -55.9),
      t("PIX RECEBIDO MAE", 300),
      t("CONTA DE LUZ", -187.44),
      t("RESTAURANTE", -78.5),
      t("POSTO IPIRANGA", -240.18),
    ];
    expect(checarPlausibilidade(normal, "extrato")).toEqual([]);
  });

  /** Aluguel e salário são redondos de verdade. Poucos lançamentos não podem virar alarme. */
  it("não alarma com arquivo pequeno de valores redondos legítimos", () => {
    const poucos = [t("SALARIO", 5000), t("ALUGUEL", -1500), t("PIX ENVIADO", -200), t("MERCADO", -430.22)];
    expect(checarPlausibilidade(poucos, "extrato")).toEqual([]);
  });

  /** Fatura de cartão é só gasto por natureza: o sinal de "tudo entrada" não vale ali. */
  it("não usa a regra de entradas numa fatura", () => {
    const fatura = Array.from({ length: 12 }, (_, i) => t(`COMPRA ${i}`, 120.5 + i));
    expect(checarPlausibilidade(fatura, "fatura")).toEqual([]);
  });

  it("pega um único valor fora de escala mesmo com o resto normal", () => {
    const quaseBom = [
      t("SALARIO", 6000.32),
      t("MERCADO", -321.44),
      t("TRANSFERENCIA", 4500000.0),
      t("UBER", -32.1),
      t("LUZ", -142.87),
    ];
    const suspeitas = checarPlausibilidade(quaseBom, "extrato");
    expect(suspeitas.map((s) => s.texto).join(" ")).toMatch(/fora de escala/);
  });

  it("arquivo vazio não vira alarme", () => {
    expect(checarPlausibilidade([], "extrato")).toEqual([]);
  });
});
