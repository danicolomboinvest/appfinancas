import { describe, expect, it } from "vitest";
import { comparacaoComBolaDeNeve, ehImpossivel, simularQuitacao } from "../plano";
import { taxaDe } from "../tipos";
import { paraResolver, parcelasSobreARenda, saudaveis, saudeDe, taxaAnual, nomeDaDivida, type DividaDoSpi } from "../saude";

const SELIC = 14.25;
const base = { apelido: "", paraQue: null, planejada: false, parcelasAbertas: null, parcelasTotal: null, semParcela: false, diaVencimento: null, atrasada: false };

// As dívidas da Ana canônica (rodada 9b do protótipo).
const ANA: DividaDoSpi[] = [
  { ...base, id: "d1", tipo: "cartao_parcelado", credor: "Nubank", apelido: "Fatura parcelada", nome: "Fatura Nubank", paraQue: "Compras do dia a dia", saldo: 1800, porMes: 300, parcelasAbertas: 6, parcelasTotal: 10, taxaMensal: null, diaVencimento: 10 },
  { ...base, id: "d2", tipo: "emprestimo", credor: "Itaú", apelido: "Empréstimo", nome: "Empréstimo do banco", paraQue: "Emergência", saldo: 6000, porMes: 420, parcelasAbertas: 19, parcelasTotal: 24, taxaMensal: 2.9, diaVencimento: 5 },
  { ...base, id: "d3", tipo: "pessoa", credor: "Mãe", nome: "Mãe", paraQue: "Outro", planejada: true, saldo: 2000, porMes: 200, parcelasAbertas: 10, parcelasTotal: 15, taxaMensal: 0, diaVencimento: 15 },
  { ...base, id: "d4", tipo: "financiamento_imovel", credor: "Caixa", apelido: "Apê", nome: "Caixa · Apê", paraQue: "Casa", planejada: true, saldo: 180000, porMes: 1650, parcelasAbertas: 312, parcelasTotal: 360, taxaMensal: 0.8, diaVencimento: 20 },
];

describe("saudável, atenção ou cara", () => {
  it("a Ana: fatura estimada é cara, o empréstimo de emergência pede atenção, mãe e apê são saudáveis", () => {
    expect(ANA.map((d) => saudeDe(d, SELIC))).toEqual(["cara", "atencao", "saudavel", "saudavel"]);
  });

  it("atrasada é cara mesmo com juro baixo e planejada", () => {
    expect(saudeDe({ ...ANA[3], atrasada: true }, SELIC)).toBe("cara");
  });

  it("4% ao mês já é juro alto (cara); planejada com juro acima da Selic é atenção", () => {
    expect(saudeDe({ ...ANA[1], taxaMensal: 4 }, SELIC)).toBe("cara");
    expect(saudeDe({ ...ANA[1], planejada: true, taxaMensal: 1.5 }, SELIC)).toBe("atencao");
    expect(saudeDe({ ...ANA[1], planejada: false, taxaMensal: 0.5 }, SELIC)).toBe("atencao");
  });

  it("a taxa ao mês vira ao ano por juros compostos", () => {
    expect(taxaAnual(1)).toBeCloseTo(12.6825, 3);
    expect(taxaAnual(0.8)).toBeCloseTo(10.0339, 3);
    expect(taxaAnual(2.9)).toBeCloseTo(40.9, 1);
  });

  it("'Não sei' usa o meio da faixa do tipo, ou o teto da lei", () => {
    expect(taxaDe(ANA[0])).toEqual({ taxa: 7, estimada: true });
    expect(taxaDe({ ...ANA[0], tipo: "cheque_especial" })).toEqual({ taxa: 8, estimada: true });
  });
});

describe("o plano da Ana (motor do Rota)", () => {
  const res = paraResolver(ANA, SELIC);

  it("o herói conta só as que não são saudáveis", () => {
    expect(res.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(saudaveis(ANA, SELIC).map((d) => d.id)).toEqual(["d3", "d4"]);
  });

  it("com R$ 200 a mais: 11 meses e R$ 1.571 de juros", () => {
    const p = simularQuitacao(res, 200);
    if (ehImpossivel(p)) throw new Error("plano impossível");
    expect(p.meses).toBe(11);
    expect(Math.round(p.totalJuros)).toBe(1571);
    expect(p.quitacoes.map((q) => q.id)).toEqual(["d1", "d2"]);
  });

  it("R$ 200 a mais chega 4 meses antes, com R$ 667 de juros a menos", () => {
    const com = simularQuitacao(res, 200);
    const sem = simularQuitacao(res, 0);
    if (ehImpossivel(com) || ehImpossivel(sem)) throw new Error("plano impossível");
    expect(sem.meses - com.meses).toBe(4);
    expect(Math.round(sem.totalJuros - com.totalJuros)).toBe(667);
  });

  it("a mais cara primeiro nunca paga mais juros que a menor primeiro", () => {
    const c = comparacaoComBolaDeNeve(res, 200);
    expect(c).not.toBeNull();
    expect(c!.economia).toBeGreaterThanOrEqual(0);
  });

  it("o alerta de 30% conta todas as parcelas: R$ 2.570 de R$ 7.700 = 33%", () => {
    const r = parcelasSobreARenda(ANA, 7700)!;
    expect(r.porMes).toBe(2570);
    expect(Math.round(r.proporcao * 100)).toBe(33);
    expect(r.alerta).toBe(true);
    expect(parcelasSobreARenda(res, 7700)!.alerta).toBe(false);
    expect(parcelasSobreARenda(ANA, 0)).toBeNull();
  });
});

describe("o nome", () => {
  it("credor · apelido, ou o que houver", () => {
    expect(nomeDaDivida("Caixa", "Apê")).toBe("Caixa · Apê");
    expect(nomeDaDivida("Mãe", "")).toBe("Mãe");
    expect(nomeDaDivida("", "Fatura")).toBe("Fatura");
  });
});
