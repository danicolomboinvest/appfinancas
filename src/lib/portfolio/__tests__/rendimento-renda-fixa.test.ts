import { describe, expect, it } from "vitest";
import cdi2025 from "./fixtures/cdi-2025-sgs12.json";
import { dataDoDia, dia, diasUteis, ehDiaUtil, feriadosDoAno, pascoa } from "../calendario-anbima";
import {
  comoRendeDoAtivo,
  fatorCdi,
  fatorIpca,
  fatorPre,
  principalDaCompra,
  rendimentoDoAtivo,
  valorPeloIndice,
  type ComoRende,
  type PontoDoIndice,
  type Series,
} from "../rendimento-renda-fixa";
import { lerSgs } from "@/lib/indicadores/fontes";
import { diaDe } from "../calendario-anbima";

// O CDI real de 2025 (SGS 12, Banco Central), 252 dias úteis, guardado em fixtures.
const CDI_2025: PontoDoIndice[] = lerSgs(cdi2025).map((p) => ({ dia: diaDe(p.data), valor: p.valor / 100 }));
const semIpca: Series = { cdi: CDI_2025, ipca: [] };
const cdi = (percentual: number, semTaxa = false): ComoRende => ({ como: "cdi", percentual, semTaxa });

describe("calendário ANBIMA", () => {
  it("Páscoa e feriados móveis de 2025 e 2026", () => {
    expect(dataDoDia(pascoa(2025)).toISOString().slice(0, 10)).toBe("2025-04-20");
    expect(dataDoDia(pascoa(2026)).toISOString().slice(0, 10)).toBe("2026-04-05");
    const f2026 = [...feriadosDoAno(2026)].map((d) => dataDoDia(d).toISOString().slice(5, 10)).sort();
    expect(f2026).toEqual(["01-01", "02-16", "02-17", "04-03", "04-21", "05-01", "06-04", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"]);
  });

  it("os dias úteis de 2025 são exatamente os dias com CDI publicado", () => {
    const uteis: number[] = [];
    for (let d = dia(2025, 1, 1); d < dia(2026, 1, 1); d++) if (ehDiaUtil(d)) uteis.push(d);
    expect(uteis).toEqual(CDI_2025.map((p) => p.dia));
    expect(diasUteis(dia(2025, 1, 1), dia(2026, 1, 1))).toBe(252);
  });

  it("virada de ano: 31/12 é útil, 1º de janeiro não, e o fim de semana no meio também não", () => {
    // [30/12/2025, 05/01/2026): 30/12, 31/12, 02/01 (01/01 feriado, 03 e 04 fim de semana).
    expect(diasUteis(dia(2025, 12, 30), dia(2026, 1, 5))).toBe(3);
    expect(ehDiaUtil(dia(2026, 1, 1))).toBe(false);
    // Consciência Negra só é nacional desde 2024.
    expect(ehDiaUtil(dia(2023, 11, 20))).toBe(true);
    expect(ehDiaUtil(dia(2026, 11, 20))).toBe(false);
  });
});

describe("pós-fixado (CDI)", () => {
  it("R$ 1.000 a 100% do CDI em 2025 viram R$ 1.143,24 (o CDI real dia a dia)", () => {
    const f = fatorCdi(CDI_2025, 1, dia(2025, 1, 1), dia(2026, 1, 1))!;
    expect(Math.round(1000 * f.fator * 100) / 100).toBe(1143.24);
    expect(dataDoDia(f.ate!).toISOString().slice(0, 10)).toBe("2025-12-31");
    // Conferido com o CDI acumulado no mês da SGS 4391 (Banco Central), que vem com 2 casas:
    // 1,01 0,99 0,96 1,06 1,14 1,10 1,28 1,16 1,22 1,28 1,05 1,22 → 14,33% (arredondado).
    const mensal = [1.01, 0.99, 0.96, 1.06, 1.14, 1.1, 1.28, 1.16, 1.22, 1.28, 1.05, 1.22].reduce((a, v) => a * (1 + v / 100), 1);
    expect(Math.abs(f.fator - mensal)).toBeLessThan(0.0005);
  });

  it("110% do CDI multiplica o CDI do dia antes de compor", () => {
    const f = fatorCdi(CDI_2025, 1.1, dia(2025, 1, 1), dia(2026, 1, 1))!;
    const aMao = CDI_2025.reduce((a, p) => a * (1 + p.valor * 1.1), 1);
    expect(f.fator).toBeCloseTo(aMao, 12);
    expect(Math.round(1000 * f.fator * 100) / 100).toBe(1158.65);
  });

  it("conta da compra (inclusive) até o último dia com CDI antes de hoje", () => {
    // Compra em 02/01/2025, hoje 06/01/2025: CDI de 02 e 03/01 (0,045513% cada).
    const f = fatorCdi(CDI_2025, 1, dia(2025, 1, 2), dia(2025, 1, 6))!;
    expect(f.fator).toBeCloseTo(1.00045513 ** 2, 12);
    expect(dataDoDia(f.ate!).toISOString().slice(0, 10)).toBe("2025-01-03");
  });

  it("não calcula quando a série começa muito depois da compra (faltariam dias)", () => {
    expect(fatorCdi(CDI_2025, 1, dia(2024, 6, 1), dia(2025, 6, 1))).toBeNull();
    expect(fatorCdi([], 1, dia(2025, 6, 1), dia(2025, 7, 1))).toBeNull();
  });
});

describe("prefixado", () => {
  it("12% ao ano por 252 dias úteis dá 12% exatos", () => {
    const f = fatorPre(0.12, dia(2025, 1, 2), dia(2026, 1, 2));
    expect(diasUteis(dia(2025, 1, 2), dia(2026, 1, 2))).toBe(252);
    expect(Math.round(1000 * f.fator * 100) / 100).toBe(1120);
  });

  it("feriado não rende: de sexta 10/10/2026 a terça 13/10/2026 é 1 dia útil (12/10 é feriado)", () => {
    expect(diasUteis(dia(2026, 10, 9), dia(2026, 10, 14))).toBe(2); // 09 e 13
    expect(fatorPre(0.1, dia(2026, 10, 9), dia(2026, 10, 14)).fator).toBeCloseTo(1.1 ** (2 / 252), 12);
  });
});

describe("IPCA+", () => {
  const IPCA: PontoDoIndice[] = [
    { dia: dia(2026, 7, 1), valor: 0.0007 },
    { dia: dia(2026, 8, 1), valor: -0.0032 },
    { dia: dia(2026, 9, 1), valor: 0.0082 },
  ];

  it("mês inteiro entra inteiro, o corrente pró-rata com o último IPCA, marcado como estimado", () => {
    // Compra 01/09/2026, hoje 16/10/2026. Setembro inteiro (0,82%). Outubro sem IPCA ainda: usa
    // 0,82% pró-rata, 10 dos 21 dias úteis (12/10 é feriado).
    expect(diasUteis(dia(2026, 10, 1), dia(2026, 11, 1))).toBe(21);
    expect(diasUteis(dia(2026, 10, 1), dia(2026, 10, 16))).toBe(10);
    const f = fatorIpca(IPCA, dia(2026, 9, 1), dia(2026, 10, 16))!;
    expect(f.fator).toBeCloseTo(1.0082 * 1.0082 ** (10 / 21), 12);
    expect(f.estimado).toBe(true);
    expect(dataDoDia(f.ate!).toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("mês da compra pró-rata e meses já divulgados não são estimativa", () => {
    // Compra 15/07/2026, hoje 01/09/2026: julho de 15 a 31 e agosto inteiro.
    const f = fatorIpca(IPCA, dia(2026, 7, 15), dia(2026, 9, 1))!;
    const julho = diasUteis(dia(2026, 7, 15), dia(2026, 8, 1)) / diasUteis(dia(2026, 7, 1), dia(2026, 8, 1));
    expect(f.fator).toBeCloseTo(1.0007 ** julho * (1 - 0.0032), 12);
    expect(f.estimado).toBe(false);
  });

  it("IPCA + 7,5%: inflação vezes o juro real pelos dias úteis", () => {
    const r = valorPeloIndice({ base: { dia: dia(2026, 9, 1), valor: 1000 }, movimentos: [], rende: { como: "ipca", taxa: 0.075 }, series: { cdi: [], ipca: IPCA }, ate: dia(2026, 10, 16) })!;
    const du = diasUteis(dia(2026, 9, 1), dia(2026, 10, 16));
    expect(du).toBe(31);
    expect(r.valor).toBe(Math.round(1000 * 1.0082 * 1.0082 ** (10 / 21) * 1.075 ** (31 / 252) * 100) / 100);
    expect(r.estimado).toBe(true);
    expect(r.como).toBe("ipca");
  });

  it("compra antes do primeiro IPCA guardado: não calcula", () => {
    expect(fatorIpca(IPCA, dia(2026, 5, 10), dia(2026, 9, 1))).toBeNull();
  });
});

describe("aportes e resgates", () => {
  const ate = dia(2026, 1, 1);
  const compra = dia(2025, 1, 2);

  it("aporte rende da própria data: igual a seguir o saldo dia a dia", () => {
    const r = valorPeloIndice({ base: { dia: compra, valor: 1000 }, movimentos: [{ dia: dia(2025, 7, 1), valor: 500 }], rende: cdi(1), series: semIpca, ate })!;
    const primeiro = fatorCdi(CDI_2025, 1, compra, dia(2025, 7, 1))!.fator;
    const segundo = fatorCdi(CDI_2025, 1, dia(2025, 7, 1), ate)!.fator;
    expect(r.valor).toBe(Math.round(((1000 * primeiro + 500) * segundo) * 100) / 100);
  });

  it("resgate tira o valor no dia e o que sobra continua rendendo", () => {
    const r = valorPeloIndice({ base: { dia: compra, valor: 1000 }, movimentos: [{ dia: dia(2025, 7, 1), valor: -300 }], rende: cdi(1), series: semIpca, ate })!;
    const primeiro = fatorCdi(CDI_2025, 1, compra, dia(2025, 7, 1))!.fator;
    const segundo = fatorCdi(CDI_2025, 1, dia(2025, 7, 1), ate)!.fator;
    expect(r.valor).toBe(Math.round(((1000 * primeiro - 300) * segundo) * 100) / 100);
  });

  it("acha o valor da compra a partir do investido de hoje (a regra do Resgatei)", () => {
    // Comprou 1.000, aportou 500 em julho, resgatou 300 em outubro. O app guardou o investido
    // assim: 1.500, depois × (1 − 300 / valor do dia).
    const movimentos = [
      { dia: dia(2025, 7, 1), valor: 500 },
      { dia: dia(2025, 10, 1), valor: -300 },
    ];
    const valorNoResgate = valorPeloIndice({ base: { dia: compra, valor: 1000 }, movimentos: movimentos.slice(0, 1), rende: cdi(1), series: semIpca, ate: dia(2025, 10, 1) })!.valor;
    const investidoHoje = 1500 * (1 - 300 / valorNoResgate);
    expect(principalDaCompra({ investido: investidoHoje, compra, movimentos, rende: cdi(1), series: semIpca })).toBeCloseTo(1000, 1);
    // Sem resgate é só tirar os aportes.
    expect(principalDaCompra({ investido: 1500, compra, movimentos: movimentos.slice(0, 1), rende: cdi(1), series: semIpca })).toBe(1000);
  });

  it("investido que não fecha com os aportes (editado à mão): usa o investido como compra", () => {
    const ativo = { name: "CDB", assetClass: "RENDA_FIXA", fixedIncomeIndex: "POS_FIXADO", taxaCompra: 1, investedValue: 400 };
    const r = rendimentoDoAtivo({ ativo, compra, informado: null, movimentos: [{ dia: dia(2025, 7, 1), valor: 500, depoisDoInformado: true }], series: semIpca, ate })!;
    expect(r.valor).toBe(Math.round(400 * fatorCdi(CDI_2025, 1, compra, ate)!.fator * 100) / 100);
  });
});

describe("o ativo inteiro", () => {
  const ate = dia(2026, 1, 1);
  const compra = dia(2025, 1, 2);
  const base = { name: "CDB Banco Inter", assetClass: "RENDA_FIXA", fixedIncomeIndex: "POS_FIXADO", investedValue: 1000 };

  it("sem taxa: 100% do CDI e estimado", () => {
    expect(comoRendeDoAtivo({ ...base, taxaCompra: null })).toEqual({ como: "cdi", percentual: 1, semTaxa: true });
    const r = rendimentoDoAtivo({ ativo: { ...base, taxaCompra: null }, compra, informado: null, movimentos: [], series: semIpca, ate })!;
    expect(r.estimado).toBe(true);
    expect(r.valor).toBe(1143.24);
  });

  it("com a taxa dela não é estimado", () => {
    const r = rendimentoDoAtivo({ ativo: { ...base, taxaCompra: 1.1 }, compra, informado: null, movimentos: [], series: semIpca, ate })!;
    expect(r).toMatchObject({ valor: 1158.65, estimado: false, como: "cdi" });
  });

  it("Tesouro Selic rende o CDI sem pedir taxa; poupança fica de fora", () => {
    expect(comoRendeDoAtivo({ name: "Tesouro Selic 2029", assetClass: "TESOURO_DIRETO", fixedIncomeIndex: "POS_FIXADO", taxaCompra: null })).toEqual({ como: "cdi", percentual: 1, semTaxa: false });
    expect(comoRendeDoAtivo({ name: "Poupança Caixa", assetClass: "RENDA_FIXA", fixedIncomeIndex: null, taxaCompra: null })).toBeNull();
    expect(comoRendeDoAtivo({ name: "PETR4", assetClass: "ACAO", fixedIncomeIndex: null, taxaCompra: null })).toBeNull();
  });

  it("o valor que ela informou vira a base; só os movimentos depois dele contam", () => {
    const r = rendimentoDoAtivo({
      ativo: { ...base, taxaCompra: 1 },
      compra,
      informado: { dia: dia(2025, 7, 1), valor: 1234.56 },
      movimentos: [
        { dia: dia(2025, 3, 1), valor: 999, depoisDoInformado: false },
        { dia: dia(2025, 9, 1), valor: 100, depoisDoInformado: true },
      ],
      series: semIpca,
      ate,
    })!;
    const esperado = 1234.56 * fatorCdi(CDI_2025, 1, dia(2025, 7, 1), ate)!.fator + 100 * fatorCdi(CDI_2025, 1, dia(2025, 9, 1), ate)!.fator;
    expect(r.valor).toBe(Math.round(esperado * 100) / 100);
  });

  it("sem data nem valor informado, ou comprado hoje: não calcula", () => {
    expect(rendimentoDoAtivo({ ativo: { ...base, taxaCompra: 1 }, compra: null, informado: null, movimentos: [], series: semIpca, ate })).toBeNull();
    expect(rendimentoDoAtivo({ ativo: { ...base, taxaCompra: 1 }, compra: ate, informado: null, movimentos: [], series: semIpca, ate })).toBeNull();
  });

  it("o valor muda quando o dia avança", () => {
    const ontem = rendimentoDoAtivo({ ativo: { ...base, taxaCompra: 1.1 }, compra, informado: null, movimentos: [], series: semIpca, ate: dia(2025, 10, 15) })!;
    const hoje = rendimentoDoAtivo({ ativo: { ...base, taxaCompra: 1.1 }, compra, informado: null, movimentos: [], series: semIpca, ate: dia(2025, 10, 16) })!;
    expect(hoje.valor).toBeGreaterThan(ontem.valor);
    expect(hoje.referenteA - ontem.referenteA).toBe(1);
  });
});
