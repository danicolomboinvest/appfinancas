import { describe, expect, it } from "vitest";
import { compararAteOMesmoDia } from "../regras";
import { detalharONumero, type LancamentoDoNumero } from "../detalhe-do-numero";

const g = (id: string, valor: number, dia: number | null, categoria: string, descricao = id): LancamentoDoNumero => ({ id, valor, dia, categoria, descricao });

const outubro: LancamentoDoNumero[] = [
  g("aluguel", 1200, null, "MORADIA"),
  g("ifood1", 45.9, 3, "ALIMENTACAO", "IFOOD"),
  g("mercado", 312.47, 9, "ALIMENTACAO", "Pão de Açúcar"),
  g("uber", 23.4, 14, "TRANSPORTE", "UBER"),
  g("farmacia", 153.33, 12, "SAUDE", "Drogasil"),
  g("conta-luz", 180, 20, "MORADIA", "Enel"),
  g("compra-nov", 99, 99, "LAZER", "Fatura de novembro"),
];
const setembro: LancamentoDoNumero[] = [g("aluguel-set", 1200, null, "MORADIA"), g("mercado-set", 420.1, 10, "ALIMENTACAO"), g("cinema", 60, 16, "LAZER")];
const aplicacoes: LancamentoDoNumero[] = [g("cdb", 500, 5, "OUTROS", "Aplicação CDB"), g("cdb-depois", 300, 25, "OUTROS")];

describe("O que entrou no número do Resumo", () => {
  const comp = compararAteOMesmoDia(outubro, setembro, 14, { ano: 2026, mes: 9 });
  const atual = detalharONumero(outubro, comp.corte, aplicacoes);
  const passado = detalharONumero(setembro, comp.cortePassado);

  it("a soma da folha bate com o número do cartão, nos dois meses", () => {
    expect(atual.total).toBe(comp.atual);
    expect(passado.total).toBe(comp.passado);
    const somaDasCategorias = (d: typeof atual) => Math.round(d.categorias.reduce((s, c) => s + c.total, 0) * 100) / 100;
    const somaDosLancamentos = (d: typeof atual) => Math.round(d.categorias.flatMap((c) => c.itens).reduce((s, i) => s + i.valor, 0) * 100) / 100;
    expect(somaDasCategorias(atual)).toBe(comp.atual);
    expect(somaDosLancamentos(atual)).toBe(comp.atual);
    expect(somaDasCategorias(passado)).toBe(comp.passado);
    expect(atual.n).toBe(5);
  });

  it("o que fica de fora não aparece nas categorias: gasto depois do corte e aplicação", () => {
    const dentro = new Set(atual.categorias.flatMap((c) => c.itens.map((i) => i.id)));
    for (const id of ["conta-luz", "compra-nov", "cdb", "cdb-depois"]) expect(dentro.has(id)).toBe(false);
    expect(atual.fora.map((f) => [f.id, f.motivo])).toEqual([
      ["compra-nov", "depois"],
      ["conta-luz", "depois"],
      ["cdb", "aplicacao"],
    ]);
    // A aplicação depois do corte nem entra no "Fora da conta": é do resto do mês.
    expect(atual.fora.some((f) => f.id === "cdb-depois")).toBe(false);
  });

  it("gasto sem dia conta desde o dia 1, como no número", () => {
    expect(atual.categorias.find((c) => c.categoria === "MORADIA")?.itens.map((i) => i.id)).toEqual(["aluguel"]);
  });

  it("categorias da maior para a menor; lançamentos do dia mais recente primeiro", () => {
    expect(atual.categorias.map((c) => c.categoria)).toEqual(["MORADIA", "ALIMENTACAO", "SAUDE", "TRANSPORTE"]);
    expect(atual.categorias[1].itens.map((i) => i.id)).toEqual(["mercado", "ifood1"]);
  });

  it("setembro até o mesmo dia: o cinema do dia 16 fica de fora", () => {
    expect(passado.categorias.flatMap((c) => c.itens.map((i) => i.id))).not.toContain("cinema");
    expect(passado.fora.map((f) => f.id)).toEqual(["cinema"]);
  });
});
