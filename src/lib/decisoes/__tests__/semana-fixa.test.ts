import { describe, expect, it } from "vitest";
import { contasDoMes, lancamentoDaConta, semanaFixa, semanaNoMes, CATEGORIAS_FIXAS, type EntradaDaSemana, type GastoDoDiaADia } from "../semana-fixa";
import { montarFoco, type FocoEntrada } from "../foco";
import { quantoPossoGastarNaSemana } from "../respostas";
import { numerosDoWidget } from "@/lib/widget/numeros";
import { vozDoTema } from "@/lib/profiles/voice";

/**
 * A regra A do gasto da semana (13/10/2026), com os casos do estudo
 * (Claude/estudo-apps-financas/gasto-da-semana-analise.html). Outubro de 2026: dia 1 é quinta,
 * 31 dias. Orçamento de exemplo do estudo: R$ 3.600 no mês, R$ 1.500 de Moradia.
 */

const OUTUBRO = { diasNoMes: 31 };
/** Dias até domingo, contando hoje, de um dia de outubro de 2026 (dia 1 = quinta). */
const ateDomingo = (dia: number) => 7 - ((new Date(2026, 9, dia).getDay() + 6) % 7);
const gasto = (valor: number, dia: number | null, entrouNoDia = dia ?? 1, importado = false): GastoDoDiaADia => ({ valor, dia, entrouNoDia, importado });

const outubro = (dia: number, over: Partial<FocoEntrada> = {}): FocoEntrada => ({
  ritmo: "semanal",
  dia,
  diasAteDomingo: ateDomingo(dia),
  ...OUTUBRO,
  categorias: [
    { key: "MORADIA", label: "Moradia", planejado: 1500, gasto: 0, fixa: true },
    { key: "ALIMENTACAO", label: "Alimentação", planejado: 1300, gasto: 0 },
    { key: "LAZER", label: "Lazer", planejado: 800, gasto: 0 },
  ],
  gastoDoMes: 0,
  aportadoNoMes: 0,
  aportePlanejado: null,
  diasDesdeUltimoGasto: 1,
  metas: [],
  reserva: null,
  hrefMes: "/mensal/2026/10",
  money: (v) => `R$ ${Math.round(v)}`,
  t: vozDoTema("padrao").titulos,
  diaADia: { gastos: [], contasLancadas: 0, pendentes: [] },
  ...over,
});

const semana = (f: ReturnType<typeof montarFoco>) => {
  if (f.livre.tipo === "semOrcamento") throw new Error("sem orçamento");
  return f.livre.semana;
};

describe("semana fixa: o exemplo do estudo", () => {
  // Segunda, 11 de janeiro de 2027: 21 dias até o fim do mês, 3 semanas cheias.
  const base: EntradaDaSemana = { dia: 11, diasNoMes: 31, diasAteDomingo: 7, orcamento: 4050, contas: 1500, guardar: 450, renda: 4500, gastos: [gasto(1110, 5, 5)] };

  it("renda − guardar − contas − já gasto = sobra; ÷ 3 semanas = R$ 480", () => {
    const s = semanaFixa(base);
    expect(s.paraDiaADia).toBe(2550);
    expect(s.gastoAntes).toBe(1110);
    expect(s.sobraNoInicio).toBe(1440);
    expect(s.diasAteOFimDoMes / s.diasNaSemana).toBe(3);
    expect(s.valor).toBe(480);
  });

  it("quarta-feira: a semana abriu com R$ 480, saíram R$ 130, cabem R$ 350, R$ 70 por dia", () => {
    const s = semanaFixa({ ...base, dia: 13, diasAteDomingo: 5, gastos: [gasto(1110, 5, 5), gasto(80, 11), gasto(50, 13)] });
    expect(s.valor).toBe(480);
    expect(s.gasto).toBe(130);
    expect(s.restante).toBe(350);
    expect(s.porDia).toBe(70);
    expect(s.acabaNoDomingo).toBe(true);
  });
});

describe("semana fixa: os casos que confundiam", () => {
  it("aluguel ainda não lançado não vira livre (antes: R$ 748 → R$ 402)", () => {
    const semAluguel = semana(montarFoco(outubro(6, { diaADia: { gastos: [gasto(200, 2)], contasLancadas: 0, pendentes: [] }, gastoDoMes: 200 })));
    const comAluguel = semana(
      montarFoco(
        outubro(6, {
          categorias: [
            { key: "MORADIA", label: "Moradia", planejado: 1500, gasto: 1500, fixa: true },
            { key: "ALIMENTACAO", label: "Alimentação", planejado: 1300, gasto: 200 },
            { key: "LAZER", label: "Lazer", planejado: 800, gasto: 0 },
          ],
          gastoDoMes: 1700,
          diaADia: { gastos: [gasto(200, 2)], contasLancadas: 0, pendentes: [] },
        }),
      ),
    );
    expect(semAluguel.valor).toBeCloseTo(comAluguel.valor, 6);
    expect(semAluguel.paraDiaADia).toBe(2100);
  });

  it("não cai sozinho na semana sem gasto (antes: segunda R$ 525, sábado R$ 200)", () => {
    const segunda = semana(montarFoco(outubro(12)));
    const sabado = semana(montarFoco(outubro(17)));
    expect(sabado.valor).toBeCloseTo(segunda.valor, 6);
    expect(sabado.restante).toBeCloseTo(segunda.restante, 6);
  });

  it("fatura importada no meio da semana não despenca (antes: R$ 888 → R$ 135); a próxima semana ajusta", () => {
    const antes = semana(montarFoco(outubro(21, { diaADia: { gastos: [gasto(60, 19)], contasLancadas: 0, pendentes: [] } })));
    // Quarta, 21: chega a fatura com R$ 1.400 de compras dos dias 1 a 15 (com dia e sem dia).
    const depois = semana(
      montarFoco(
        outubro(21, {
          diaADia: { gastos: [gasto(60, 19), gasto(900, 8, 21, true), gasto(500, null, 21, true)], contasLancadas: 0, pendentes: [] },
        }),
      ),
    );
    expect(depois.valor).toBeCloseTo(antes.valor, 6);
    expect(depois.restante).toBeCloseTo(antes.restante, 6);
    expect(depois.chegouDepois).toBe(1400);
    expect(depois.proxima!).toBeLessThan(antes.proxima!);
    // A próxima (segunda 26 a sábado 31) é a última do mês e leva a sobra inteira: R$ 1.400 a menos.
    expect(antes.proxima! - depois.proxima!).toBeCloseTo(1400, 6);
  });

  it("renda pela metade muda o número, com \"conto só o que já entrou\"", () => {
    const cheia = semana(montarFoco(outubro(13, { aportePlanejado: 450, renda: 4500, rendaFonte: "plano" })));
    const metade = semana(montarFoco(outubro(13, { aportePlanejado: 450, renda: 2000, rendaFonte: "entrou" })));
    expect(metade.valor).toBeLessThan(cheia.valor);
    expect(metade.paraDiaADia).toBe(50); // 2.000 − 450 de guardar − 1.500 de aluguel
    expect(metade.cortadoPelaRenda).toBe(true);
  });

  it("estouro mostra o valor (\"Passou R$ 60\"), nunca só R$ 0", () => {
    // A semana de 11 de janeiro de 2027 abre com R$ 480; na quarta já saíram R$ 540.
    const s = semanaFixa({ dia: 13, diasNoMes: 31, diasAteDomingo: 5, orcamento: 4050, contas: 1500, guardar: 450, renda: 4500, gastos: [gasto(1110, 5, 5), gasto(540, 12)] });
    expect(s.valor).toBe(480);
    expect(s.passou).toBe(60);
    expect(s.porDia).toBe(0);
    const r = quantoPossoGastarNaSemana({ money: (v) => `R$ ${Math.round(v)}`, semana: s, diasSemLancar: null });
    expect(r.frase).toMatch(/^Passou R\$ 60 da semana/);
    expect(r.visual?.destaque).toBe("R$ 60");
    expect(r.visual?.rotulo).toBe("passou da semana");
  });

  it("a sobra de uma semana aumenta a seguinte; o estouro diminui", () => {
    const entrada = (gastoDaSemana: number): EntradaDaSemana => ({ dia: 17, diasNoMes: 31, diasAteDomingo: 2, orcamento: 3600, contas: 1500, guardar: null, renda: null, gastos: [gasto(gastoDaSemana, 13)] });
    const normal = semanaFixa(entrada(0)).valor; // R$ 735: o que esta semana leva
    const gastouMenos = semanaFixa(entrada(100)).proxima!;
    const passou = semanaFixa(entrada(800)).proxima!;
    expect(gastouMenos).toBeGreaterThan(normal);
    expect(passou).toBeLessThan(normal);
    expect(semanaFixa(entrada(800)).passou).toBeCloseTo(65, 6);
  });
});

describe("semana fixa: começo e fim de mês", () => {
  it("quinta, dia 1: a semana deste mês tem 4 dias e leva 4/31 do dia a dia", () => {
    expect(semanaNoMes(1, 31, 4)).toEqual({ inicio: 1, fim: 4 });
    const s = semana(montarFoco(outubro(1)));
    expect(s.diasNaSemana).toBe(4);
    expect(s.valor).toBeCloseTo((2100 * 4) / 31, 6);
    expect(s.acabaNoDomingo).toBe(true);
  });

  it("última semana cortada pelo fim do mês: leva a sobra inteira e o por dia vai até o último dia", () => {
    // Segunda 26 a sábado 31 de outubro.
    expect(semanaNoMes(28, 31, ateDomingo(28))).toEqual({ inicio: 26, fim: 31 });
    const s = semana(montarFoco(outubro(28, { diaADia: { gastos: [gasto(1500, 10)], contasLancadas: 0, pendentes: [] } })));
    expect(s.valor).toBeCloseTo(600, 6);
    expect(s.acabaNoDomingo).toBe(false);
    expect(s.proxima).toBeNull();
    expect(s.porDia).toBeCloseTo(600 / 4, 6);
  });

  it("setembro de 2026 termina numa quarta: segunda 28 a quarta 30, 3 dias", () => {
    expect(semanaNoMes(29, 30, 6)).toEqual({ inicio: 28, fim: 30 });
  });

  it("quem fecha por mês e não lançou nada: o plano da semana, sem dividir o aluguel", () => {
    const f = montarFoco(outubro(6, { ritmo: "mensal", lancouGastoNoMes: false }));
    expect(f.livre.tipo).toBe("estimativa");
    // Antes: o aluguel entrava no "livre" e era dividido pelos dias.
    expect(semana(f).valor).toBeCloseTo((2100 * 7) / 31, 6);
  });
});

describe("contas do mês: reservadas inteiras, sem contar duas vezes", () => {
  const fixa = (k: string) => CATEGORIAS_FIXAS.has(k);
  it("conta da lista sem categoria cabe primeiro no planejado de Moradia que ainda não saiu", () => {
    const c = contasDoMes([{ key: "MORADIA", planejado: 1500, gasto: 0, fixa: true }], 0, [{ valor: 1500, categoria: null }, { valor: 120, categoria: "SAUDE" }], fixa);
    expect(c.total).toBe(1620);
  });
  it("aluguel pago acima do plano: vale o que saiu", () => {
    expect(contasDoMes([{ key: "MORADIA", planejado: 1500, gasto: 1600, fixa: true }], 0, [], fixa).total).toBe(1600);
  });
  it("o lançamento que paga a conta da lista é reconhecido pelo nome ou pelo valor na categoria", () => {
    expect(lancamentoDaConta({ descricao: "PAG VIVO FIXO 10/2026", subcategoria: null, valor: 99.9, categoria: "MORADIA" }, { nome: "Vivo", valor: 100, categoria: null })).toBe(true);
    expect(lancamentoDaConta({ descricao: "PIX JOAO", subcategoria: null, valor: 1490, categoria: "MORADIA" }, { nome: "Aluguel", valor: 1500, categoria: "MORADIA" })).toBe(true);
    expect(lancamentoDaConta({ descricao: "MERCADO", subcategoria: null, valor: 100, categoria: "ALIMENTACAO" }, { nome: "Vivo", valor: 100, categoria: "MORADIA" })).toBe(false);
  });
});

describe("o mesmo número em todo lugar", () => {
  it("Resumo, widget e Decidir mostram o que ainda cabe na semana", () => {
    const f = montarFoco(outubro(14, { diaADia: { gastos: [gasto(300, 3), gasto(90, 12)], contasLancadas: 0, pendentes: [] } }));
    if (f.livre.tipo === "semOrcamento") throw new Error();
    const s = f.livre.semana;
    const w = numerosDoWidget({ livre: f.livre, agora: new Date(2026, 9, 14, 10), instante: new Date(), moeda: "BRL", tema: "padrao", modo: "auto", metas: [] });
    expect(w.livre.valor).toBe(Math.round(s.restante));
    expect(w.livre.rotulo).toBe("para gastar nesta semana");
    expect(f.livre.valor).toBeCloseTo(s.restante, 6);
    const r = quantoPossoGastarNaSemana({ money: (v) => `R$ ${Math.round(v)}`, semana: s, diasSemLancar: null });
    expect(r.visual?.destaque).toBe(`R$ ${Math.round(s.restante)}`);
  });

  it("passou: o widget mostra quanto passou, não zero", () => {
    const f = montarFoco(outubro(14, { diaADia: { gastos: [gasto(900, 13)], contasLancadas: 0, pendentes: [] } }));
    if (f.livre.tipo === "semOrcamento") throw new Error();
    const w = numerosDoWidget({ livre: f.livre, agora: new Date(2026, 9, 14, 10), instante: new Date(), moeda: "BRL", tema: "padrao", modo: "auto", metas: [] });
    expect(w.livre.rotulo).toBe("passou da semana");
    expect(w.livre.valor).toBe(Math.round(f.livre.semana.passou));
    expect(w.livre.valor).toBeGreaterThan(0);
  });
});

describe("conta nova que lançou o mês inteiro de uma vez", () => {
  it("sem lançamento antes da semana, o que chegou agora com data de antes conta como de antes", () => {
    const gastos = [gasto(900, 3, 14), gasto(200, 13)];
    const usava = semana(montarFoco(outubro(14, { diaADia: { gastos, contasLancadas: 0, pendentes: [], jaTinhaLancamento: true } })));
    const nova = semana(montarFoco(outubro(14, { diaADia: { gastos, contasLancadas: 0, pendentes: [], jaTinhaLancamento: false } })));
    expect(usava.chegouDepois).toBe(900);
    expect(nova.chegouDepois).toBe(0);
    expect(nova.gastoAntes).toBe(900);
    expect(nova.valor).toBeCloseTo(((2100 - 900) * 7) / 20, 6);
  });
});
