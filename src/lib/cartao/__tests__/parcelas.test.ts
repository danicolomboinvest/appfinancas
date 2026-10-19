import { describe, expect, it } from "vitest";
import { faturaDoLancamento } from "../fatura";
import { descricaoDaParcela, dividirEmParcelas, parcelasNasFaturas, parcelasValidas, resumoDasParcelas, parcelasDaquiPraFrente } from "../parcelas";
import { parseInstallment } from "@/lib/entries/recurrence";

describe("parcelas: a divisão do total", () => {
  it("a 1ª leva os centavos que sobram e a soma bate exata", () => {
    expect(dividirEmParcelas(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(dividirEmParcelas(100000, 12)).toEqual([8337, ...Array(11).fill(8333)]);
    expect(dividirEmParcelas(120000, 12)).toEqual(Array(12).fill(10000));
    for (const [total, n] of [[1, 2], [99999, 7], [123457, 24], [5, 10]]) {
      const p = dividirEmParcelas(total, n);
      expect(p).toHaveLength(n);
      expect(p.reduce((a, b) => a + b, 0)).toBe(total);
      expect(Math.max(...p.slice(1)) - Math.min(...p)).toBeLessThanOrEqual(0);
    }
  });
  it("vezes fora de 1 a 24 viram à vista", () => {
    expect(parcelasValidas("12")).toBe(12);
    expect(parcelasValidas(0)).toBe(1);
    expect(parcelasValidas(25)).toBe(1);
    expect(parcelasValidas("2.5")).toBe(1);
    expect(parcelasValidas(null)).toBe(1);
    expect(dividirEmParcelas(5000, 30)).toEqual([5000]);
  });
  it("a linha do Digitar", () => {
    expect(resumoDasParcelas(100000, 3)).toEqual({ vezes: 3, parcela: 33333, primeira: 33334 });
    expect(resumoDasParcelas(120000, 12)).toEqual({ vezes: 12, parcela: 10000, primeira: null });
  });
  it("a descrição com (k/N), que o app já lê como parcela certa", () => {
    expect(descricaoDaParcela("Celular", 1, 12)).toBe("Celular (1/12)");
    expect(descricaoDaParcela("  Sofá (3/10) ", 2, 6)).toBe("Sofá (2/6)");
    expect(parseInstallment(descricaoDaParcela("Celular", 2, 6))).toEqual({ current: 2, total: 6, confident: true });
    // A data na descrição dela não vira "parcela 3 de 9".
    expect(descricaoDaParcela("Loja 03/09", 1, 3)).toBe("Loja 03/09 (parcela 1/3)");
    expect(parseInstallment(descricaoDaParcela("Loja 03/09", 1, 3))).toEqual({ current: 1, total: 3, confident: true });
    expect(descricaoDaParcela("Loja 03/09 (parcela 1/3)", 2, 3)).toBe("Loja 03/09 (parcela 2/3)");
  });
});

describe("parcelas: o mês de cada uma", () => {
  const nubank = { diaFechamento: 15, diaVencimento: 22 };
  it("a 1ª na fatura da compra e cada seguinte na fatura seguinte, passando de ano", () => {
    const p = parcelasNasFaturas("2026-10-14", 4, nubank);
    expect(p.map((x) => `${x.year}-${x.month}`)).toEqual(["2026-10", "2026-11", "2026-12", "2027-1"]);
    expect(p.map((x) => x.data)).toEqual(["2026-10-14", "2026-11-14", "2026-12-14", "2027-01-14"]);
    expect(p.map((x) => x.numero)).toEqual([1, 2, 3, 4]);
  });
  it("no dia do fechamento a 1ª já pula para a fatura seguinte", () => {
    const p = parcelasNasFaturas("2026-10-15", 2, nubank);
    expect(p.map((x) => `${x.year}-${x.month}`)).toEqual(["2026-11", "2026-12"]);
  });
  it("a tela do cartão soma cada parcela na fatura dela (mesma regra do faturaDoLancamento)", () => {
    for (const cartao of [nubank, { diaFechamento: 31, diaVencimento: 8 }, { diaFechamento: 30, diaVencimento: 5 }, { diaFechamento: 3, diaVencimento: 10 }]) {
      for (const compra of ["2026-01-30", "2026-01-31", "2026-08-31", "2026-12-29", "2026-02-28"]) {
        const p = parcelasNasFaturas(compra, 13, cartao);
        const chaves = p.map((x) => faturaDoLancamento({ year: x.year, month: x.month, entryDate: x.data }, cartao).chave);
        expect(chaves).toEqual(p.map((x) => `${x.year}-${String(x.month).padStart(2, "0")}`));
        expect(new Set(chaves).size).toBe(13);
      }
    }
  });
  it("dia 31 vira o último dia do mês curto", () => {
    const p = parcelasNasFaturas("2026-01-31", 3, { diaFechamento: 5, diaVencimento: 12 });
    expect(p.map((x) => x.data)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
  it("cartão sem os dias: uma por mês a partir do mês da compra", () => {
    const p = parcelasNasFaturas("2026-11-20", 3, { diaFechamento: null, diaVencimento: null });
    expect(p.map((x) => `${x.year}-${x.month} ${x.data}`)).toEqual(["2026-11 2026-11-20", "2026-12 2026-12-20", "2027-1 2027-01-20"]);
  });
  it("data inválida: nada", () => {
    expect(parcelasNasFaturas("ontem", 3, nubank)).toEqual([]);
  });
});

describe("parcelasDaquiPraFrente (apagar esta e as próximas)", () => {
  const p = (id: string, year: number, month: number, parcelamentoId: string | null = "compra-a") => ({ id, year, month, parcelamentoId });
  const compra = [p("1", 2026, 10), p("2", 2026, 11), p("3", 2026, 12), p("4", 2027, 1)];
  const outra = [p("x1", 2026, 11, "compra-b"), p("x2", 2026, 12, "compra-b")];
  const solto = p("s", 2026, 12, null);

  it("a 2ª de 4: ela e as seguintes, em ordem, inclusive a do ano seguinte", () => {
    expect(parcelasDaquiPraFrente(compra[1], [...outra, ...compra.slice().reverse(), solto]).map((l) => l.id)).toEqual(["2", "3", "4"]);
  });

  it("a 1ª leva a compra inteira; a última, só ela", () => {
    expect(parcelasDaquiPraFrente(compra[0], compra).map((l) => l.id)).toEqual(["1", "2", "3", "4"]);
    expect(parcelasDaquiPraFrente(compra[3], compra).map((l) => l.id)).toEqual(["4"]);
  });

  it("nunca leva parcela de outra compra nem lançamento solto", () => {
    const r = parcelasDaquiPraFrente(compra[1], [...compra, ...outra, solto]);
    expect(r.every((l) => l.parcelamentoId === "compra-a")).toBe(true);
  });

  it("sem parcelamentoId: só ele mesmo", () => {
    expect(parcelasDaquiPraFrente(solto, [...compra, solto]).map((l) => l.id)).toEqual(["s"]);
  });
});
