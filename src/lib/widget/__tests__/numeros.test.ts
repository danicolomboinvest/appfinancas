import { describe, expect, it } from "vitest";
import type { FocoLivre } from "@/lib/decisoes/foco";
import { semanaFixa } from "@/lib/decisoes/semana-fixa";
import { numerosDoWidget } from "@/lib/widget/numeros";
import { chaveBemFormada, chaveDoCabecalho, gerarChave, hashDaChave } from "@/lib/widget/token";

/** Uma quarta-feira (índice 2): faltam 5 dias até domingo, contando hoje. */
const QUARTA = new Date(2026, 9, 14, 10);

/**
 * A semana fixa (regra A, 13/10/2026) da quarta, 14 de outubro: abriu na segunda com R$ 840 e já
 * saíram R$ 190, cabem R$ 650 (R$ 130 por dia até domingo).
 */
const SEMANA = semanaFixa({ dia: 14, diasNoMes: 31, diasAteDomingo: 5, orcamento: 4000, contas: 0, guardar: null, renda: null, gastos: [{ valor: 1600, dia: 5, entrouNoDia: 5, importado: false }, { valor: 190, dia: 12, entrouNoDia: 12, importado: false }] });

function semana(extra: Partial<Exclude<FocoLivre, { tipo: "semOrcamento" }>> = {}): FocoLivre {
  return {
    tipo: "semana",
    valor: 650,
    porSemana: 650,
    semana: SEMANA,
    contas: { total: 0, fixas: 0, lancadas: 0, pendentes: 0, aPagar: 0 },
    guardar: null,
    renda: null,
    rendaFonte: null,
    restante: 2300,
    planejado: 4000,
    gastoNoOrcamento: 1700,
    gastoTotal: 1700,
    diasRestantes: 18,
    decorrido: 13 / 31,
    diasSemLancar: null,
    semGastoComData: false,
    porCategoria: [],
    planoVariavel: 2400,
    gastoVariavel: 780,
    gastoUnico: 0,
    ...extra,
  };
}

const base = { agora: QUARTA, instante: new Date("2026-10-14T13:00:00Z"), moeda: "BRL", tema: "padrao", modo: "auto" as const, metas: [] };

describe("números do widget", () => {
  it("para gastar nesta semana, por dia e a régua: os mesmos do Resumo (regra A)", () => {
    expect(SEMANA.valor).toBe(840);
    const n = numerosDoWidget({ ...base, livre: semana() });
    expect(n.livre.valor).toBe(650);
    expect(n.livre.rotulo).toBe("para gastar nesta semana");
    // 650 ÷ 5 dias (quarta a domingo)
    expect(n.livre.porDia).toBe(130);
    // Gastou menos que a semana: a próxima fica maior (2.210 que sobram ÷ 13 dias × 7).
    expect(n.livre.semana).toEqual({ valor: 840, gasto: 190, passou: 0, proxima: 1190 });
    expect(n.livre.rotuloPorDia).toBe("por dia até domingo");
    expect(n.livre.hoje).toBe(2);
  });

  it("fim do mês diz sobra ou falta, sempre com o valor positivo", () => {
    const sobra = numerosDoWidget({ ...base, livre: semana() });
    expect(sobra.fimDoMes.palavra).toBe("sobra");
    expect(sobra.fimDoMes.valor).toBeGreaterThan(0);
    expect(sobra.fimDoMes.rotulo).toBe("sobra no fim do mês");

    const falta = numerosDoWidget({ ...base, livre: semana({ gastoVariavel: 2000 }) });
    expect(falta.fimDoMes.palavra).toBe("falta");
    expect(falta.fimDoMes.valor).toBeGreaterThan(0);
    expect(falta.livre.ritmo).toBe("rapido");
  });

  it("nos primeiros dias do mês não inventa previsão", () => {
    const n = numerosDoWidget({ ...base, livre: semana({ decorrido: 0.05 }) });
    expect(n.fimDoMes.valor).toBeNull();
    expect(n.fimDoMes.palavra).toBeNull();
  });

  it("sem orçamento, o widget convida a montar o plano", () => {
    const n = numerosDoWidget({ ...base, livre: { tipo: "semOrcamento" } });
    expect(n.livre.valor).toBeNull();
    expect(n.livre.rotulo).toBe("monte o seu plano no app");
  });

  it("passou da semana mostra quanto passou (nunca só zero), e a meta vem em porcentagem inteira até 100", () => {
    // Mudou de propósito (regra A): antes o livre negativo virava R$ 0 e o widget não dizia nada.
    const passou = semanaFixa({ dia: 14, diasNoMes: 31, diasAteDomingo: 5, orcamento: 4000, contas: 0, guardar: null, renda: null, gastos: [{ valor: 1600, dia: 5, entrouNoDia: 5, importado: false }, { valor: 880, dia: 12, entrouNoDia: 12, importado: false }] });
    const n = numerosDoWidget({
      ...base,
      livre: semana({ valor: 0, semana: passou }),
      metas: [
        { id: "a", name: "Viagem Europa 2027", computedCurrentAmount: 1480, targetAmount: 20000 },
        { id: "b", name: "Reserva", computedCurrentAmount: 25000, targetAmount: 21000 },
      ],
    });
    expect(n.livre.valor).toBe(40);
    expect(n.livre.rotulo).toBe("passou da semana");
    expect(n.livre.porDia).toBe(0);
    expect(n.metas[0]).toMatchObject({ nome: "Viagem Europa 2027", pct: 7, alvo: 20000 });
    expect(n.metas[1].pct).toBe(100);
  });

  it("nenhuma frase com travessão", () => {
    const n = numerosDoWidget({ ...base, livre: semana() });
    expect(JSON.stringify(n)).not.toMatch(/[—–]/);
  });
});

describe("chave do widget", () => {
  it("gera no formato aceito e o hash não é a chave", () => {
    const c = gerarChave();
    expect(chaveBemFormada(c)).toBe(true);
    expect(hashDaChave(c)).toHaveLength(64);
    expect(hashDaChave(c)).not.toContain(c.slice(5));
  });

  it("só aceita Bearer com a chave bem formada", () => {
    const c = gerarChave();
    expect(chaveDoCabecalho(`Bearer ${c}`)).toBe(c);
    expect(chaveDoCabecalho(c)).toBeNull();
    expect(chaveDoCabecalho("Bearer qualquer-coisa")).toBeNull();
    expect(chaveDoCabecalho(null)).toBeNull();
  });
});
