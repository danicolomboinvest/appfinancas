import { describe, expect, it } from "vitest";
import { ehImpossivel, simularQuitacao } from "../plano";
import { paraResolver, type DividaDoSpi } from "../saude";

/**
 * Escolha do assistente (14/10/2026, a pedido da Dani: "você veja o que é melhor"): o "quanto falta
 * pagar" é o saldo para quitar HOJE, e a data de quitação nunca passa do fim do contrato (as parcelas
 * que faltam). Sem parcelas informadas, a conta é a de sempre.
 */
const base = { apelido: "", paraQue: null, planejada: false, parcelasTotal: null, semParcela: false, diaVencimento: null, atrasada: false, credor: "Banco" };
const emprestimo = (o: Partial<DividaDoSpi>): DividaDoSpi => ({ ...base, id: "e1", nome: "Empréstimo", tipo: "emprestimo", saldo: 3000, porMes: 1000, taxaMensal: null, parcelasAbertas: null, ...o });
const plano = (d: DividaDoSpi[], extra: number) => {
  const p = simularQuitacao(d, extra);
  if (ehImpossivel(p)) throw new Error("plano impossível");
  return p;
};

describe("a data não passa do fim do contrato", () => {
  it("3 parcelas de R$ 1.000 e saldo R$ 3.000 (taxa estimada 4%): 3 meses, não 4", () => {
    const p = plano([emprestimo({ parcelasAbertas: 3 })], 0);
    expect(p.meses).toBe(3);
    expect(p.quitacoes[0].mes).toBe(3);
  });

  it("sem parcelas informadas segue a conta de sempre (4 meses, R$ 263 de juros)", () => {
    const p = plano([emprestimo({})], 0);
    expect(p.meses).toBe(4);
    expect(Math.round(p.totalJuros)).toBe(263);
  });

  it("saldo pequeno, 3 parcelas: acaba antes do contrato, pelo pagamento", () => {
    expect(plano([emprestimo({ saldo: 1500, parcelasAbertas: 3 })], 0).meses).toBe(2);
  });

  it("saldo alto com poucas parcelas: o contrato manda, o resto entra no total pago", () => {
    const p = plano([emprestimo({ saldo: 10000, parcelasAbertas: 3 })], 0);
    expect(p.meses).toBe(3);
    expect(p.totalPago).toBeGreaterThan(10000);
    expect(p.totalJuros).toBeGreaterThan(0);
  });

  it("o 'a mais' zerado e positivo: com o a mais, antecipa; nunca passa de 3", () => {
    const sem = plano([emprestimo({ parcelasAbertas: 3 })], 0);
    const com = plano([emprestimo({ parcelasAbertas: 3 })], 1000);
    expect(sem.meses).toBe(3);
    expect(com.meses).toBe(2);
  });

  it("juros zero: 3 parcelas de R$ 1.000 pagam R$ 3.000 em 3 meses, sem juros", () => {
    const p = plano([emprestimo({ tipo: "pessoa", taxaMensal: 0, parcelasAbertas: 3 })], 0);
    expect(p.meses).toBe(3);
    expect(Math.round(p.totalJuros)).toBe(0);
  });

  it("taxa alta (12% ao mês) que não deixaria quitar: o contrato fecha em 4 e a tela não diz 'impossível'", () => {
    const d = emprestimo({ saldo: 5000, porMes: 400, taxaMensal: 12, parcelasAbertas: 4 });
    expect(plano([d], 0).meses).toBe(4);
    // sem o prazo do contrato a conta continua impossível, como no Rota
    const semPrazo = emprestimo({ ...d, parcelasAbertas: null });
    expect(ehImpossivel(simularQuitacao([semPrazo], 0))).toBe(true);
  });

  it("sem parcela e sem juros: 'nada sai do lugar' continua", () => {
    const mae = emprestimo({ tipo: "pessoa", saldo: 500, porMes: 0, taxaMensal: 0, parcelasAbertas: null });
    expect(ehImpossivel(simularQuitacao([mae], 0))).toBe(true);
  });

  it("marcada como 'sem parcela', o número de parcelas é ignorado", () => {
    expect(plano([emprestimo({ saldo: 3000, semParcela: true, parcelasAbertas: 3 })], 0).meses).toBe(4);
  });

  it("herói e lista dizem a mesma data: o herói é o maior mês entre as quitações", () => {
    const a = emprestimo({ id: "a", parcelasAbertas: 3 });
    const b = emprestimo({ id: "b", nome: "Carnê", tipo: "carne_loja", saldo: 2000, porMes: 300, taxaMensal: 5, parcelasAbertas: 5 });
    const p = plano(paraResolver([a, b], 14.25), 100);
    expect(p.meses).toBe(Math.max(...p.quitacoes.map((q) => q.mes)));
    expect(p.quitacoes.find((q) => q.id === "a")!.mes).toBeLessThanOrEqual(3);
    expect(p.quitacoes.find((q) => q.id === "b")!.mes).toBeLessThanOrEqual(5);
  });
});
