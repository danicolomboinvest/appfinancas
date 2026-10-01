import { describe, expect, it } from "vitest";
import { saidasDaCompra, type CompraBase } from "../posso-comprar";

/**
 * "Como fazer caber" (01/10/2026): quando a compra não cabe, o app usa o orçamento dela para dizer
 * de onde apertar (nunca do básico) e quanto guardar por mês, com um sonho pronto.
 */
const base = (categorias: CompraBase["categorias"]): CompraBase => ({
  renda: 6300, gastoPlanejado: 5000, sobraDoMes: 800, diasRestantes: 20, metas: [], taxaReferencia: 0.008, categorias,
});
const cats = [
  { chave: "MORADIA", nome: "Moradia", planejado: 2450, gasto: 2450 },
  { chave: "SAUDE", nome: "Saúde", planejado: 600, gasto: 400 },
  { chave: "LAZER", nome: "Lazer", planejado: 300, gasto: 100 },
  { chave: "ALIMENTACAO", nome: "Alimentação", planejado: 1250, gasto: 600 },
  { chave: "OUTROS", nome: "Outros", planejado: 150, gasto: 0 },
];
const compra = { valor: 3000, modo: "vista" as const, parcelas: 1, juros: 0, desconto: 0 };

describe("saidasDaCompra", () => {
  it("corta só do que dá para apertar, nunca de moradia ou saúde, e no mês só do que ainda não foi gasto", () => {
    const s = saidasDaCompra(base(cats), compra, { valor: 250, porMes: false })!;
    expect(s.cortes.map((c) => c.nome)).not.toContain("Moradia");
    expect(s.cortes.map((c) => c.nome)).not.toContain("Saúde");
    // Lazer: 40% de 300 = 120 (e ainda tem 200 sem gastar); Alimentação: 15% de 1.250 = 187.
    expect(s.cobre).toBeGreaterThanOrEqual(250);
    for (const c of s.cortes) expect(c.valor).toBeGreaterThan(0);
  });

  it("quando os cortes não bastam, diz quanto cobrem", () => {
    const s = saidasDaCompra(base(cats), compra, { valor: 2000, porMes: false })!;
    expect(s.cobre).toBeLessThan(2000);
    expect(s.precisa).toBe(2000);
  });

  it("guardar antes: o valor à vista em um ritmo de até 10% da renda por mês", () => {
    const s = saidasDaCompra(base(cats), compra, { valor: 2000, porMes: false })!;
    expect(s.guardar.alvo).toBe(3000);
    expect(s.guardar.meses).toBe(5); // 3.000 / 630
    expect(s.guardar.mensal).toBe(600);
  });

  it("sem orçamento por categoria, ainda oferece guardar antes", () => {
    const s = saidasDaCompra(base(undefined), compra, { valor: 500, porMes: true })!;
    expect(s.cortes).toEqual([]);
    expect(s.guardar.meses).toBeGreaterThan(0);
  });

  it("nada a cobrir, nada a sugerir", () => {
    expect(saidasDaCompra(base(cats), compra, { valor: 0, porMes: false })).toBeNull();
  });
});
