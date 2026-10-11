import { describe, expect, it } from "vitest";
import {
  chaveDoMes,
  duracao,
  mesDaqui,
  mesDoAporte,
  mesesAteChegar,
  mesesDaMeta,
  planoDaMeta,
  porMesDaNovaMeta,
  proximaAChegar,
  ritmoDaMeta,
  situacaoDoMes,
  type EntradaDaMeta,
} from "../projecao";
import { proximoAporte } from "@/lib/planning/goal-checkin";

/** O "Próximo aporte · nov" do cartão: a mesma conta, feita como se já fosse 1º de novembro. */
const proximo = (e: EntradaDaMeta) =>
  Math.ceil(proximoAporte({ targetAmount: e.alvo, currentAmount: e.guardado, targetDate: e.prazo!, annualRate: e.taxaAnual, now: e.hoje })?.amount ?? 0);

/** Hoje da Ana canônica: quarta, 7 de outubro de 2026 (ana-canonica.md). */
const HOJE = new Date(2026, 9, 7);
/** Datas locais, como o protótipo (o formulário grava o prazo ao meio-dia local). */
const utc = (a: number, m: number) => new Date(a, m - 1, 1);

const aportes = (lista: [string, number][]) => new Map(lista);
const mensal = (de: [number, number], ate: [number, number], valor: number) => {
  const l: [string, number][] = [];
  for (let a = de[0], m = de[1]; a < ate[0] || (a === ate[0] && m <= ate[1]); m === 12 ? ((a += 1), (m = 1)) : (m += 1)) l.push([chaveDoMes(a, m), valor]);
  return l;
};

// As três metas da Ana (ana-canonica.md, seção 3), com o histórico do protótipo.
const reserva: EntradaDaMeta = {
  alvo: 21000, guardado: 4200, prazo: utc(2029, 3), taxaAnual: 0.1, inicio: new Date(2026, 2, 1), porMesCombinado: 600,
  aportes: aportes(mensal([2026, 3], [2026, 9], 600)), hoje: HOJE,
};
const europa: EntradaDaMeta = {
  alvo: 20000, guardado: 1429, prazo: utc(2027, 11), taxaAnual: 0.1, inicio: new Date(2026, 0, 1), porMesCombinado: 1327,
  aportes: aportes([["2026-01", 300], ["2026-03", 200], ["2026-05", 329], ["2026-07", 200], ["2026-08", 400]]), hoje: HOJE,
};
const carro: EntradaDaMeta = {
  alvo: 30000, guardado: 8300, prazo: utc(2029, 10), taxaAnual: 0.1, inicio: new Date(2025, 9, 1), porMesCombinado: 600,
  aportes: aportes([["2025-10", 1700], ...mensal([2025, 11], [2026, 9], 600)]), hoje: HOJE,
};

describe("Metas da Ana (números de aceitação)", () => {
  it("Europa: R$ 1.340 por mês, ritmo R$ 200, chega mai/2032, 54 meses depois do prazo, atrasada", () => {
    const p = planoDaMeta(europa);
    expect(p.porMesNecessario).toBe(1340);
    expect(p.ritmo).toBe(200);
    expect(p.status).toBe("BEHIND");
    expect(mesDaqui(HOJE, p.chega!).texto).toBe("mai/2032");
    expect(p.chega! - 13).toBe(54);
    expect(p.tarde).toBe(true);
    expect(Math.round(p.esperado!)).toBe(8341);
    expect(p.atras).toBe(6912);
    expect(p.pct).toBe(7);
    expect(p.mesesAtePrazo).toBe(13);
    expect(duracao(p.mesesAtePrazo!)).toBe("1 ano e 1 mês");
    expect(duracao(p.chega! - 13)).toBe("4 anos e 6 meses");
  });

  it("Reserva: no ritmo, próximo aporte (nov) R$ 501, chega out/2028", () => {
    const p = planoDaMeta(reserva);
    expect(p.status).toBe("ON_TRACK");
    expect(proximo(reserva)).toBe(501);
    expect(mesDaqui(HOJE, p.chega!).texto).toBe("out/2028");
    expect(Math.round(p.esperado!)).toBe(4215);
  });

  it("Carro: no ritmo, próximo aporte (nov) R$ 471, chega mar/2029", () => {
    const p = planoDaMeta(carro);
    expect(p.status).toBe("ON_TRACK");
    expect(proximo(carro)).toBe(471);
    expect(mesDaqui(HOJE, p.chega!).texto).toBe("mar/2029");
  });

  it("totais: R$ 13.929 de R$ 71.000 (20%), R$ 2.527 por mês; próxima a chegar é a Reserva", () => {
    const metas = [reserva, europa, carro].map((e, i) => ({ nome: ["Reserva", "Europa", "Carro"][i], e, plano: planoDaMeta(e) }));
    const guardado = metas.reduce((t, m) => t + m.e.guardado, 0);
    const alvo = metas.reduce((t, m) => t + m.e.alvo, 0);
    expect(guardado).toBe(13929);
    expect(alvo).toBe(71000);
    expect(Math.round((guardado / alvo) * 100)).toBe(20);
    expect(metas.reduce((t, m) => t + m.e.porMesCombinado, 0)).toBe(2527);
    expect(proximaAChegar(metas)?.nome).toBe("Reserva");
  });
});

describe("ritmo e chegada", () => {
  it("o ritmo usa só os 3 últimos meses FECHADOS (o mês de hoje fica de fora)", () => {
    const a = aportes([["2026-07", 300], ["2026-08", 300], ["2026-09", 300], ["2026-10", 5000]]);
    expect(ritmoDaMeta(a, new Date(2026, 0, 1), HOJE)).toBe(300);
  });

  it("meta com menos de 3 meses fechados usa os que tem; nascida neste mês não tem ritmo", () => {
    expect(ritmoDaMeta(aportes([["2026-09", 600]]), new Date(2026, 8, 10), HOJE)).toBe(600);
    expect(ritmoDaMeta(aportes([["2026-10", 600]]), new Date(2026, 9, 2), HOJE)).toBe(0);
  });

  it("resgate conta o líquido e o ritmo nunca fica negativo", () => {
    expect(ritmoDaMeta(aportes([["2026-09", -900]]), new Date(2026, 6, 1), HOJE)).toBe(0);
  });

  it("chegar: já chegou é 0; sem nada por mês, nunca", () => {
    expect(mesesAteChegar(100, 100, 0, 0.1)).toBe(0);
    expect(mesesAteChegar(0, 100, 0, 0.1)).toBeNull();
    expect(mesesAteChegar(0, 1000, 100, 0)).toBe(10);
  });

  it("sem ritmo, a chegada vem do valor combinado (e não conta como 'tarde')", () => {
    const p = planoDaMeta({ ...europa, aportes: aportes([]), inicio: new Date(2026, 9, 1) });
    expect(p.chegaPeloRitmo).toBe(false);
    expect(p.chega).not.toBeNull();
    expect(p.tarde).toBe(false);
    expect(p.nova).toBe(true);
  });

  it("sem prazo: status Sem prazo, por mês é o combinado, sem esperado", () => {
    const p = planoDaMeta({ ...reserva, prazo: null });
    expect(p.status).toBe("SEM_PRAZO");
    expect(p.porMesNecessario).toBe(600);
    expect(p.esperado).toBeNull();
    expect(p.atras).toBeNull();
  });

  it("os meses da meta vão do mês de início ao mês de hoje", () => {
    const m = mesesDaMeta(new Date(2026, 6, 20), HOJE).map((x) => x.chave);
    expect(m).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
  });
});

describe("aporte do mês e Mês a mês", () => {
  it("até o dia 7 pergunta do mês passado; depois, do mês de hoje", () => {
    expect(mesDoAporte(HOJE)).toMatchObject({ chave: "2026-09", nome: "setembro", doMesPassado: true });
    expect(mesDoAporte(new Date(2026, 9, 8))).toMatchObject({ chave: "2026-10", nome: "outubro", doMesPassado: false });
    expect(mesDoAporte(new Date(2027, 0, 3))).toMatchObject({ chave: "2026-12" });
  });

  it("bolinha cheia a partir de 95% do combinado, meia abaixo, vazia sem nada", () => {
    expect(situacaoDoMes(600, 600, false)).toBe("tudo");
    expect(situacaoDoMes(570, 600, false)).toBe("tudo");
    expect(situacaoDoMes(200, 600, false)).toBe("parte");
    expect(situacaoDoMes(0, 600, false)).toBe("nada");
    expect(situacaoDoMes(0, 600, true)).toBe("atual");
  });
});

describe("nova meta", () => {
  it("o 'guardar por mês' arredonda para cima de 10 em 10", () => {
    const v = porMesDaNovaMeta(8000, new Date(2027, 9, 1, 12), HOJE);
    expect(v % 10).toBe(0);
    expect(v).toBe(640);
  });
});
