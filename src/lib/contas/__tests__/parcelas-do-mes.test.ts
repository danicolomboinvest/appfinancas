import { describe, expect, it } from "vitest";
import { ehParcela, nomeSemParcela, parcelasDoMes, type LancamentoParcelavel } from "../parcelas-do-mes";

let n = 0;
const l = (year: number, month: number, descricao: string, valor: number, dia: string | null = null, categoria: string | null = "OUTROS"): LancamentoParcelavel => ({
  id: `l${(n += 1)}`,
  year,
  month,
  descricao,
  valor,
  dia,
  categoria,
});

/** As faturas do BTG da Dani, como estão no app em 13/10/2026 (todas "Sem data", menos a 1ª parcela). */
const DA_DANI: LancamentoParcelavel[] = [
  l(2026, 6, "Amazon Marketplace Cc (5/10)", 89.09),
  l(2026, 7, "Amazon Marketplace Cc (6/10)", 89.09),
  l(2026, 8, "Amazon Marketplace Cc (7/10)", 89.09),
  l(2026, 9, "Amazon Marketplace Cc (8/10)", 89.09),
  l(2026, 10, "Amazon Marketplace Cc (9/10)", 89.09),
  l(2026, 7, "Mercado Pago (3/6)", 57.5),
  l(2026, 8, "Mercado Pago (4/6)", 57.5),
  l(2026, 9, "Mercado Pago (5/6)", 57.5),
  l(2026, 10, "Mercado Pago (6/6)", 57.5),
  l(2026, 7, "Airbnb (1/6)", 1643.85, "2026-07-21", "LAZER"),
  l(2026, 8, "Airbnb (2/6)", 1643.83, null, "LAZER"),
  l(2026, 9, "Airbnb (3/6)", 1643.83, null, "LAZER"),
  l(2026, 6, "Iberia Líneas Aéreas (2/10)", 488.36, null, "LAZER"),
  l(2026, 9, "Iberia Líneas Aéreas (5/10)", 488.36, null, "LAZER"),
  l(2026, 9, "Jim.com* Kio Odontolo (1/8)", 1031.25, "2026-09-14"),
  l(2026, 6, "Cia Marítima (1/3)", 454.4, "2026-06-26"),
  l(2026, 8, "Cia Marítima (3/3)", 454.4),
  l(2026, 8, "Cativa Tecnologi (12/12)", 1299, "2026-08-18"),
];

describe("parcelas do mês", () => {
  it("outubro da Dani: as duas lançadas e as três que continuam sem lançamento", () => {
    const r = parcelasDoMes(DA_DANI, { year: 2026, month: 10 });
    const porNome = Object.fromEntries(r.itens.map((i) => [i.nome, i]));
    expect(Object.keys(porNome).sort()).toEqual(["Airbnb", "Amazon Marketplace Cc", "Iberia Líneas Aéreas", "Jim.com* Kio Odontolo", "Mercado Pago"]);
    expect(porNome["Amazon Marketplace Cc"]).toMatchObject({ atual: 9, total: 10, faltam: 2, acabaEm: { year: 2026, month: 11 }, origem: "lancada" });
    expect(porNome["Mercado Pago"]).toMatchObject({ atual: 6, total: 6, faltam: 1, acabaEm: { year: 2026, month: 10 }, origem: "lancada" });
    expect(porNome["Airbnb"]).toMatchObject({ atual: 4, total: 6, valor: 1643.83, faltam: 3, origem: "prevista", categoria: "LAZER" });
    expect(porNome["Iberia Líneas Aéreas"]).toMatchObject({ atual: 6, total: 10, faltam: 5, acabaEm: { year: 2027, month: 2 }, origem: "prevista" });
    expect(porNome["Jim.com* Kio Odontolo"]).toMatchObject({ atual: 2, total: 8, dia: 14, origem: "prevista" });
    expect(r.lancadas).toBe(146.59);
    expect(r.total).toBe(3310.03);
  });

  it("a que terminou não aparece (Cia Marítima 3/3 em agosto, Cativa 12/12)", () => {
    const r = parcelasDoMes(DA_DANI, { year: 2026, month: 9 });
    expect(r.itens.map((i) => i.nome)).not.toContain("Cia Marítima");
    expect(r.itens.map((i) => i.nome)).not.toContain("Cativa Tecnologi");
  });

  it("não conta duas vezes: a parcela já lançada no mês não vira prevista também", () => {
    const r = parcelasDoMes(DA_DANI, { year: 2026, month: 9 });
    expect(r.itens.filter((i) => i.nome === "Airbnb")).toHaveLength(1);
    expect(r.itens.find((i) => i.nome === "Airbnb")).toMatchObject({ atual: 3, origem: "lancada" });
  });

  it("dezembro: a Amazon já acabou em novembro, o Airbnb está na última", () => {
    const r = parcelasDoMes(DA_DANI, { year: 2026, month: 12 });
    expect(r.itens.map((i) => i.nome)).not.toContain("Amazon Marketplace Cc");
    expect(r.itens.find((i) => i.nome === "Airbnb")).toMatchObject({ atual: 6, faltam: 1 });
  });

  it("duas compras iguais na mesma loja, em meses diferentes, são duas parcelas", () => {
    const r = parcelasDoMes([l(2026, 9, "LOJA X PARC 02/10", 100), l(2026, 9, "LOJA X PARC 05/10", 100)], { year: 2026, month: 10 });
    expect(r.itens.map((i) => i.atual).sort()).toEqual([3, 6]);
  });

  it("'POSTO SHELL 03/09' com dia é a data da compra, não parcela; sem dia (fatura), é", () => {
    expect(ehParcela("POSTO SHELL 03/09", true)).toBeNull();
    expect(ehParcela("LOJA 03/10", false)).toEqual({ atual: 3, total: 10 });
    // E a ambígua nunca inventa o mês seguinte.
    expect(parcelasDoMes([l(2026, 9, "LOJA 03/10", 50)], { year: 2026, month: 10 }).itens).toEqual([]);
  });

  it("a conta parcelada cadastrada entra, menos quando é a mesma compra da fatura", () => {
    const contas = [
      { id: "c1", nome: "Geladeira", valor: 300, parcelas: 10, parcelaAtual: 4, categoria: "MORADIA", diaDoMes: 10 },
      { id: "c2", nome: "Airbnb", valor: 1643.83, parcelas: 6, parcelaAtual: 4, categoria: "LAZER", diaDoMes: 21 },
    ];
    const r = parcelasDoMes(DA_DANI, { year: 2026, month: 10 }, contas);
    expect(r.itens.filter((i) => i.origem === "conta").map((i) => i.nome)).toEqual(["Geladeira"]);
    expect(r.itens.find((i) => i.nome === "Geladeira")).toMatchObject({ atual: 4, total: 10, faltam: 7, acabaEm: { year: 2027, month: 4 } });
  });

  it("o nome sem a parcela", () => {
    expect(nomeSemParcela("Amazon Marketplace Cc (9/10)")).toBe("Amazon Marketplace Cc");
    expect(nomeSemParcela("LOJA X PARC 03/10")).toBe("LOJA X");
    expect(nomeSemParcela("Notebook - Parcela 2 de 6")).toBe("Notebook");
  });
});

describe("o dia da parcela", () => {
  it("vem da parcela da mesma compra que tem dia (a 1ª, gravada como compra do mês)", () => {
    const r = parcelasDoMes(DA_DANI, { year: 2026, month: 10 });
    expect(r.itens.find((i) => i.nome === "Airbnb")?.dia).toBe(21);
    expect(r.itens.find((i) => i.nome === "Amazon Marketplace Cc")?.dia).toBeNull();
  });
});

describe("Conta parcelada nos Próximos meses: a parcela anda com o mês", () => {
  const sofa = { id: "s", nome: "Sofá", valor: 300, parcelas: 10, parcelaAtual: 9, categoria: "OUTROS", diaDoMes: 10, vencimento: "2026-10-10" };
  it("outubro é a 9 de 10, novembro a 10 (acaba lá), dezembro já não tem", () => {
    const out = parcelasDoMes([], { year: 2026, month: 10 }, [sofa]).itens;
    const nov = parcelasDoMes([], { year: 2026, month: 11 }, [sofa]).itens;
    const dez = parcelasDoMes([], { year: 2026, month: 12 }, [sofa]).itens;
    expect(out.map((p) => p.atual)).toEqual([9]);
    expect(nov.map((p) => [p.atual, p.acabaEm])).toEqual([[10, { year: 2026, month: 11 }]]);
    expect(dez).toEqual([]);
  });
  it("sem vencimento, como antes: a parcela de agora", () => {
    const semData = { ...sofa, vencimento: null };
    expect(parcelasDoMes([], { year: 2026, month: 12 }, [semData]).itens.map((p) => p.atual)).toEqual([9]);
  });
});
