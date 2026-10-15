import { describe, expect, it } from "vitest";
import { cicloAberto, diaCurto, faturaDe, faturaDoLancamento, faturaQueVenceEm, faturaSeguinte, isoDoDia, melhorDiaParaComprar, nomeDaFatura, testesDeCompra, type Dia } from "../fatura";

const d = (iso: string): Dia => {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return { ano, mes, dia };
};
const resumo = (iso: string, diaFechamento: number, diaVencimento: number) => {
  const f = faturaDe(d(iso), { diaFechamento, diaVencimento });
  return { fatura: f.chave, fecha: isoDoDia(f.fechamento), vence: isoDoDia(f.vencimento) };
};

describe("faturaDe: a regra do Nubank", () => {
  it("compra antes do fechamento entra na fatura que fecha neste mês", () => {
    expect(resumo("2026-10-15", 20, 27)).toEqual({ fatura: "2026-10", fecha: "2026-10-20", vence: "2026-10-27" });
  });

  it("a véspera do fechamento ainda entra na fatura que fecha", () => {
    expect(resumo("2026-11-02", 3, 10)).toEqual({ fatura: "2026-11", fecha: "2026-11-03", vence: "2026-11-10" });
  });

  it("no próprio dia do fechamento a compra vai para a fatura seguinte", () => {
    expect(resumo("2026-11-03", 3, 10)).toEqual({ fatura: "2026-12", fecha: "2026-12-03", vence: "2026-12-10" });
    expect(resumo("2026-10-15", 15, 22)).toEqual({ fatura: "2026-11", fecha: "2026-11-15", vence: "2026-11-22" });
  });

  it("depois do fechamento também vai para a seguinte", () => {
    expect(resumo("2026-10-15", 3, 10)).toEqual({ fatura: "2026-11", fecha: "2026-11-03", vence: "2026-11-10" });
  });

  it("vira o ano: compra de dezembro depois do fechamento vai para a fatura de janeiro do ano seguinte", () => {
    expect(resumo("2026-12-05", 3, 10)).toEqual({ fatura: "2027-01", fecha: "2027-01-03", vence: "2027-01-10" });
    expect(resumo("2026-12-30", 28, 5)).toEqual({ fatura: "2027-02", fecha: "2027-01-28", vence: "2027-02-05" });
  });

  it("vencimento menor que o fechamento cai no mês seguinte ao do fechamento", () => {
    expect(resumo("2026-10-10", 28, 5)).toEqual({ fatura: "2026-11", fecha: "2026-10-28", vence: "2026-11-05" });
    expect(resumo("2026-10-28", 28, 5)).toEqual({ fatura: "2026-12", fecha: "2026-11-28", vence: "2026-12-05" });
  });

  it("vencimento igual ao fechamento também vai para o mês seguinte", () => {
    expect(resumo("2026-10-01", 10, 10)).toEqual({ fatura: "2026-11", fecha: "2026-10-10", vence: "2026-11-10" });
  });

  it("fevereiro: fechamento 30 vira 28, e a compra do dia 28 já é da fatura seguinte", () => {
    expect(resumo("2027-02-27", 30, 7)).toEqual({ fatura: "2027-03", fecha: "2027-02-28", vence: "2027-03-07" });
    expect(resumo("2027-02-28", 30, 7)).toEqual({ fatura: "2027-04", fecha: "2027-03-30", vence: "2027-04-07" });
  });

  it("fevereiro de ano bissexto tem o dia 29", () => {
    expect(resumo("2028-02-28", 30, 7)).toEqual({ fatura: "2028-03", fecha: "2028-02-29", vence: "2028-03-07" });
    expect(resumo("2028-02-29", 30, 7)).toEqual({ fatura: "2028-04", fecha: "2028-03-30", vence: "2028-04-07" });
  });

  it("dia 31: o mês de 30 dias fecha no 30", () => {
    expect(resumo("2026-09-29", 31, 8)).toEqual({ fatura: "2026-10", fecha: "2026-09-30", vence: "2026-10-08" });
    expect(resumo("2026-09-30", 31, 8)).toEqual({ fatura: "2026-11", fecha: "2026-10-31", vence: "2026-11-08" });
  });

  it("vencimento 31 num mês de 30 dias vence no 30", () => {
    expect(resumo("2026-10-25", 20, 31)).toEqual({ fatura: "2026-11", fecha: "2026-11-20", vence: "2026-11-30" });
    expect(resumo("2027-01-25", 20, 31)).toEqual({ fatura: "2027-02", fecha: "2027-02-20", vence: "2027-02-28" });
  });
});

describe("a fatura aberta e o teste de compra", () => {
  const nubank = { diaFechamento: 3, diaVencimento: 10 };

  it("o ciclo aberto vai do fechamento anterior até a véspera do próximo", () => {
    const c = cicloAberto(d("2026-10-15"), nubank);
    expect(isoDoDia(c.inicio)).toBe("2026-10-03");
    expect(isoDoDia(c.fim)).toBe("2026-11-02");
    expect(c.fatura.chave).toBe("2026-11");
  });

  it("fechamento dia 1: a véspera é o último dia do mês anterior", () => {
    const c = cicloAberto(d("2026-10-15"), { diaFechamento: 1, diaVencimento: 8 });
    expect(isoDoDia(c.fim)).toBe("2026-10-31");
    expect(c.fatura.chave).toBe("2026-11");
  });

  it("testar uma compra: hoje, a véspera e o fechamento, e só o fechamento pula de fatura", () => {
    const t = testesDeCompra(d("2026-10-15"), nubank);
    expect(t.map((x) => [x.chave, isoDoDia(x.dia), faturaDe(x.dia, nubank).chave])).toEqual([
      ["hoje", "2026-10-15", "2026-11"],
      ["vespera", "2026-11-02", "2026-11"],
      ["fechamento", "2026-11-03", "2026-12"],
    ]);
  });

  it("hoje é o fechamento: não repete o dia", () => {
    const t = testesDeCompra(d("2026-10-15"), { diaFechamento: 16, diaVencimento: 25 });
    expect(t.map((x) => x.chave)).toEqual(["hoje", "fechamento"]);
  });

  it("a fatura seguinte e a que vence num mês", () => {
    const f = faturaDe(d("2026-10-15"), nubank);
    expect(faturaSeguinte(f, nubank).chave).toBe("2026-12");
    expect(isoDoDia(faturaQueVenceEm(2026, 11, { diaFechamento: 28, diaVencimento: 5 }).fechamento)).toBe("2026-10-28");
  });

  it("melhor dia para comprar é o do fechamento", () => {
    expect(melhorDiaParaComprar(nubank)).toBe(3);
  });

  it("nomes: o mês do vencimento, com o ano só quando muda", () => {
    const f = faturaDe(d("2026-12-05"), nubank);
    expect(nomeDaFatura(f, 2026)).toBe("janeiro de 2027");
    expect(nomeDaFatura(faturaDe(d("2026-10-15"), nubank), 2026)).toBe("novembro");
    expect(diaCurto(f.vencimento)).toBe("10/jan");
  });
});

describe("a fatura de um lançamento", () => {
  it("com o dia: pela regra; sem o dia (fatura importada no mês do vencimento): o mês dele", () => {
    const c = { diaFechamento: 3, diaVencimento: 10 };
    expect(faturaDoLancamento({ year: 2026, month: 10, entryDate: new Date("2026-10-15T00:00:00Z") }, c).chave).toBe("2026-11");
    expect(faturaDoLancamento({ year: 2026, month: 10, entryDate: "2026-10-02" }, c).chave).toBe("2026-10");
    expect(faturaDoLancamento({ year: 2026, month: 11, entryDate: null }, c).chave).toBe("2026-11");
  });

  it("cartão sem os dias: o mês do lançamento", () => {
    expect(faturaDoLancamento({ year: 2026, month: 10, entryDate: "2026-10-20" }, { diaFechamento: null, diaVencimento: null }).chave).toBe("2026-10");
  });
});
