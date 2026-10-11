import { describe, expect, it } from "vitest";
import { estadoDoFechamento, textosDoFechamento } from "../estado";

const d = (tipo: string, dia: number) => ({ tipo, createdAt: new Date(Date.UTC(2026, 9, dia, 15)) });

describe("estados do fechamento do mês (rodada 42)", () => {
  it("não fechado, fechado, reaberto e fechado de novo", () => {
    expect(estadoDoFechamento([]).estado).toBe("nao_fechado");
    expect(estadoDoFechamento([d("fechamento", 8)])).toEqual({ estado: "fechado", em: new Date(Date.UTC(2026, 9, 8, 15)) });
    expect(estadoDoFechamento([d("fechamento", 8), d("fechamento_reaberto", 9)]).estado).toBe("reaberto");
    expect(estadoDoFechamento([d("fechamento_reaberto", 9), d("fechamento", 10)]).estado).toBe("fechado");
    expect(estadoDoFechamento([d("ritual", 9)]).estado).toBe("nao_fechado");
  });

  it("'aberto' só aparece no reaberto; o fluxo de fechar nunca diz aberto", () => {
    for (const estado of ["nao_fechado", "fechado"] as const) {
      const t = textosDoFechamento(estado, 9, new Date(Date.UTC(2026, 9, 8, 15)));
      expect(Object.values(t).join(" ")).not.toMatch(/aberto/i);
    }
    expect(textosDoFechamento("reaberto", 9, null).titulo).toBe("Setembro aberto");
    expect(textosDoFechamento("fechado", 9, new Date(Date.UTC(2026, 9, 8, 15)))).toMatchObject({ titulo: "Setembro fechado", linha: "Setembro fechado. Ver resumo", detalhe: "Fechado em 08/10.", botao: "Reabrir setembro" });
    expect(textosDoFechamento("nao_fechado", 9, null)).toMatchObject({ titulo: "Fechar setembro", botao: "Começar" });
  });
});
