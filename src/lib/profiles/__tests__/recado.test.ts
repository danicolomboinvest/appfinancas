import { describe, expect, it } from "vitest";
import { recadoDeHoje, type DadosDoRecado } from "../recado";

const money = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

const base: DadosDoRecado = {
  categorias: [
    { label: "Lazer", planejado: 1000, gasto: 300 },
    { label: "Alimentação", planejado: 2000, gasto: 900 },
  ],
  mesDecorrido: 0.4,
  diasRestantes: 18,
  mesesSeguidosGuardando: 1,
  metas: [],
  gastoDoMes: 3000,
  gastoDoMesAnterior: 3200,
  rendaDoMes: 8000,
  rendaDoMesAnterior: 8000,
  planejadoDoMes: 7300,
  mesFechado: false,
  money,
};

describe("recado de hoje (Disciplina)", () => {
  it("fica em silêncio quando não há o que cobrar nem elogiar", () => {
    expect(recadoDeHoje(base)).toBeNull();
  });

  it("cobra a categoria que passou de 70% antes de 70% do mês, com número e prazo", () => {
    const r = recadoDeHoje({ ...base, categorias: [{ label: "Lazer", planejado: 1000, gasto: 740 }] });
    expect(r?.tom).toBe("cobranca");
    expect(r?.linha1).toBe("Você já gastou 74% do orçamento de lazer e ainda faltam 18 dias.");
    expect(r?.linha2).toBe("A conta não fecha sozinha. Bora segurar essa categoria até o fim do mês.");
  });

  it("elogia o mês fechado que gastou menos que o anterior", () => {
    const r = recadoDeHoje({ ...base, mesFechado: true, gastoDoMes: 2586, gastoDoMesAnterior: 3200 });
    expect(r?.tom).toBe("elogio");
    expect(r?.linha1).toBe("R$ 614 a menos que no mês passado.");
  });

  it("reconhece três meses seguidos guardando", () => {
    const r = recadoDeHoje({ ...base, mesesSeguidosGuardando: 3 });
    expect(r?.linha1).toBe("Você está há 3 meses guardando dinheiro sem falhar.");
  });

  it("lembra a meta quando o gasto está acima do ritmo", () => {
    const r = recadoDeHoje({ ...base, gastoDoMes: 5000, metas: [{ nome: "Viajar", faltam: 2840 }] });
    expect(r?.linha1).toBe("Faltam R$ 2.840 para sua meta.");
    expect(r?.linha2).toBe("Cada compra agora compete com a meta. Bora escolher.");
  });

  it("alerta quando está saindo do plano e ainda dá tempo", () => {
    const r = recadoDeHoje({ ...base, gastoDoMes: 5000 });
    expect(r?.tom).toBe("alerta");
    expect(r?.titulo).toContain("saindo do plano");
  });

  /** O cuidado a mais: mês em que a renda despencou não é hora de cobrar disciplina. */
  it("cala a boca quando a renda despencou", () => {
    const r = recadoDeHoje({ ...base, rendaDoMes: 3000, rendaDoMesAnterior: 8000, gastoDoMes: 5000, categorias: [{ label: "Lazer", planejado: 1000, gasto: 900 }] });
    expect(r).toBeNull();
  });

  it("nunca usa adjetivo sobre a pessoa", () => {
    const variantes = [
      { ...base, categorias: [{ label: "Lazer", planejado: 1000, gasto: 900 }] },
      { ...base, gastoDoMes: 5000 },
      { ...base, gastoDoMes: 5000, metas: [{ nome: "Viajar", faltam: 100 }] },
    ];
    for (const v of variantes) {
      const r = recadoDeHoje(v)!;
      const texto = `${r.titulo} ${r.linha1} ${r.linha2}`;
      expect(texto).not.toMatch(/você é|péssim|irrespons|preguiç|desastr/i);
      // Toda cobrança cita um número.
      expect(texto).toMatch(/\d/);
    }
  });
});
