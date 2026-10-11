import { describe, expect, it } from "vitest";
import { semanaDasContas } from "../semana-das-contas";

const contas = [
  { id: "1", nome: "Vivo Fibra", valor: 99.9, vencimento: "2026-10-13" },
  { id: "2", nome: "Enel", valor: null, vencimento: "2026-10-14" },
  { id: "3", nome: "Curso de inglês", valor: 249, vencimento: "2026-10-20" },
];

describe("Saem nesta semana", () => {
  it("os 7 dias a partir de hoje, com as contas de cada dia", () => {
    const s = semanaDasContas(contas, "2026-10-11");
    expect(s.dias.map((d) => `${d.sigla} ${d.dia}`)).toEqual(["Dom 11", "Seg 12", "Ter 13", "Qua 14", "Qui 15", "Sex 16", "Sáb 17"]);
    expect(s.dias[2].contas.map((c) => c.nome)).toEqual(["Vivo Fibra"]);
    expect(s.dias[0].hoje).toBe(true);
    expect(s.total).toBeCloseTo(99.9);
    // A luz varia: o total vira aproximado.
    expect(s.aproximado).toBe(true);
    expect(s.intervalo).toBe("11 a 17 out");
  });

  it("as setas andam de 7 em 7 dias, até 4 semanas", () => {
    const s = semanaDasContas(contas, "2026-10-11", 1);
    expect(s.dias[0].iso).toBe("2026-10-18");
    expect(s.total).toBe(249);
    expect(s.aproximado).toBe(false);
    expect(semanaDasContas(contas, "2026-10-11", 9).dias[0].iso).toBe("2026-11-08");
    expect(semanaDasContas(contas, "2026-10-28", 0).intervalo).toBe("28 out a 3 nov");
  });
});
