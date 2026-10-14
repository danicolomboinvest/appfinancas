import { describe, expect, it } from "vitest";
import { sobrouDoMes } from "@/lib/consolidation/sobrou";
import { heroiDoMesPassado, paraOndeFoiNoMes, statusDoFechamento, telaDoMes } from "../mes-passado";

const OUT = { ano: 2026, mes: 10 };
const SET = { ano: 2026, mes: 9 };
const JUN = { ano: 2026, mes: 6 };

describe("Qual Resumo abre para o mês do seletor", () => {
  it("o mês de agora abre o Resumo do dia a dia", () => {
    expect(telaDoMes(OUT, OUT)).toBe("atual");
  });
  it("mês que passou abre o fechamento dele, inclusive de outro ano", () => {
    expect(telaDoMes(SET, OUT)).toBe("passado");
    expect(telaDoMes({ ano: 2025, mes: 12 }, OUT)).toBe("passado");
  });
  it("mês que ainda não chegou abre o previsto", () => {
    expect(telaDoMes({ ano: 2026, mes: 11 }, OUT)).toBe("futuro");
    expect(telaDoMes({ ano: 2027, mes: 1 }, OUT)).toBe("futuro");
  });
});

describe("O herói de um mês passado", () => {
  // Os valores de cada mês como as Transações daquele mês mostram (entrou, gastou, guardou).
  const valores: Record<string, { entrou: number; gastou: number; guardou: number }> = {
    "2026-4": { entrou: 6700, gastou: 3000, guardou: 1200 },
    "2026-5": { entrou: 7700, gastou: 6900, guardou: 1529 },
    "2026-7": { entrou: 7900, gastou: 8100, guardou: 1400 },
    "2026-8": { entrou: 7700, gastou: 7000, guardou: 1600 },
    "2026-9": { entrou: 7700, gastou: 6600, guardou: 900 },
  };
  const valorDe = (m: { ano: number; mes: number }) => valores[`${m.ano}-${m.mes}`] ?? { entrou: 0, gastou: 0, guardou: 0 };

  it("o 'ficou com você' é o mesmo sobrou das Transações daquele mês", () => {
    const h = heroiDoMesPassado(SET, valorDe)!;
    expect(h.ficou).toBe(sobrouDoMes(valores["2026-9"]));
    expect(h.ficou).toBe(200);
    expect(h.entrou).toBe(7700);
    expect(h.pct).toBe(3);
  });

  it("compara com o mês anterior e as 6 barras terminam no mês escolhido", () => {
    const h = heroiDoMesPassado(SET, valorDe)!;
    expect(h.pctAnterior).toBe(Math.round((-900 / 7700) * 100));
    expect(h.barras.map((b) => b.rotulo)).toEqual(["abr", "mai", "jun", "jul", "ago", "set"]);
    expect(h.barras[2].pct).toBeNull(); // junho sem nada: sem barra, sem número inventado
  });

  it("saiu mais do que entrou: o valor fica negativo para o herói dizer 'saiu a mais'", () => {
    expect(heroiDoMesPassado({ ano: 2026, mes: 7 }, valorDe)!.ficou).toBe(-1600);
  });

  it("mês sem nenhum lançamento: nada (vira 'Sem lançamentos em junho')", () => {
    expect(heroiDoMesPassado(JUN, valorDe)).toBeNull();
  });
});

describe("Para onde foi, mês inteiro contra mês inteiro", () => {
  const g = (categoria: string, valor: number) => ({ categoria, valor });

  it("as 4 que mais mudaram, contando o mês todo (sem corte de dia)", () => {
    const set = [g("ALIMENTACAO", 1200), g("LAZER", 300), g("TRANSPORTE", 500), g("SAUDE", 90), g("COMPRAS", 800)];
    const ago = [g("ALIMENTACAO", 900), g("LAZER", 700), g("TRANSPORTE", 480), g("SAUDE", 90), g("COMPRAS", 100)];
    const { linhas, comparou } = paraOndeFoiNoMes(set, ago, new Set());
    expect(comparou).toBe(true);
    expect(linhas.map((l) => [l.categoria, l.diferenca])).toEqual([
      ["COMPRAS", 700],
      ["LAZER", -400],
      ["ALIMENTACAO", 300],
      ["TRANSPORTE", 20],
    ]);
  });

  it("conta fixa que não mudou não ocupa lugar", () => {
    const { linhas } = paraOndeFoiNoMes([g("MORADIA", 2000), g("LAZER", 200)], [g("MORADIA", 2000), g("LAZER", 100)], new Set(["MORADIA"]));
    expect(linhas.map((l) => l.categoria)).toEqual(["LAZER"]);
  });

  it("sem o mês anterior no app: as 4 maiores, sem fingir que tudo subiu", () => {
    const { linhas, comparou } = paraOndeFoiNoMes([g("A", 10), g("B", 50), g("C", 30), g("D", 20), g("E", 40)], [], new Set());
    expect(comparou).toBe(false);
    expect(linhas.map((l) => l.categoria)).toEqual(["B", "E", "C", "D"]);
  });
});

describe("A linha do fechamento", () => {
  const nao = { estado: "nao_fechado" as const, em: null };

  it("o mês imediatamente anterior, ainda não fechado: botão 'Fechar setembro'", () => {
    expect(statusDoFechamento(SET, OUT, nao)).toEqual({ tipo: "fechar", rotulo: "Fechar setembro" });
  });

  it("reaberto conta como não fechado", () => {
    expect(statusDoFechamento(SET, OUT, { estado: "reaberto", em: new Date() })?.tipo).toBe("fechar");
  });

  it("dezembro visto em janeiro também é o mês anterior", () => {
    expect(statusDoFechamento({ ano: 2025, mes: 12 }, { ano: 2026, mes: 1 }, nao)?.rotulo).toBe("Fechar dezembro");
  });

  it("fechado: 'Fechado em dd/mm', no dia de Brasília", () => {
    // 02h00 UTC de 4/10 ainda é dia 3 em Brasília.
    expect(statusDoFechamento(SET, OUT, { estado: "fechado", em: new Date("2026-10-04T02:00:00Z") })).toEqual({ tipo: "fechado", rotulo: "Fechado em 03/10" });
  });

  it("meses mais antigos, não fechados: só o resumo", () => {
    expect(statusDoFechamento(JUN, OUT, nao)).toBeNull();
  });
});
