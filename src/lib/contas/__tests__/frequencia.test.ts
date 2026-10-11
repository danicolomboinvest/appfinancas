import { describe, expect, it } from "vitest";
import {
  camposDaRegra,
  depoisDePagarComRegra,
  ehMenosQueMensal,
  estimativaAproximada,
  guardePorMes,
  mediaPorMes,
  ocorrencias,
  previaDoze,
  proximaOcorrencia,
  regraDaConta,
  textoDaRegra,
  type Regra,
} from "../frequencia";

const d = (a: number, m: number, dia: number) => new Date(Date.UTC(a, m - 1, dia));
const iso = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);
const hoje = d(2026, 10, 7);

describe("regra da conta (seção 3.17)", () => {
  it("as contas de antes continuam: repete = todo mês, sem repete = não repete", () => {
    expect(regraDaConta({ repete: true, intervalo: null, unidade: null, mesesEscolhidos: [], parcelas: null })).toEqual({ tipo: "a_cada", n: 1, unidade: "meses" });
    expect(regraDaConta({ repete: false, intervalo: null, unidade: null, mesesEscolhidos: [], parcelas: null })).toEqual({ tipo: "nao_repete" });
  });

  it("ida e volta pelas colunas", () => {
    const regras: Regra[] = [{ tipo: "nao_repete" }, { tipo: "a_cada", n: 2, unidade: "semanas" }, { tipo: "meses", meses: [1, 7] }];
    for (const r of regras) expect(regraDaConta({ ...camposDaRegra(r), parcelas: null })).toEqual(r);
  });
});

describe("próximos vencimentos", () => {
  it("a cada 2 semanas, 10 dias, 3 meses e 2 anos", () => {
    expect(iso(proximaOcorrencia(d(2026, 10, 15), { tipo: "a_cada", n: 2, unidade: "semanas" }))).toBe("2026-10-29");
    expect(iso(proximaOcorrencia(d(2026, 10, 25), { tipo: "a_cada", n: 10, unidade: "dias" }))).toBe("2026-11-04");
    expect(iso(proximaOcorrencia(d(2026, 11, 30), { tipo: "a_cada", n: 3, unidade: "meses" }))).toBe("2027-02-28");
    expect(iso(proximaOcorrencia(d(2027, 6, 10), { tipo: "a_cada", n: 2, unidade: "anos" }))).toBe("2029-06-10");
  });

  it("conta do dia 31 passa por fevereiro e volta para o 31", () => {
    const r: Regra = { tipo: "a_cada", n: 1, unidade: "meses" };
    const fev = proximaOcorrencia(d(2027, 1, 31), r, 31)!;
    expect(iso(fev)).toBe("2027-02-28");
    expect(iso(proximaOcorrencia(fev, r, 31))).toBe("2027-03-31");
  });

  it("em meses que eu escolho: janeiro e julho", () => {
    const r: Regra = { tipo: "meses", meses: [1, 7] };
    expect(iso(proximaOcorrencia(d(2027, 1, 5), r))).toBe("2027-07-05");
    expect(iso(proximaOcorrencia(d(2027, 7, 5), r))).toBe("2028-01-05");
  });

  it("a semana das contas acha a diarista duas vezes em 30 dias", () => {
    const datas = ocorrencias(d(2026, 10, 15), { tipo: "a_cada", n: 2, unidade: "semanas" }, hoje, d(2026, 11, 6));
    expect(datas.map(iso)).toEqual(["2026-10-15", "2026-10-29"]);
  });
});

describe("média por mês e prévia de 12 meses (rodada 10)", () => {
  it("R$ 1.560 a cada 2 semanas dá R$ 3.380 por mês; R$ 180 dá R$ 390", () => {
    expect(mediaPorMes(1560, { tipo: "a_cada", n: 2, unidade: "semanas" })).toBe(3380);
    expect(mediaPorMes(180, { tipo: "a_cada", n: 2, unidade: "semanas" })).toBe(390);
    expect(mediaPorMes(2400, { tipo: "a_cada", n: 1, unidade: "anos" })).toBe(200);
  });

  it("meses com 3 vencimentos ficam mais altos que os de 2", () => {
    const p = previaDoze(d(2026, 10, 1), { tipo: "a_cada", n: 2, unidade: "semanas" }, 1560, hoje);
    expect(p).toHaveLength(12);
    const vezes = new Set(p.map((m) => m.vezes));
    expect([...vezes].sort()).toEqual([2, 3]);
    const tres = p.find((m) => m.vezes === 3)!;
    const dois = p.find((m) => m.vezes === 2)!;
    expect(tres.total).toBe(4680);
    expect(dois.total).toBe(3120);
  });

  it("parcelada não passa da última parcela na prévia", () => {
    const p = previaDoze(d(2026, 10, 10), { tipo: "a_cada", n: 1, unidade: "meses" }, 200, hoje, 3);
    expect(p.filter((m) => m.vezes > 0)).toHaveLength(3);
  });
});

describe("contas do ano e guarde por mês", () => {
  it("Seguro do carro R$ 1.560 em junho de 2027: guarde R$ 195; IPVA R$ 2.400 em março: R$ 480", () => {
    expect(guardePorMes(1560, d(2027, 6, 10), hoje)).toBe(195);
    expect(guardePorMes(2400, d(2027, 3, 10), hoje)).toBe(480);
  });

  it("mensal não é conta do ano; anual, a cada 3 meses e meses escolhidos são", () => {
    expect(ehMenosQueMensal({ tipo: "a_cada", n: 1, unidade: "meses" })).toBe(false);
    expect(ehMenosQueMensal({ tipo: "a_cada", n: 2, unidade: "semanas" })).toBe(false);
    expect(ehMenosQueMensal({ tipo: "a_cada", n: 1, unidade: "anos" })).toBe(true);
    expect(ehMenosQueMensal({ tipo: "a_cada", n: 3, unidade: "meses" })).toBe(true);
    expect(ehMenosQueMensal({ tipo: "meses", meses: [1, 7] })).toBe(true);
    expect(ehMenosQueMensal({ tipo: "nao_repete" })).toBe(false);
  });
});

describe("valor aproximado", () => {
  it("a luz da Ana (112, 131, 141) vira ~R$ 128; só os 3 últimos contam", () => {
    expect(estimativaAproximada([112, 131, 141])).toBe(128);
    expect(estimativaAproximada([500, 112, 131, 141])).toBe(128);
    expect(estimativaAproximada([])).toBeNull();
  });
});

describe("paguei com regra", () => {
  it("a parcelada anda uma parcela e acaba na última", () => {
    const r: Regra = { tipo: "a_cada", n: 1, unidade: "meses" };
    expect(depoisDePagarComRegra({ vencimento: d(2026, 10, 10), parcelas: 3, parcelaAtual: 2 }, r)).toEqual({ vencimento: d(2026, 11, 10), quitada: false, parcelaAtual: 3 });
    expect(depoisDePagarComRegra({ vencimento: d(2026, 11, 10), parcelas: 3, parcelaAtual: 3 }, r).quitada).toBe(true);
  });

  it("não repete fica quitada; a cada 2 semanas pula 14 dias", () => {
    expect(depoisDePagarComRegra({ vencimento: d(2026, 10, 10), parcelas: null, parcelaAtual: null }, { tipo: "nao_repete" }).quitada).toBe(true);
    expect(iso(depoisDePagarComRegra({ vencimento: d(2026, 10, 15), parcelas: null, parcelaAtual: null }, { tipo: "a_cada", n: 2, unidade: "semanas" }).vencimento)).toBe("2026-10-29");
  });
});

describe("texto da regra", () => {
  it("poucas palavras, sem abreviar a unidade", () => {
    expect(textoDaRegra({ tipo: "a_cada", n: 1, unidade: "meses" })).toBe("todo mês");
    expect(textoDaRegra({ tipo: "a_cada", n: 2, unidade: "semanas" })).toBe("a cada 2 semanas");
    expect(textoDaRegra({ tipo: "a_cada", n: 1, unidade: "anos" })).toBe("todo ano");
    expect(textoDaRegra({ tipo: "meses", meses: [1, 7] })).toBe("em jan e jul");
  });
});
