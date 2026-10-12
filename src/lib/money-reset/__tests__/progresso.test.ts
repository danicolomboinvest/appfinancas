import { describe, expect, it } from "vitest";
import { abriuEm, acheiPorMes, estadoDoReset, feitoHoje, marcosFeitos } from "../progresso";
import { MARCOS, MARCO_DO_DIA_ANTIGO, PASSOS_DO_SONHO, MOTIVOS_PRONTOS, REGRAS_DO_CARTAO, DICAS_DA_SEMANA, SEMANAS, naVoz, vocabularioDaVoz } from "../missoes";
import { GUIAS } from "../guias";
import { PROFILE_THEMES } from "@/lib/profiles/themes";
import { vozDoTema } from "@/lib/profiles/voice";

const t = (s: string) => new Date(s);
const nada = new Map<number, Date>();

describe("progresso do Money Reset (A+B)", () => {
  it("sem nada feito, a missão 1 já abre no dia da compra (o Dia 0 saiu)", () => {
    const e = estadoDoReset(nada);
    expect(e).toMatchObject({ fase: "andamento", atual: 1, feitos: 0, semana: 1 });
    expect(e.status[1]).toBe("agora");
    expect(e.status[2]).toBe("fechado");
  });

  it("terminou uma, a próxima abre na hora (sem esperar o dia virar)", () => {
    const feitos = new Map([[1, t("2026-10-12T13:00:00Z")]]);
    const e = estadoDoReset(feitos);
    expect(e).toMatchObject({ atual: 2, feitos: 1 });
    expect(e.status[1]).toBe("feito");
    expect(e.status[2]).toBe("agora");
  });

  it("a semana em que ela está abre; as seguintes ficam na névoa", () => {
    const sete = new Map(MARCOS.filter((m) => m.n <= 7).map((m) => [m.n, t("2026-10-12T13:00:00Z")]));
    expect(estadoDoReset(sete)).toMatchObject({ atual: 8, semana: 2 });
    const quatorze = new Map(MARCOS.filter((m) => m.n <= 14).map((m) => [m.n, t("2026-10-12T13:00:00Z")]));
    expect(estadoDoReset(quatorze)).toMatchObject({ atual: 15, semana: 3 });
  });

  it("as 21 feitas: concluído", () => {
    const feitos = new Map(MARCOS.map((m) => [m.n, t("2026-10-12T13:00:00Z")]));
    expect(estadoDoReset(feitos)).toMatchObject({ fase: "concluido", atual: null, feitos: 21 });
  });

  it("o marco conta o que ela fez desde que o anterior terminou", () => {
    const feitos = new Map([[1, t("2026-10-12T13:00:00Z")], [2, t("2026-10-12T14:00:00Z")]]);
    expect(abriuEm(1, feitos).getTime()).toBe(0);
    expect(abriuEm(3, feitos).toISOString()).toBe("2026-10-12T14:00:00.000Z");
  });

  it("feito hoje é pelo dia de Brasília (23h de Brasília ainda é hoje)", () => {
    expect(feitoHoje(t("2026-10-13T01:30:00Z"), t("2026-10-12T15:00:00Z"))).toBe(true);
    expect(feitoHoje(t("2026-10-12T02:00:00Z"), t("2026-10-12T15:00:00Z"))).toBe(false);
    expect(feitoHoje(undefined, t("2026-10-12T15:00:00Z"))).toBe(false);
  });
});

describe("quem já estava no meio não perde nada", () => {
  const dia = (n: number, quando = "2026-10-08T12:00:00Z") => [n, t(quando)] as [number, Date];

  it("a tabela da proposta: dia antigo → marco novo", () => {
    expect(MARCO_DO_DIA_ANTIGO).toEqual({
      1: 1, 3: 1, 2: 2, 4: 3, 5: 4, 6: 5, 16: 6, 7: 7,
      10: 8, 11: 9, 9: 10, 8: 11, 12: 12, 13: 14,
      14: 15, 15: 16, 17: 17, 18: 18, 19: 19, 20: 20, 21: 21,
    });
    // A 13 (dívidas) é nova: nenhum dia antigo vira ela.
    expect(Object.values(MARCO_DO_DIA_ANTIGO)).not.toContain(13);
  });

  it("quem estava no dia 2 ou 3 (dias 1 e 2 feitos) entra com os marcos 1 e 2 feitos e o 3 aberto", () => {
    const feitos = marcosFeitos({ marcos: nada, diasAntigos: new Map([dia(1), dia(2)]) });
    const e = estadoDoReset(feitos);
    expect([...feitos.keys()].sort()).toEqual([1, 2]);
    expect(e).toMatchObject({ atual: 3, feitos: 2 });
  });

  it("quem só fez o Dia 0 cai no marco 1", () => {
    expect(estadoDoReset(marcosFeitos({ marcos: nada, diasAntigos: nada }))).toMatchObject({ atual: 1, feitos: 0 });
  });

  it("o dia 3 antigo (o retrato) entra no marco 1, valendo a data mais antiga", () => {
    const feitos = marcosFeitos({ marcos: nada, diasAntigos: new Map([dia(1, "2026-10-07T12:00:00Z"), dia(3, "2026-10-09T12:00:00Z")]) });
    expect(feitos.get(1)?.toISOString()).toBe("2026-10-07T12:00:00.000Z");
    expect(feitos.size).toBe(1);
  });

  it("quem tinha os 13 primeiros dias volta para a voz (era o dia 16), depois a missão nova das dívidas, e segue na 15", () => {
    const antigos = new Map(Array.from({ length: 13 }, (_, i) => dia(i + 1)));
    const feitos = marcosFeitos({ marcos: nada, diasAntigos: antigos });
    expect(estadoDoReset(feitos)).toMatchObject({ atual: 6, feitos: 12 });
    feitos.set(6, t("2026-10-12T11:00:00Z"));
    expect(estadoDoReset(feitos)).toMatchObject({ atual: 13 });
    feitos.set(13, t("2026-10-12T12:00:00Z"));
    expect(estadoDoReset(feitos)).toMatchObject({ atual: 15, feitos: 14 });
  });

  it("o registro novo e o antigo do mesmo marco somam um só", () => {
    const feitos = marcosFeitos({ marcos: new Map([[1, t("2026-10-12T12:00:00Z")]]), diasAntigos: new Map([dia(1)]) });
    expect(feitos.size).toBe(1);
    expect(estadoDoReset(feitos).feitos).toBe(1);
  });

  it("número fora de 1 a 21 não vira marco", () => {
    const feitos = marcosFeitos({ marcos: new Map([[0, t("2026-10-12T12:00:00Z")], [22, t("2026-10-12T12:00:00Z")]]), diasAntigos: new Map([dia(99)]) });
    expect(feitos.size).toBe(0);
  });
});

describe("o placar Achei R$ X por mês", () => {
  it("só conta cortar e metade, por mês, mais o que ela disse que baixou na negociação", () => {
    const v = acheiPorMes({
      raiox: [
        { tipo: "raiox_cancelar", valorAnual: 478.8 },
        { tipo: "raiox_metade", valorAnual: 1116 },
        { tipo: "raiox_manter", valorAnual: 0 },
      ],
      negociado: 35,
    });
    expect(v).toBeCloseTo(478.8 / 12 + 1116 / 12 + 35, 6);
  });

  it("sem decisão nenhuma é zero, nunca um número inventado", () => {
    expect(acheiPorMes({ raiox: [], negociado: null })).toBe(0);
    expect(acheiPorMes({ raiox: [{ tipo: "raiox_manter", valorAnual: 500 }], negociado: -10 })).toBe(0);
  });
});

describe("as 21 missões", () => {
  it("são 21, 7 por semana, em ordem, e só a 13 é nova", () => {
    expect(MARCOS.map((m) => m.n)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    for (const s of [1, 2, 3]) expect(MARCOS.filter((m) => m.semana === s)).toHaveLength(7);
    for (const m of MARCOS) expect(Math.ceil(m.n / 7), `marco ${m.n}`).toBe(m.semana);
    expect(MARCOS.filter((m) => m.antigos.length === 0).map((m) => m.n)).toEqual([13]);
    expect(SEMANAS.map((s) => s.nome)).toEqual(["Enxergar", "Organizar", "Manter"]);
  });

  it("as que levam a outra tela têm guia", () => {
    for (const m of MARCOS.filter((x) => x.destino === "guia")) expect(GUIAS[m.n], `marco ${m.n}`).toBeDefined();
  });

  const textos = () =>
    MARCOS.flatMap((m) => [m.t, m.sub, m.btn, m.travou ?? "", ...m.passos, ...m.mudou])
      .concat(PASSOS_DO_SONHO.flatMap((p) => [p.t, p.q, p.ex]), [...MOTIVOS_PRONTOS], REGRAS_DO_CARTAO.flatMap((r) => [r.t, r.sub]), DICAS_DA_SEMANA.flatMap((d) => [d.t, d.sub]))
      .concat(Object.values(GUIAS).flatMap((ps) => ps.flatMap((p) => [p.txt, p.txtComputador ?? "", p.dica ?? ""])));

  it("sem gênero, sem travessão e sem emoji (as 4 correções da proposta)", () => {
    const tudo = textos().join(" | ");
    expect(tudo).not.toMatch(/\b(sincera|tranquila|organizada|sozinha|amiga|obrigada)\b/i);
    expect(tudo).not.toMatch(/—|–/);
    expect(tudo).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(tudo).toContain("Quero dormir em paz");
    expect(tudo).toContain("Sem mentir pra mim");
    expect(tudo).toContain("Responde de verdade.");
  });

  it("no Girly, Metas viram Sonhos e o orçamento vira combinado; nenhuma marca sobra em tema nenhum", () => {
    const g = vocabularioDaVoz(vozDoTema("girly"));
    for (const m of MARCOS) {
      const tudo = [m.t, m.sub, m.btn, ...m.passos, ...m.mudou, m.travou ?? ""].join(" | ");
      expect(naVoz(tudo, g), `marco ${m.n}`).not.toMatch(/\bmetas?\b|orçamento/i);
    }
    for (const tema of PROFILE_THEMES) expect(naVoz(textos().join(" | "), vocabularioDaVoz(vozDoTema(tema.key))), tema.key).not.toMatch(/\{|\}/);
  });

  it("o guia diz o nome do botão que está na tela, no tema da pessoa", () => {
    const g = vocabularioDaVoz(vozDoTema("girly"));
    expect(g.Registrar).toBe("Registrar");
    expect(g.GravarAudio).toBe("Gravar áudio");
    expect(g.Importar).toBe("Extrato");
    expect(vocabularioDaVoz(vozDoTema("padrao")).Importar).toBe("Importar extrato ou fatura");
  });
});
