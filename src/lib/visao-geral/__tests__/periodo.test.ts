import { describe, expect, it } from "vitest";
import { hrefDoMes, lerMesEscolhido, mesAoLado, mesesDaFolha, periodoDaRota, rotuloDoPeriodo } from "../periodo";

const agora = new Date(2026, 9, 11, 10); // 11 de outubro de 2026

describe("seletor de mês da Visão geral", () => {
  it("lê o mês da URL; inválido ou além de 6 meses à frente volta para o mês de agora", () => {
    expect(lerMesEscolhido("2026-09", agora)).toEqual({ ano: 2026, mes: 9 });
    // Os próximos meses voltaram (14/10/2026): até 6 à frente, como previstos.
    expect(lerMesEscolhido("2026-11", agora)).toEqual({ ano: 2026, mes: 11 });
    expect(lerMesEscolhido("2027-04", agora)).toEqual({ ano: 2027, mes: 4 });
    expect(lerMesEscolhido("2027-05", agora)).toEqual({ ano: 2026, mes: 10 });
    expect(lerMesEscolhido("abc", agora)).toEqual({ ano: 2026, mes: 10 });
    expect(lerMesEscolhido(undefined, agora)).toEqual({ ano: 2026, mes: 10 });
  });

  it("os nomes do protótipo", () => {
    expect(rotuloDoPeriodo({ ano: 2026, mes: 10 }, agora)).toEqual({ nome: "Esse mês", sub: "1 a 11 out" });
    expect(rotuloDoPeriodo({ ano: 2026, mes: 9 }, agora)).toEqual({ nome: "Mês passado", sub: "set 2026" });
    expect(rotuloDoPeriodo({ ano: 2026, mes: 3 }, agora)).toEqual({ nome: "Março", sub: "2026" });
    expect(rotuloDoPeriodo({ ano: 2026, mes: 11 }, agora)).toEqual({ nome: "Mês que vem", sub: "previsto · nov" });
    expect(rotuloDoPeriodo({ ano: 2027, mes: 1 }, agora)).toEqual({ nome: "Janeiro", sub: "previsto · 2027" });
  });

  it("as setas vão até 6 meses à frente e param no limite da folha", () => {
    expect(mesAoLado({ ano: 2026, mes: 10 }, 1, agora)).toEqual({ ano: 2026, mes: 11 });
    expect(mesAoLado({ ano: 2027, mes: 3 }, 1, agora)).toEqual({ ano: 2027, mes: 4 });
    expect(mesAoLado({ ano: 2027, mes: 4 }, 1, agora)).toBeNull();
    expect(mesAoLado({ ano: 2026, mes: 10 }, -1, agora)).toEqual({ ano: 2026, mes: 9 });
    expect(mesAoLado({ ano: 2026, mes: 1 }, -1, agora)).toEqual({ ano: 2025, mes: 12 });
    const folha = mesesDaFolha(agora);
    expect(folha).toHaveLength(12);
    expect(mesAoLado(folha[11], -1, agora)).toBeNull();
  });

  it("cada aba guarda o mês do seu jeito, e o mês de agora não leva parâmetro", () => {
    const set = { ano: 2026, mes: 9 };
    expect(hrefDoMes("resumo", set, agora)).toBe("/mensal/foco?mes=2026-09");
    expect(hrefDoMes("orcamento", set, agora)).toBe("/orcamento/2026?mes=2026-09");
    expect(hrefDoMes("transacoes", set, agora)).toBe("/mensal/2026/9");
    expect(hrefDoMes("resumo", { ano: 2026, mes: 10 }, agora)).toBe("/mensal/foco");
  });

  it("lê a aba e o mês da rota", () => {
    expect(periodoDaRota("/mensal/foco", "2026-08", agora)).toEqual({ aba: "resumo", mes: { ano: 2026, mes: 8 } });
    expect(periodoDaRota("/mensal/2026/7", null, agora)).toEqual({ aba: "transacoes", mes: { ano: 2026, mes: 7 } });
    expect(periodoDaRota("/orcamento/2026", null, agora)).toEqual({ aba: "orcamento", mes: { ano: 2026, mes: 10 } });
    expect(periodoDaRota("/orcamento/2025", null, agora)).toEqual({ aba: "orcamento", mes: { ano: 2025, mes: 12 } });
    expect(periodoDaRota("/orcamento/contas", null, agora)).toBeNull();
  });
});

import { ehFuturo, hrefDoIntervalo, intervaloDoTipo, lerIntervalo, mesDeAgora, periodoCompletoDaRota, rotuloDoIntervalo, soMesesInteiros } from "../periodo";

describe("mês que começa no dia da pessoa (30/10/2026)", () => {
  const cinco = new Date(2026, 10, 5, 10); // 05/11/2026

  it("sem dia escolhido (nulo, 1 ou nada), tudo é igual ao de antes", () => {
    for (const dia of [undefined, null, 1]) {
      expect(mesDeAgora(cinco, dia)).toEqual({ ano: 2026, mes: 11 });
      expect(lerMesEscolhido(undefined, cinco, dia)).toEqual({ ano: 2026, mes: 11 });
      expect(rotuloDoPeriodo({ ano: 2026, mes: 11 }, cinco, dia)).toEqual({ nome: "Esse mês", sub: "1 a 5 nov" });
      expect(rotuloDoPeriodo({ ano: 2026, mes: 10 }, cinco, dia)).toEqual({ nome: "Mês passado", sub: "out 2026" });
      expect(hrefDoMes("resumo", { ano: 2026, mes: 11 }, cinco, dia)).toBe("/mensal/foco");
      expect(ehFuturo({ ano: 2026, mes: 12 }, cinco, dia)).toBe(true);
      expect(periodoDaRota("/orcamento/2026", null, cinco, dia)).toEqual({ aba: "orcamento", mes: { ano: 2026, mes: 11 } });
    }
  });

  it("dia 15: em 05/11 o mês de agora é outubro (15/10 a 14/11), e o seletor escreve o intervalo", () => {
    expect(mesDeAgora(cinco, 15)).toEqual({ ano: 2026, mes: 10 });
    expect(lerMesEscolhido(undefined, cinco, 15)).toEqual({ ano: 2026, mes: 10 });
    expect(rotuloDoPeriodo({ ano: 2026, mes: 10 }, cinco, 15)).toEqual({ nome: "Esse mês", sub: "15/10 a 05/11" });
    expect(rotuloDoPeriodo({ ano: 2026, mes: 10 }, new Date(2026, 9, 15), 15)).toEqual({ nome: "Esse mês", sub: "15/10" });
    expect(rotuloDoPeriodo({ ano: 2026, mes: 9 }, cinco, 15)).toEqual({ nome: "Mês passado", sub: "15/09 a 14/10" });
    expect(rotuloDoPeriodo({ ano: 2026, mes: 11 }, cinco, 15)).toEqual({ nome: "Mês que vem", sub: "previsto · 15/11 a 14/12" });
    expect(rotuloDoPeriodo({ ano: 2026, mes: 3 }, cinco, 15)).toEqual({ nome: "Março", sub: "15/03 a 14/04" });
    // Novembro ainda não chegou: é previsto, e o mês de agora não leva parâmetro.
    expect(ehFuturo({ ano: 2026, mes: 11 }, cinco, 15)).toBe(true);
    expect(ehFuturo({ ano: 2026, mes: 10 }, cinco, 15)).toBe(false);
    expect(hrefDoMes("resumo", { ano: 2026, mes: 10 }, cinco, 15)).toBe("/mensal/foco");
    expect(hrefDoMes("resumo", { ano: 2026, mes: 11 }, cinco, 15)).toBe("/mensal/foco?mes=2026-11");
    expect(periodoDaRota("/orcamento/2026", null, cinco, 15)).toEqual({ aba: "orcamento", mes: { ano: 2026, mes: 10 } });
    expect(periodoCompletoDaRota("/mensal/foco", new URLSearchParams(), cinco, 15)).toEqual({ aba: "resumo", mes: { ano: 2026, mes: 10 }, intervalo: null });
    expect(mesAoLado({ ano: 2027, mes: 3 }, 1, cinco, 15)).toEqual({ ano: 2027, mes: 4 });
    expect(mesAoLado({ ano: 2027, mes: 4 }, 1, cinco, 15)).toBeNull();
  });
});

describe("Ver o período: além do mês", () => {
  const agora = new Date(2026, 9, 11, 10);
  it("os atalhos da folha", () => {
    expect(intervaloDoTipo("7d", agora)).toEqual({ tipo: "7d", de: { ano: 2026, mes: 10, dia: 5 }, ate: { ano: 2026, mes: 10, dia: 11 } });
    expect(intervaloDoTipo("tri", agora).de).toEqual({ ano: 2026, mes: 10, dia: 1 });
    expect(intervaloDoTipo("tri-ant", agora)).toEqual({ tipo: "tri-ant", de: { ano: 2026, mes: 7, dia: 1 }, ate: { ano: 2026, mes: 9, dia: 30 } });
    expect(intervaloDoTipo("ano", agora).de).toEqual({ ano: 2026, mes: 1, dia: 1 });
  });
  it("os nomes, como no protótipo", () => {
    expect(rotuloDoIntervalo(intervaloDoTipo("7d", agora))).toEqual({ nome: "Últimos 7 dias", sub: "5 a 11 out" });
    expect(rotuloDoIntervalo(intervaloDoTipo("tri", agora))).toEqual({ nome: "Esse trimestre", sub: "out a dez" });
    expect(rotuloDoIntervalo(intervaloDoTipo("tri-ant", agora))).toEqual({ nome: "Trimestre passado", sub: "jul a set" });
    expect(rotuloDoIntervalo(intervaloDoTipo("ano", agora))).toEqual({ nome: "Esse ano", sub: "jan a out" });
    expect(rotuloDoIntervalo({ tipo: "custom", de: { ano: 2026, mes: 10, dia: 3 }, ate: { ano: 2026, mes: 10, dia: 9 } })).toEqual({ nome: "3 a 9 out", sub: "7 dias" });
  });
  it("personalizado: troca a ordem, vai até 6 meses à frente, recusa além disso", () => {
    expect(lerIntervalo({ de: "2026-10-09", ate: "2026-10-03" }, agora)).toEqual({ tipo: "custom", de: { ano: 2026, mes: 10, dia: 3 }, ate: { ano: 2026, mes: 10, dia: 9 } });
    expect(lerIntervalo({ de: "2026-10-09", ate: "2026-12-01" }, agora)?.ate).toEqual({ ano: 2026, mes: 12, dia: 1 });
    expect(lerIntervalo({ de: "2026-11-01", ate: "2026-11-05" }, agora)?.de).toEqual({ ano: 2026, mes: 11, dia: 1 });
    expect(lerIntervalo({ de: "2027-03-01", ate: "2027-09-05" }, agora)?.ate).toEqual({ ano: 2027, mes: 4, dia: 30 });
    expect(lerIntervalo({ de: "2027-05-01", ate: "2027-05-05" }, agora)).toBeNull();
    expect(lerIntervalo({ de: "lixo" }, agora)).toBeNull();
  });
  it("cada aba leva o período do seu jeito; o orçamento sabe se são meses inteiros", () => {
    const tri = intervaloDoTipo("tri-ant", agora);
    expect(hrefDoIntervalo("transacoes", tri)).toBe("/mensal/periodo?periodo=tri-ant");
    expect(hrefDoIntervalo("orcamento", tri)).toBe("/orcamento/2026?periodo=tri-ant");
    expect(hrefDoIntervalo("resumo", tri)).toBe("/mensal/foco?periodo=tri-ant");
    expect(soMesesInteiros(tri)).toBe(true);
    expect(soMesesInteiros(intervaloDoTipo("7d", agora))).toBe(false);
  });
});
