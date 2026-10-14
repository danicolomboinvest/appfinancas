import { describe, expect, it } from "vitest";
import { contasNoMes, fraseDoQueAcaba, montarMesPrevisto, rendaMedia, type ContaPrevista } from "../proximos-meses";

const conta = (c: Partial<ContaPrevista> & { nome: string; valor: number; vencimento: string }): ContaPrevista => ({
  repete: true,
  intervalo: null,
  unidade: null,
  mesesEscolhidos: [],
  parcelas: null,
  assinatura: false,
  ...c,
});
const real = (v: number) => `R$ ${v}`;

describe("Próximos meses: o que já está comprometido", () => {
  const contas = [
    conta({ nome: "Aluguel", valor: 2200, vencimento: "2026-11-01" }),
    conta({ nome: "Diarista", valor: 180, vencimento: "2026-10-15", intervalo: 2, unidade: "semanas" }),
    conta({ nome: "IPVA", valor: 2400, vencimento: "2027-03-10", intervalo: 1, unidade: "anos" }),
    conta({ nome: "Netflix", valor: 44.9, vencimento: "2026-10-20", assinatura: true }),
    conta({ nome: "Sofá", valor: 300, vencimento: "2026-11-05", parcelas: 10 }),
  ];

  it("cada conta pela regra dela: a diarista quinzenal cai 2 vezes em novembro, o IPVA só em março", () => {
    const nov = contasNoMes(contas, { ano: 2026, mes: 11 });
    expect(nov.contas).toEqual([
      { nome: "Aluguel", valor: 2200 },
      { nome: "Diarista", valor: 360 },
    ]);
    expect(nov.assinaturas).toEqual([{ nome: "Netflix", valor: 44.9 }]);
    expect(contasNoMes(contas, { ano: 2027, mes: 3 }).contas.map((c) => c.nome)).toContain("IPVA");
  });

  it("a conta parcelada fica com as parcelas (não conta duas vezes)", () => {
    expect(contasNoMes(contas, { ano: 2026, mes: 11 }).contas.map((c) => c.nome)).not.toContain("Sofá");
  });

  it("comprometido contra a renda média", () => {
    const m = montarMesPrevisto({ ano: 2026, mes: 12 }, { parcelas: [{ nome: "Amazon", valor: 89 }], contas: [{ nome: "Aluguel", valor: 2200 }], assinaturas: [{ nome: "Netflix", valor: 44.9 }], acabaram: [], rendaMedia: 7700 });
    expect(m.total).toBe(2333.9);
    expect(m.pct).toBe(30);
    expect(montarMesPrevisto({ ano: 2026, mes: 12 }, { parcelas: [], contas: [], assinaturas: [], acabaram: [], rendaMedia: null }).pct).toBeNull();
  });

  it("renda média dos meses fechados com entrada, até 3", () => {
    expect(rendaMedia([0, 6000, 7000, 8000])).toBe(7000);
    expect(rendaMedia([0, 0])).toBeNull();
  });

  it("a parcela que acaba vira frase de sobra", () => {
    expect(fraseDoQueAcaba("dezembro", [{ nome: "Amazon", valor: 89 }], real)).toBe("Em dezembro sai a parcela de Amazon: sobram R$ 89 a mais.");
    expect(fraseDoQueAcaba("dezembro", [], real)).toBeNull();
  });
});
