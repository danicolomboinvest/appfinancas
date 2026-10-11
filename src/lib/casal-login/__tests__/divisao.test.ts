import { describe, expect, it } from "vitest";
import { calcularAcerto, chaveDaConta, lerConfigCasal, type LancamentoDoAcerto, type ModoDaConta } from "@/lib/casal/acerto";
import { direcao, quemPagouTudo, saldoDasContas, type ContaParaAcerto } from "../conta-por-conta";

/** Outubro da Ana canônica: casa R$ 4.350, Ana pagou 2.850, Lucas 1.500; rendas 7.700 e 6.300. */
const L = (desc: string, amount: number, pessoa: "A" | "B", category = "EXPENSE", doCasal: boolean | null = true): LancamentoDoAcerto & { desc: string } => ({ desc, category, amount, pessoa, doCasal });
const OUTUBRO = [
  L("Salário", 7700, "A", "INCOME", null),
  L("Salário", 6300, "B", "INCOME", null),
  L("Aluguel", 2400, "A"),
  L("Mercado", 450, "A"),
  L("Condomínio", 500, "B"),
  L("Mercado", 370, "B"),
  L("Luz Enel", 180, "B"),
  L("Internet Vivo", 150, "B"),
  L("Jantar fora", 210, "B"),
  L("Ração da Mel", 90, "B"),
  L("Smart Fit", 120, "A", "EXPENSE", false),
];

function comRegras(regras: Record<string, ModoDaConta>) {
  return OUTUBRO.map((l) => ({ ...l, modo: regras[chaveDaConta(l.desc, null)] }));
}

function contas(): ContaParaAcerto[] {
  const m = new Map<string, ContaParaAcerto>();
  for (const l of OUTUBRO) {
    if (l.category !== "EXPENSE" || l.doCasal === false) continue;
    const k = chaveDaConta(l.desc, null);
    const c = m.get(k) ?? { chave: k, valor: 0, pagou: { A: 0, B: 0 } };
    c.valor += l.amount;
    c.pagou[l.pessoa as "A" | "B"] += l.amount;
    m.set(k, c);
  }
  return [...m.values()];
}

const RENDA = 7700 / 14000;

describe("os números da canônica", () => {
  it("pela renda, Lucas manda R$ 458", () => {
    const a = calcularAcerto(OUTUBRO, "renda");
    expect(Math.round(a.saldoA)).toBe(458);
    expect(Math.round(a.fracaoA * 100)).toBe(55);
  });

  it("meio a meio, Lucas manda R$ 675", () => {
    expect(Math.round(calcularAcerto(OUTUBRO, "meio").saldoA)).toBe(675);
  });

  it("internet meio a meio e o resto pela renda: R$ 465", () => {
    expect(Math.round(calcularAcerto(comRegras({ "internet vivo": "meio" }), "renda").saldoA)).toBe(465);
  });

  it("combinado 60 e 40: a conta usa a parte combinada", () => {
    const a = calcularAcerto(OUTUBRO, "combinado", { pctA: 60 });
    expect(a.fracaoA).toBeCloseTo(0.6);
    expect(a.parte.A).toBe(2610);
    expect(a.saldoA).toBe(240);
  });

  it("um paga tudo: a conta sai do acerto (e da casa)", () => {
    const a = calcularAcerto(comRegras({ "luz enel": "um_paga" }), "renda");
    expect(a.totalDaCasa).toBe(4170);
    expect(a.pagou.B).toBe(1320);
    expect(Math.round(a.saldoA)).toBe(Math.round(2850 - 4170 * RENDA));
  });

  it("o gasto pessoal continua fora, com ou sem regra", () => {
    expect(calcularAcerto(comRegras({ "smart fit": "meio" }), "renda").totalDaCasa).toBe(4350);
  });
});

describe("conta por conta na tela dá o mesmo que o acerto", () => {
  const casos: Record<string, ModoDaConta>[] = [{}, { "internet vivo": "meio" }, { "luz enel": "um_paga" }, { aluguel: "meio", mercado: "um_paga" }];
  for (const regras of casos) {
    it(JSON.stringify(regras), () => {
      const tela = saldoDasContas(contas(), regras, { renda: RENDA, geral: RENDA });
      expect(tela.saldoA).toBeCloseTo(calcularAcerto(comRegras(regras), "renda").saldoA, 2);
    });
  }

  it("as duas compras do mercado são a mesma conta, paga pelos dois", () => {
    const mercado = contas().find((c) => c.chave === "mercado")!;
    expect(mercado).toEqual({ chave: "mercado", valor: 820, pagou: { A: 450, B: 370 } });
    expect(quemPagouTudo(mercado)).toBeNull();
    expect(quemPagouTudo(contas().find((c) => c.chave === "aluguel")!)).toBe("A");
  });

  it("a direção do acerto: quem manda, pra quem, quanto", () => {
    expect(direcao(457.5)).toEqual({ de: "B", para: "A", valor: 458 });
    expect(direcao(-120.4)).toEqual({ de: "A", para: "B", valor: 120 });
    expect(direcao(0.3)).toBeNull();
  });
});

describe("a chave da conta e a config", () => {
  it("sem acento, minúsculo e sem espaço sobrando; sem nome, a categoria", () => {
    expect(chaveDaConta("  Condomínio  do Prédio ", "MORADIA")).toBe("condominio do predio");
    expect(chaveDaConta("", "MORADIA")).toBe("categoria:moradia");
  });

  it("a config guarda o combinado e as regras, e ignora lixo", () => {
    const c = lerConfigCasal({ nomeA: "Ana", nomeB: "Lucas", divisao: "combinado", pctA: 60, regras: { "internet vivo": "meio", x: "qualquer" } });
    expect(c.divisao).toBe("combinado");
    expect(c.pctA).toBe(60);
    expect(c.regras).toEqual({ "internet vivo": "meio" });
    expect(lerConfigCasal({ divisao: "combinado", pctA: 95 }).pctA).toBeUndefined();
  });
});
