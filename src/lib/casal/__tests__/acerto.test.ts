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

describe("calcularAcerto no Casal simples (15/10/2026): quem pagou e a divisão de cada gasto", () => {
  // A = Ana, B = Lucas. `pessoa` é quem pagou; `deQuem`, de quem é o gasto que não é da casa.
  const casa = (amount: number, pessoa: "A" | "B", extra: Partial<LancamentoDoAcerto> = {}): LancamentoDoAcerto => ({ category: "EXPENSE", amount, pessoa, doCasal: true, ...extra });
  const deUm = (amount: number, pessoa: "A" | "B", deQuem: "A" | "B"): LancamentoDoAcerto => ({ category: "EXPENSE", amount, pessoa, doCasal: false, deQuem });

  it("da casa que a Ana pagou, 60/40 próprio: o Lucas deve 40%", () => {
    const a = calcularAcerto([casa(200, "A", { fracaoA: 0.6 })], "meio");
    expect(a.saldoA).toBe(80);
    expect(a.totalDaCasa).toBe(200);
  });

  it("da casa que o Lucas pagou, 60/40 próprio: a Ana deve 60%", () => {
    const a = calcularAcerto([casa(200, "B", { fracaoA: 0.6 })], "meio");
    expect(a.saldoA).toBe(-120);
    expect(a.pagou).toEqual({ A: 0, B: 200 });
    expect(a.parte).toEqual({ A: 120, B: 80 });
  });

  it("a divisão própria manda sobre o jeito geral e sobre a conta (até o um paga tudo)", () => {
    expect(calcularAcerto([casa(100, "A", { fracaoA: 0.5, modo: "um_paga" })], "renda").saldoA).toBe(50);
    expect(calcularAcerto([casa(100, "A", { modo: "meio" })], "combinado", { pctA: 70 }).saldoA).toBe(50);
    expect(calcularAcerto([casa(100, "A")], "combinado", { pctA: 70 }).saldoA).toBe(30);
  });

  it("do Lucas pago pela Ana: o Lucas deve 100%", () => {
    const a = calcularAcerto([deUm(90, "A", "B")], "renda");
    expect(a.saldoA).toBe(90);
    expect(a.totalDaCasa).toBe(0);
    expect(a.entreVoces).toBe(90);
  });

  it("da Ana (Meu) pago pelo Lucas: a Ana deve 100%", () => {
    const a = calcularAcerto([deUm(150, "B", "A")], "renda");
    expect(a.saldoA).toBe(-150);
    expect(a.parte).toEqual({ A: 150, B: 0 });
  });

  it("meu pago por mim e do par pago pelo par: fora do acerto", () => {
    const a = calcularAcerto([deUm(150, "A", "A"), deUm(80, "B", "B")], "renda");
    expect(a.saldoA).toBe(0);
    expect(a.pagou).toEqual({ A: 0, B: 0 });
    expect(a.entreVoces).toBe(0);
  });

  it("tudo junto soma: casa pela renda, casa própria e os de um só", () => {
    const a = calcularAcerto(
      [renda(5500, "A"), renda(4500, "B"), casa(1000, "A"), casa(200, "B", { fracaoA: 0.6 }), deUm(90, "A", "B"), deUm(150, "B", "A")],
      "renda",
    );
    // Casa: Ana pagou 1000 (parte dela 550), Lucas pagou 200 (parte dela 120): +450 −120.
    // De um só: Lucas deve 90; Ana deve 150. Total: 450 − 120 + 90 − 150 = 270.
    expect(a.saldoA).toBe(270);
    expect(a.totalDaCasa).toBe(1200);
    expect(a.entreVoces).toBe(240);
  });
});
