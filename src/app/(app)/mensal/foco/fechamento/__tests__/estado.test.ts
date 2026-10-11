import { describe, expect, it } from "vitest";
import { estadoDoFechamento, proximoEstado, textosDoFechamento } from "../estado";

const em = (dia: number) => new Date(Date.UTC(2026, 9, dia, 15));

describe("estados do fechamento do mês (seção 3.12, tabela FechamentoDoMes)", () => {
  it("sem linha é não fechado; a linha diz fechado ou reaberto com a data certa", () => {
    expect(estadoDoFechamento(null)).toEqual({ estado: "nao_fechado", em: null });
    expect(estadoDoFechamento({ estado: "fechado", fechadoEm: em(7), reabertoEm: null })).toEqual({ estado: "fechado", em: em(7) });
    expect(estadoDoFechamento({ estado: "reaberto", fechadoEm: em(7), reabertoEm: em(9) })).toEqual({ estado: "reaberto", em: em(9) });
    expect(estadoDoFechamento({ estado: "qualquer", fechadoEm: null, reabertoEm: null }).estado).toBe("nao_fechado");
  });

  it("não fechado → fechado → reaberto → fechado; nada de reabrir o que nunca fechou", () => {
    expect(proximoEstado("nao_fechado", "fechar")).toBe("fechado");
    expect(proximoEstado("fechado", "reabrir")).toBe("reaberto");
    expect(proximoEstado("reaberto", "fechar")).toBe("fechado");
    expect(proximoEstado("nao_fechado", "reabrir")).toBeNull();
    expect(proximoEstado("reaberto", "reabrir")).toBeNull();
    expect(proximoEstado("fechado", "fechar")).toBeNull();
  });

  it("'aberto' só aparece no reaberto; o fluxo de fechar nunca diz aberto", () => {
    for (const estado of ["nao_fechado", "fechado"] as const) {
      const t = textosDoFechamento(estado, 9, em(8));
      expect(Object.values(t).join(" ")).not.toMatch(/aberto/i);
    }
    expect(textosDoFechamento("reaberto", 9, null).titulo).toBe("Setembro aberto");
    expect(textosDoFechamento("fechado", 9, em(7))).toMatchObject({ titulo: "Setembro fechado", linha: "Setembro fechado. Ver resumo", detalhe: "Fechado em 7 de outubro.", botao: "Reabrir setembro" });
    expect(textosDoFechamento("nao_fechado", 9, null)).toMatchObject({ titulo: "Fechar setembro", botao: "Começar" });
  });
});
