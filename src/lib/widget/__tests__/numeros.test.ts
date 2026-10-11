import { describe, expect, it } from "vitest";
import type { FocoLivre } from "@/lib/decisoes/foco";
import { numerosDoWidget } from "@/lib/widget/numeros";
import { chaveBemFormada, chaveDoCabecalho, gerarChave, hashDaChave } from "@/lib/widget/token";

/** Uma quarta-feira (índice 2): faltam 5 dias até domingo, contando hoje. */
const QUARTA = new Date(2026, 9, 14, 10);

function semana(extra: Partial<Exclude<FocoLivre, { tipo: "semOrcamento" }>> = {}): FocoLivre {
  return {
    tipo: "semana",
    valor: 648,
    porSemana: 648,
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
  it("livre até domingo, por dia e a régua: os mesmos do Resumo", () => {
    const n = numerosDoWidget({ ...base, livre: semana() });
    expect(n.livre.valor).toBe(648);
    expect(n.livre.rotulo).toBe("livre até domingo");
    // 648 ÷ 5 dias (quarta a domingo)
    expect(n.livre.porDia).toBe(130);
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

  it("livre negativo vira zero, e a meta vem em porcentagem inteira até 100", () => {
    const n = numerosDoWidget({
      ...base,
      livre: semana({ valor: -40 }),
      metas: [
        { id: "a", name: "Viagem Europa 2027", computedCurrentAmount: 1480, targetAmount: 20000 },
        { id: "b", name: "Reserva", computedCurrentAmount: 25000, targetAmount: 21000 },
      ],
    });
    expect(n.livre.valor).toBe(0);
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
