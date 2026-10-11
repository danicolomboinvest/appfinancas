import { describe, expect, it } from "vitest";
import { hrefDoMes, lerMesEscolhido, mesAoLado, mesesDaFolha, periodoDaRota, rotuloDoPeriodo } from "../periodo";

const agora = new Date(2026, 9, 11, 10); // 11 de outubro de 2026

describe("seletor de mês da Visão geral", () => {
  it("lê o mês da URL; inválido ou no futuro volta para o mês de agora", () => {
    expect(lerMesEscolhido("2026-09", agora)).toEqual({ ano: 2026, mes: 9 });
    expect(lerMesEscolhido("2026-11", agora)).toEqual({ ano: 2026, mes: 10 });
    expect(lerMesEscolhido("abc", agora)).toEqual({ ano: 2026, mes: 10 });
    expect(lerMesEscolhido(undefined, agora)).toEqual({ ano: 2026, mes: 10 });
  });

  it("os nomes do protótipo", () => {
    expect(rotuloDoPeriodo({ ano: 2026, mes: 10 }, agora)).toEqual({ nome: "Esse mês", sub: "1 a 11 out" });
    expect(rotuloDoPeriodo({ ano: 2026, mes: 9 }, agora)).toEqual({ nome: "Mês passado", sub: "set 2026" });
    expect(rotuloDoPeriodo({ ano: 2026, mes: 3 }, agora)).toEqual({ nome: "Março", sub: "2026" });
  });

  it("as setas param no mês de agora e no limite da folha", () => {
    expect(mesAoLado({ ano: 2026, mes: 10 }, 1, agora)).toBeNull();
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
