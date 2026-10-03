import { describe, expect, it } from "vitest";
import { calcularAcerto, chaveDoMes, lerConfigCasal, type LancamentoDoAcerto } from "../acerto";

const gasto = (amount: number, pessoa: string | null, doCasal: boolean | null = null): LancamentoDoAcerto => ({ category: "EXPENSE", amount, pessoa, doCasal });
const renda = (amount: number, pessoa: string): LancamentoDoAcerto => ({ category: "INCOME", amount, pessoa, doCasal: null });

// O exemplo do protótipo: Dani (A) R$ 7.500, Pedro (B) R$ 5.000; gastos da casa R$ 3.985.
const outubro = [
  renda(7500, "A"),
  renda(5000, "B"),
  gasto(2400, "A"),
  gasto(820, "B"),
  gasto(210, "B"),
  gasto(120, "A"),
  gasto(340, "B"),
  gasto(95, "A"),
  gasto(390, "A", false),
  gasto(150, "B", false),
];

describe("calcularAcerto", () => {
  it("pela renda: 60/40 e o Pedro deve R$ 224 pra Dani", () => {
    const a = calcularAcerto(outubro, "renda");
    expect(a.totalDaCasa).toBe(3985);
    expect(a.fracaoA).toBeCloseTo(0.6);
    expect(a.pagou).toEqual({ A: 2615, B: 1370 });
    expect(a.parte).toEqual({ A: 2391, B: 1594 });
    expect(a.saldoA).toBe(224);
  });

  it("meio a meio muda a conta", () => {
    const a = calcularAcerto(outubro, "meio");
    expect(a.parte.A).toBe(1992.5);
    expect(a.saldoA).toBe(622.5);
  });

  it("gasto pessoal fica fora do acerto", () => {
    const comPessoal = calcularAcerto([...outubro, gasto(1000, "A", false)], "renda");
    expect(comPessoal.totalDaCasa).toBe(3985);
  });

  it("gasto da casa sem dono não entra, mas é contado pra avisar", () => {
    const a = calcularAcerto([...outubro, gasto(80, null)], "renda");
    expect(a.totalDaCasa).toBe(3985);
    expect(a.semDono).toEqual({ quantidade: 1, valor: 80 });
  });

  it("pela renda sem a renda dos dois: cai pra meio a meio e avisa", () => {
    const a = calcularAcerto([renda(7500, "A"), gasto(100, "A")], "renda");
    expect(a.fracaoA).toBe(0.5);
    expect(a.caiuParaMeio).toBe(true);
  });

  it("aporte não entra no acerto", () => {
    const a = calcularAcerto([{ category: "INVESTMENT_CONTRIBUTION", amount: 500, pessoa: "A", doCasal: null }], "meio");
    expect(a.totalDaCasa).toBe(0);
  });
});

describe("lerConfigCasal", () => {
  it("JSON vazio ou estranho vira o padrão", () => {
    expect(lerConfigCasal(null)).toEqual({ nomeA: "Pessoa 1", nomeB: "Pessoa 2", divisao: "renda", acertos: [] });
    expect(lerConfigCasal({ nomeA: "  Dani ", divisao: "meio", acertos: ["2026-10", "x", 3] })).toEqual({
      nomeA: "Dani",
      nomeB: "Pessoa 2",
      divisao: "meio",
      acertos: ["2026-10"],
    });
  });
  it("chaveDoMes", () => {
    expect(chaveDoMes(2026, 3)).toBe("2026-03");
  });
});
