import { describe, expect, it } from "vitest";
import { folgaDe, nivelDaCategoria, planoDeCobrir, porDiaComOLivre, quantoPassou, revisaoDoPlano, type CategoriaParaRemanejo } from "../remanejo";

/** O plano de outubro da Ana (ana-canonica.md, seção 1). "Compras" no app real é Outros. */
const ana: CategoriaParaRemanejo[] = [
  { key: "MORADIA", label: "Moradia", planejado: 2700, gasto: 2666 },
  { key: "ALIMENTACAO", label: "Alimentação", planejado: 1500, gasto: 360 },
  { key: "OUTROS", label: "Compras", planejado: 950, gasto: 0 },
  { key: "TRANSPORTE", label: "Transporte", planejado: 800, gasto: 181 },
  { key: "LAZER", label: "Lazer", planejado: 600, gasto: 186 },
  { key: "EDUCACAO", label: "Educação", planejado: 400, gasto: 249 },
  { key: "SAUDE", label: "Saúde", planejado: 350, gasto: 417 },
];
const saude = ana.find((c) => c.key === "SAUDE")!;

describe("remanejo por prioridade (regra 3.1)", () => {
  it("Ana: Saúde passou R$ 67 e sai de Compras, sobrando R$ 883", () => {
    expect(quantoPassou(saude)).toBe(67);
    const p = planoDeCobrir(saude, ana);
    expect(p).toMatchObject({ valor: 67, nivel: 1, principal: "tirar" });
    expect(p.origens).toEqual([{ key: "OUTROS", label: "Compras", valor: 67, folga: 950, sobraDepois: 883 }]);
  });

  it("nunca sugere Alimentação enquanto o desejo tiver folga, nem Moradia, Saúde, Educação ou Impostos", () => {
    const p = planoDeCobrir(saude, ana);
    expect(p.origens.map((o) => o.key)).not.toContain("ALIMENTACAO");
    for (const k of ["MORADIA", "SAUDE", "EDUCACAO", "IMPOSTOS"]) expect(nivelDaCategoria({ key: k })).toBeNull();
    expect(nivelDaCategoria({ key: "ALIMENTACAO" })).toBe(2);
    expect(nivelDaCategoria({ key: "TRANSPORTE" })).toBe(2);
    expect(nivelDaCategoria({ key: "LAZER" })).toBe(1);
  });

  it("combina no máximo duas, a de maior folga inteira e o resto da segunda", () => {
    const cats = ana.map((c) => (c.key === "OUTROS" ? { ...c, gasto: 910 } : c.key === "LAZER" ? { ...c, gasto: 573 } : c));
    // Compras tem 40 de folga, Lazer 27: R$ 40 de Compras + R$ 27 de Lazer.
    const p = planoDeCobrir(saude, cats);
    expect(p.nivel).toBe(1);
    expect(p.origens.map((o) => [o.label, o.valor])).toEqual([["Compras", 40], ["Lazer", 27]]);
    expect(p.origens.reduce((s, o) => s + o.valor, 0)).toBe(67);
  });

  it("sem folga no desejo, cai no dia a dia e o botão principal vira 'Usar o livre do mês'", () => {
    const cats = ana.map((c) => (c.key === "OUTROS" ? { ...c, gasto: 950 } : c.key === "LAZER" ? { ...c, gasto: 600 } : c));
    const p = planoDeCobrir(saude, cats, { diasRestantes: 18, diasNoMes: 31 });
    expect(p).toMatchObject({ nivel: 2, principal: "livre" });
    expect(p.origens[0].key).toBe("ALIMENTACAO");
  });

  it("nada cobre: só 'Usar o livre do mês'", () => {
    const cats = ana.map((c) => ({ ...c, gasto: c.key === "SAUDE" ? c.gasto : c.planejado }));
    expect(planoDeCobrir(saude, cats)).toEqual({ valor: 67, nivel: null, origens: [], principal: "livre" });
  });

  it("categoria criada pela pessoa é desejo, a menos que seja essencial", () => {
    expect(nivelDaCategoria({ key: "cat123" })).toBe(1);
    expect(nivelDaCategoria({ key: "cat123", essencial: true })).toBeNull();
    const cats = [...ana.map((c) => (c.key === "OUTROS" || c.key === "LAZER" ? { ...c, gasto: c.planejado } : c)), { key: "pet", label: "Pet", planejado: 300, gasto: 0, essencial: true }];
    expect(planoDeCobrir(saude, cats).origens.map((o) => o.key)).not.toContain("pet");
  });

  it("o total do plano não muda: o que sai de uma é o que entra na outra", () => {
    const p = planoDeCobrir(saude, ana);
    const antes = ana.reduce((s, c) => s + c.planejado, 0);
    const depois = ana.reduce((s, c) => s + c.planejado + (c.key === "SAUDE" ? p.valor : 0) - (p.origens.find((o) => o.key === c.key)?.valor ?? 0), 0);
    expect(depois).toBe(antes);
  });

  it("usar o livre do mês: R$ 3.241 − 67 em 25 dias dá R$ 127 por dia", () => {
    expect(Math.round(porDiaComOLivre(3241, 67, 25))).toBe(127);
    expect(folgaDe({ planejado: 100, gasto: 150 })).toBe(0);
  });

  it("rever o plano só depois de 3 meses seguidos acima de 110%", () => {
    expect(revisaoDoPlano([{ gasto: 400, planejado: 350 }, { gasto: 420, planejado: 350 }, { gasto: 417, planejado: 350 }])).toEqual({ mediana: 420 });
    expect(revisaoDoPlano([{ gasto: 400, planejado: 350 }, { gasto: 360, planejado: 350 }, { gasto: 417, planejado: 350 }])).toBeNull();
    expect(revisaoDoPlano([{ gasto: 400, planejado: 350 }, { gasto: 417, planejado: 350 }])).toBeNull();
  });
});

import { fontesParaCobrir, quantoDaParaTirar, reservaDoRitmo } from "../remanejo";

describe("Cobrir com outra categoria: as opções", () => {
  const saude = { key: "SAUDE", label: "Saúde", planejado: 350, gasto: 416.4 };
  it("só desejo que cobre sozinha; nem dia a dia nem essencial viram opção solta", () => {
    const r = fontesParaCobrir(saude, [
      saude,
      { key: "LAZER", label: "Lazer", planejado: 600, gasto: 186 },
      { key: "ALIMENTACAO", label: "Alimentação", planejado: 1500, gasto: 360 },
      { key: "MORADIA", label: "Moradia", planejado: 2700, gasto: 100 },
      { key: "OUTROS", label: "Outros", planejado: 950, gasto: 900 },
      { key: "pet", label: "Pet", planejado: 300, gasto: 0, essencial: true },
    ]);
    // Alimentação cobriria sozinha, mas Lazer cobre: o dia a dia não aparece (15/10/2026).
    expect(r.map((o) => [o.label, o.valor, o.sobraDepois])).toEqual([["Lazer", 67, 347]]);
  });
  it("nada passou: sem opções", () => {
    expect(fontesParaCobrir({ key: "LAZER", label: "Lazer", planejado: 600, gasto: 10 }, [])).toEqual([]);
  });
});

describe("ordem de remanejo da Dani (15/10/2026: zerou Alimentação no dia 14 em vez de usar Outros)", () => {
  // Dia 14 de outubro: faltam 18 dias com hoje.
  const dia14 = { diasRestantes: 18, diasNoMes: 31 };
  const passou = { key: "LAZER", label: "Lazer", planejado: 300, gasto: 600 }; // passou R$ 300
  const cats: CategoriaParaRemanejo[] = [
    passou,
    { key: "OUTROS", label: "Outros", planejado: 400, gasto: 280 }, // R$ 120 livres
    { key: "ALIMENTACAO", label: "Alimentação", planejado: 1200, gasto: 900 }, // R$ 300 livres, gastando ~R$ 64 por dia
    { key: "TRANSPORTE", label: "Transporte", planejado: 500, gasto: 100 }, // R$ 400 livres, ~R$ 7 por dia
    { key: "MORADIA", label: "Moradia", planejado: 2500, gasto: 0 },
    { key: "SAUDE", label: "Saúde", planejado: 600, gasto: 0 },
    { key: "EDUCACAO", label: "Educação", planejado: 500, gasto: 0 },
  ];

  it("a opção solta nunca é Alimentação inteira quando Outros não cobre sozinha", () => {
    expect(fontesParaCobrir(passou, cats)).toEqual([]);
  });

  it("Outros sai primeiro, todo; o resto vem do dia a dia sem zerar quem ainda vai gastar", () => {
    const p = planoDeCobrir(passou, cats, dia14);
    expect(p.nivel).toBe(2);
    expect(p.origens[0]).toMatchObject({ key: "OUTROS", valor: 120 });
    expect(p.origens.reduce((s, o) => s + o.valor, 0)).toBe(300);
    // Alimentação ainda vai gastar ~R$ 1.157 no ritmo: não tem nada para dar. Sai de Transporte.
    expect(p.origens.map((o) => o.key)).not.toContain("ALIMENTACAO");
    const transporte = p.origens.find((o) => o.key === "TRANSPORTE")!;
    expect(transporte.valor).toBe(180);
    expect(transporte.sobraDepois).toBeGreaterThanOrEqual(reservaDoRitmo({ planejado: 500, gasto: 100 }, dia14));
  });

  it("Moradia, Saúde e Educação nunca entram, nem com folga sobrando", () => {
    const p = planoDeCobrir(passou, cats, dia14);
    for (const k of ["MORADIA", "SAUDE", "EDUCACAO"]) expect(p.origens.map((o) => o.key)).not.toContain(k);
    const semDiaADia = cats.filter((c) => c.key !== "TRANSPORTE");
    expect(planoDeCobrir(passou, semDiaADia, dia14)).toEqual({ valor: 300, nivel: null, origens: [], principal: "livre" });
  });

  it("dia a dia nunca fica abaixo do que ainda vai gastar no ritmo", () => {
    const ali = { key: "ALIMENTACAO", label: "Alimentação", planejado: 1500, gasto: 360 };
    // R$ 360 em 14 dias: ~R$ 25,71 por dia, R$ 463 para os 18 que faltam. Dá para tirar R$ 677.
    expect(reservaDoRitmo(ali, dia14)).toBe(463);
    expect(quantoDaParaTirar(ali, 2, dia14)).toBe(677);
    // Sem gasto ainda, o ritmo é o do plano.
    expect(reservaDoRitmo({ planejado: 1550, gasto: 0 }, dia14)).toBe(900);
    // No fim do mês, quase tudo fica livre; o desejo sempre dá a folga toda.
    expect(quantoDaParaTirar(ali, 2, { diasRestantes: 1, diasNoMes: 31 })).toBe(1128);
    expect(quantoDaParaTirar({ key: "LAZER", label: "Lazer", planejado: 600, gasto: 100 }, 1, dia14)).toBe(500);
  });

  it("o desejo inteiro antes do dia a dia, mesmo juntando três", () => {
    const tres: CategoriaParaRemanejo[] = [
      passou,
      { key: "OUTROS", label: "Outros", planejado: 200, gasto: 100 },
      { key: "c1", label: "Cuidado pessoal", planejado: 150, gasto: 50 },
      { key: "c2", label: "Viagem", planejado: 300, gasto: 200 },
      { key: "ALIMENTACAO", label: "Alimentação", planejado: 3000, gasto: 100 },
    ];
    const p = planoDeCobrir(passou, tres, dia14);
    expect(p).toMatchObject({ nivel: 1, principal: "tirar" });
    expect(p.origens.map((o) => o.label).sort()).toEqual(["Cuidado pessoal", "Outros", "Viagem"]);
  });
});
