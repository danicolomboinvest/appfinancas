import { describe, expect, it } from "vitest";
import {
  avaliarCompra,
  avisosDaBase,
  compraDecididaEmAberto,
  comprasAindaNaoLancadas,
  cortesPorMeta,
  mesesAteMeta,
  pct,
  toleranciaDoLancamento,
  valorDoLancamentoEsperado,
  valorPresente,
  type CompraBase,
  type CompraMeta,
} from "../posso-comprar";

/**
 * Bordas do "Posso comprar?" que os testes de cenário não cobrem: zero, negativo, divisão por
 * zero, arredondamento do percentual perto de 90% e a virada do ano no fuso de Brasília.
 */
const money = (v: number) => `R$ ${v.toFixed(2)}`;
const fmt = { money, mesDaqui: (m: number | null) => (m === null ? "nunca" : `+${m}`) };
const base: CompraBase = { renda: 5000, gastoPlanejado: 3000, sobraDoMes: 1000, diasRestantes: 10, metas: [], taxaReferencia: 0.009 };
const meta = (o: Partial<CompraMeta> = {}): CompraMeta => ({ id: "m", nome: "Viagem", atual: 0, alvo: 1000, aporte: 100, taxa: 0, prazoMeses: 10, ...o });

describe("pct: arredondamento longe do limite de 90%", () => {
  it("perto de 90% usa uma casa, arredondando pra longe do limite", () => {
    expect(pct(0.8996)).toBe("89,9%");
    expect(pct(0.9004)).toBe("90,1%");
    expect(pct(0.9)).toBe("90,0%");
  });

  it("longe de 90% é inteiro; zero, negativo e acima de 100% não quebram", () => {
    expect(pct(0)).toBe("0%");
    expect(pct(0.12345)).toBe("12%");
    expect(pct(-0.1)).toBe("-10%");
    expect(pct(1.5)).toBe("150%");
  });
});

describe("contas auxiliares", () => {
  it("mesesAteMeta: sem guardar e sem rendimento nunca chega (null); guardando negativo também não", () => {
    expect(mesesAteMeta({ atual: 0, alvo: 1000, taxa: 0 }, () => 0)).toBeNull();
    expect(mesesAteMeta({ atual: 0, alvo: 1000, taxa: 0 }, () => -100)).toBeNull();
    expect(mesesAteMeta({ atual: 0, alvo: 1000, taxa: 0 }, () => 100)).toBe(10);
    expect(mesesAteMeta({ atual: 0, alvo: 0, taxa: 0 }, () => 0)).toBe(0);
  });

  it("mesesAteMeta: meio centavo de arredondamento não empurra a meta um mês pra frente", () => {
    expect(mesesAteMeta({ atual: 0, alvo: 1000.004, taxa: 0 }, () => 100)).toBe(10);
  });

  it("valorPresente: taxa zero ou negativa é soma simples; zero parcelas vale zero", () => {
    expect(valorPresente(100, 12, 0)).toBe(1200);
    expect(valorPresente(100, 12, -0.01)).toBe(1200);
    expect(valorPresente(100, 0, 0.01)).toBe(0);
  });

  it("cortesPorMeta: parcela zero ou negativa não corta ninguém", () => {
    expect(cortesPorMeta([meta()], 0).size).toBe(0);
    expect(cortesPorMeta([meta()], -50).size).toBe(0);
  });

  it("cortesPorMeta: meta que não guarda nada (aporte 0) não entra no mapa nem absorve corte", () => {
    const cortes = cortesPorMeta([meta({ id: "parada", aporte: 0, prazoMeses: 0 }), meta({ id: "viva", aporte: 100 })], 60);
    expect(cortes.has("parada")).toBe(false);
    expect(cortes.get("viva")).toBe(60);
  });

  it("toleranciaDoLancamento: 1% do valor, mas nunca menos de R$ 1 (inclusive valor zero)", () => {
    expect(toleranciaDoLancamento(0)).toBe(1);
    expect(toleranciaDoLancamento(50)).toBe(1);
    expect(toleranciaDoLancamento(1000)).toBe(10);
  });

  it("valorDoLancamentoEsperado: parcelado em 1x é o valor cheio", () => {
    expect(valorDoLancamentoEsperado({ valor: 1200, modo: "parcelado", parcelas: 1, criadaEm: new Date() })).toBe(1200);
    expect(valorDoLancamentoEsperado({ valor: 1200, modo: "parcelado", parcelas: 12, criadaEm: new Date() })).toBe(100);
  });
});

describe("compras decididas na virada do ano (fuso de Brasília)", () => {
  // 31/12 às 23h30 em Brasília = 01/01 02h30 em UTC.
  const reveillon = new Date("2026-12-31T23:30:00-03:00");

  it("à vista decidida no réveillon às 23h30 é de dezembro: em janeiro já não pesa", () => {
    const vista = { valor: 100, modo: "vista" as const, parcelas: 1, criadaEm: reveillon };
    expect(compraDecididaEmAberto(vista, new Date("2026-12-31T23:59:00-03:00"))).toBe(true);
    expect(compraDecididaEmAberto(vista, new Date("2027-01-01T10:00:00-03:00"))).toBe(false);
  });

  it("12x decidida em dezembro pesa até novembro do ano seguinte, não em dezembro", () => {
    const parcelada = { valor: 1200, modo: "parcelado" as const, parcelas: 12, criadaEm: reveillon };
    expect(compraDecididaEmAberto(parcelada, new Date("2027-11-15T12:00:00-03:00"))).toBe(true);
    expect(compraDecididaEmAberto(parcelada, new Date("2027-12-15T12:00:00-03:00"))).toBe(false);
  });

  it("valor zero ou negativo não entra na soma do que falta lançar", () => {
    expect(
      comprasAindaNaoLancadas(
        [
          { valor: 0, modo: "vista", parcelas: 1, criadaEm: reveillon },
          { valor: -50, modo: "parcelado", parcelas: 3, criadaEm: reveillon },
        ],
        [],
      ),
    ).toEqual({ vista: 0, parcelaMensal: 0 });
  });
});

describe("avaliarCompra: entrada inválida", () => {
  it("valor zero, negativo, NaN ou infinito pede o valor, em vez de responder", () => {
    for (const valor of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(avaliarCompra(base, { valor, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt)).toEqual({ erro: "valor" });
    }
  });

  it("renda zero ou negativa pede a renda; orçamento zero pede o orçamento", () => {
    expect(avaliarCompra({ ...base, renda: 0 }, { valor: 10, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt)).toEqual({ erro: "renda" });
    expect(avaliarCompra({ ...base, renda: -1 }, { valor: 10, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt)).toEqual({ erro: "renda" });
    expect(avaliarCompra({ ...base, gastoPlanejado: 0 }, { valor: 10, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt)).toEqual({ erro: "orcamento" });
  });

  it("último dia do mês (0 dias restantes): o 'livre por semana' não divide por zero", () => {
    const r = avaliarCompra({ ...base, diasRestantes: 0 }, { valor: 100, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt);
    expect("linhas" in r).toBe(true);
    if (!("linhas" in r)) return;
    const textos = r.linhas.flatMap((l) => [l.hoje, l.depois]).join(" ");
    expect(textos).not.toMatch(/NaN|Infinity/);
  });

  it("parcelas, juros e desconto NaN viram à vista sem desconto, sem NaN na conta", () => {
    const r = avaliarCompra(base, { valor: 1000, modo: "parcelado", parcelas: Number.NaN, juros: Number.NaN, desconto: Number.NaN }, fmt);
    expect("conta" in r).toBe(true);
    if (!("conta" in r)) return;
    expect(r.conta.map((c) => c.valor).join(" ")).not.toMatch(/NaN|Infinity/);
    expect(r.comparacao).toBeNull();
  });

  it("parcelado com juros negativo é tratado como sem juros (não 'ganha' desconto)", () => {
    const r = avaliarCompra(base, { valor: 1200, modo: "parcelado", parcelas: 12, juros: -0.05, desconto: 0 }, fmt);
    if (!("conta" in r)) throw new Error("esperava resultado");
    expect(r.custoJuros).toBeNull();
    expect(r.conta[0]).toEqual({ rotulo: "Parcela", valor: money(100) });
  });
});

describe("avisosDaBase: bordas", () => {
  it("sem orçamento (0) não compara gasto real com orçamento nem divide por ele", () => {
    expect(avisosDaBase({ ...base, gastoPlanejado: 0, gastoReal: 9999, gastoDoMesAtual: 9999 }, money)).toEqual([]);
  });

  it("gasto real exatamente 20% acima do orçamento ainda não avisa (a régua é 'mais que 20%')", () => {
    expect(avisosDaBase({ ...base, gastoReal: 3600 }, money)).toEqual([]);
    expect(avisosDaBase({ ...base, gastoReal: 3601 }, money)).toHaveLength(1);
  });
});
