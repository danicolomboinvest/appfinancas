import { describe, expect, it } from "vitest";
import { resumoDoMes } from "../month-budget-summary";

/** Setembro de 2026 tem 30 dias. Dia 20 = 2/3 do mês. */
const dia = (d: number) => new Date(2026, 8, d, 12, 0, 0);
const base = { ano: 2026, mes: 9 };

describe("resumoDoMes", () => {
  it("responde a pergunta do caixa do mercado: quanto por dia até o fim", () => {
    const r = resumoDoMes({ ...base, planejado: 3000, gasto: 1850, hoje: dia(20) });
    expect(r.restante).toBe(1150);
    expect(r.diasRestantes).toBe(11); // dia 20 até 30, contando hoje
    expect(r.porDia).toBeCloseTo(1150 / 11, 2);
  });

  it("no ritmo quando o gasto acompanha a altura do mês", () => {
    // Dia 15 de 30 = metade do mês, metade do orçamento.
    expect(resumoDoMes({ ...base, planejado: 3000, gasto: 1500, hoje: dia(15) }).situacao).toBe("no-ritmo");
  });

  it("adiantado quando gastou bem mais do que a altura do mês", () => {
    const r = resumoDoMes({ ...base, planejado: 3000, gasto: 2400, hoje: dia(10) });
    expect(r.situacao).toBe("adiantado");
  });

  /**
   * Quem paga aluguel no dia 5 não pode abrir o app no dia 6 e ser chamada de esbanjadora.
   * A conta grande do começo do mês precisa caber na folga.
   */
  it("não acusa quem pagou a conta grande no começo do mês", () => {
    // Dia 6 de 30 (20% do mês), aluguel de R$ 900 num orçamento de 3.000 = 30% gasto.
    expect(resumoDoMes({ ...base, planejado: 3000, gasto: 900, hoje: dia(6) }).situacao).toBe("no-ritmo");
  });

  it("folgado quando sobra bem mais do que devia", () => {
    expect(resumoDoMes({ ...base, planejado: 3000, gasto: 300, hoje: dia(20) }).situacao).toBe("folgado");
  });

  it("estourou é estourou, mesmo no fim do mês", () => {
    const r = resumoDoMes({ ...base, planejado: 3000, gasto: 3400, hoje: dia(29) });
    expect(r.situacao).toBe("estourou");
    expect(r.restante).toBe(-400);
    // Não existe "quanto posso gastar por dia" depois de estourar.
    expect(r.porDia).toBeNull();
  });

  it("sem orçamento não inventa julgamento", () => {
    const r = resumoDoMes({ ...base, planejado: 0, gasto: 800, hoje: dia(20) });
    expect(r.situacao).toBe("sem-plano");
    expect(r.usado).toBeNull();
    expect(r.porDia).toBeNull();
  });

  it("no último dia ainda conta o dia de hoje", () => {
    const r = resumoDoMes({ ...base, planejado: 3000, gasto: 2000, hoje: dia(30) });
    expect(r.diasRestantes).toBe(1);
    expect(r.porDia).toBe(1000);
  });

  it("mês que não é o corrente não tem dias restantes nem valor por dia", () => {
    const r = resumoDoMes({ ano: 2026, mes: 7, planejado: 3000, gasto: 2100, hoje: dia(20) });
    expect(r.diasRestantes).toBe(0);
    expect(r.porDia).toBeNull();
    expect(r.doMes).toBe(1);
  });

  it("gasto zerado no dia 1 não vira alarme", () => {
    const r = resumoDoMes({ ...base, planejado: 3000, gasto: 0, hoje: dia(1) });
    expect(r.situacao).toBe("no-ritmo");
    expect(r.porDia).toBeCloseTo(100, 2); // 3000 / 30 dias
  });
});
