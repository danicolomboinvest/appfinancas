import { describe, expect, it } from "vitest";
import { dividirDespesasDoCasal } from "../divisao-casal";

describe("divisão proporcional das contas do casal", () => {
  it("divide as despesas comuns na mesma proporção da renda de cada um", () => {
    // 6.000 de renda conjunta (3.600 + 2.400): 60% e 40%.
    const r = dividirDespesasDoCasal({ rendaA: 3600, rendaB: 2400, despesasComuns: 2000 });
    expect(r.rendaConjunta).toBe(6000);
    expect(r.pctA).toBeCloseTo(0.6);
    expect(r.pctB).toBeCloseTo(0.4);
    expect(r.contribuicaoA).toBeCloseTo(1200);
    expect(r.contribuicaoB).toBeCloseTo(800);
    // As duas contribuições somam o total das despesas comuns.
    expect(r.contribuicaoA + r.contribuicaoB).toBeCloseTo(2000);
  });

  it("compara com o 50/50 e diz quanto isso poupa de quem ganha menos", () => {
    const r = dividirDespesasDoCasal({ rendaA: 3600, rendaB: 2400, despesasComuns: 2000 });
    expect(r.contribuicaoIgual).toBe(1000);
    // Proporcional: B paga 800 em vez de 1.000 — poupa 200 comparado ao 50/50.
    expect(r.diferencaParaB).toBeCloseTo(200);
  });

  it("rendas iguais dão o mesmo resultado que 50/50", () => {
    const r = dividirDespesasDoCasal({ rendaA: 4000, rendaB: 4000, despesasComuns: 3000 });
    expect(r.pctA).toBeCloseTo(0.5);
    expect(r.contribuicaoA).toBeCloseTo(1500);
    expect(r.contribuicaoB).toBeCloseTo(1500);
    expect(r.diferencaParaB).toBeCloseTo(0);
  });

  it("sem renda nenhuma cadastrada, cai 50/50 em vez de travar (divisão por zero)", () => {
    const r = dividirDespesasDoCasal({ rendaA: 0, rendaB: 0, despesasComuns: 2000 });
    expect(r.pctA).toBe(0.5);
    expect(r.pctB).toBe(0.5);
    expect(r.contribuicaoA).toBe(1000);
    expect(r.contribuicaoB).toBe(1000);
  });

  it("mostra o que sobra pra cada um depois de pagar a parte das contas comuns", () => {
    const r = dividirDespesasDoCasal({ rendaA: 3600, rendaB: 2400, despesasComuns: 2000 });
    expect(r.sobraA).toBeCloseTo(3600 - 1200);
    expect(r.sobraB).toBeCloseTo(2400 - 800);
  });

  it("ignora renda ou despesa negativa em vez de inverter a conta", () => {
    const r = dividirDespesasDoCasal({ rendaA: -100, rendaB: 2000, despesasComuns: -50 });
    // -100 vira 0: a renda conjunta é só a de B.
    expect(r.rendaConjunta).toBe(2000);
    expect(r.pctA).toBe(0);
    expect(r.pctB).toBe(1);
    // -50 vira 0: nenhuma despesa pra dividir.
    expect(r.contribuicaoA).toBe(0);
    expect(r.contribuicaoB).toBe(0);
  });

  it("sem percentual manual, não marca como manual e usa a proporção da renda", () => {
    const r = dividirDespesasDoCasal({ rendaA: 3600, rendaB: 2400, despesasComuns: 2000 });
    expect(r.manual).toBe(false);
    expect(r.pctBSugeridoPelaRenda).toBeCloseTo(0.4);
    expect(r.pctB).toBeCloseTo(r.pctBSugeridoPelaRenda);
  });
});

describe("percentual combinado à mão (o casal já decidiu um número próprio)", () => {
  it("usa o percentual digitado em vez do calculado pela renda", () => {
    // Mesma renda de antes (sugeriria 40% pra B), mas o casal combinou 30% pra B.
    const r = dividirDespesasDoCasal({ rendaA: 3600, rendaB: 2400, despesasComuns: 2000, pctBManual: 0.3 });
    expect(r.manual).toBe(true);
    expect(r.pctB).toBeCloseTo(0.3);
    expect(r.pctA).toBeCloseTo(0.7);
    expect(r.contribuicaoB).toBeCloseTo(600);
    expect(r.contribuicaoA).toBeCloseTo(1400);
    // A sugestão pela renda continua disponível pra comparar, mesmo não sendo a usada.
    expect(r.pctBSugeridoPelaRenda).toBeCloseTo(0.4);
  });

  it("as duas contribuições continuam somando o total das despesas comuns", () => {
    const r = dividirDespesasDoCasal({ rendaA: 3600, rendaB: 2400, despesasComuns: 2000, pctBManual: 0.75 });
    expect(r.contribuicaoA + r.contribuicaoB).toBeCloseTo(2000);
  });

  it("um percentual manual de 50% é só mais um valor manual válido, não vira automático", () => {
    const r = dividirDespesasDoCasal({ rendaA: 3600, rendaB: 2400, despesasComuns: 2000, pctBManual: 0.5 });
    expect(r.manual).toBe(true);
    expect(r.contribuicaoA).toBeCloseTo(1000);
    expect(r.contribuicaoB).toBeCloseTo(1000);
  });

  it("percentual fora de 0–1 é travado no limite, em vez de dar contribuição negativa ou maior que o total", () => {
    const acima = dividirDespesasDoCasal({ rendaA: 3600, rendaB: 2400, despesasComuns: 2000, pctBManual: 1.4 });
    expect(acima.pctB).toBe(1);
    expect(acima.contribuicaoB).toBeCloseTo(2000);
    expect(acima.contribuicaoA).toBe(0);

    const abaixo = dividirDespesasDoCasal({ rendaA: 3600, rendaB: 2400, despesasComuns: 2000, pctBManual: -0.2 });
    expect(abaixo.pctB).toBe(0);
    expect(abaixo.contribuicaoB).toBe(0);
  });
});
