import { describe, expect, it } from "vitest";
import { mesesAteOPrazo } from "../meses-do-prazo";
import { porMesDaNovaMeta } from "@/lib/metas/projecao";
import { computeGoalPlan } from "../goal";

describe("meses até o prazo: a fonte única do por mês das metas (16/10/2026)", () => {
  const OUT_2027 = new Date(2027, 9, 1, 12);

  it("R$ 5.000 até out/2027, criada em 16/10/2026: 12 meses e R$ 400, de manhã ou de noite", () => {
    for (const hora of [0, 9, 12, 19, 23]) {
      const hoje = new Date(2026, 9, 16, hora, 59);
      expect(mesesAteOPrazo(OUT_2027, hoje)).toBe(12);
      expect(porMesDaNovaMeta(5000, OUT_2027, hoje)).toBe(400);
    }
  });

  it("o dia do mês de hoje não muda a conta (dia 1 e dia 31)", () => {
    expect(mesesAteOPrazo(OUT_2027, new Date(2026, 9, 1, 0))).toBe(12);
    expect(mesesAteOPrazo(OUT_2027, new Date(2026, 9, 31, 23))).toBe(12);
  });

  it("prazo de data (não dia 1): dias inteiros, sem a hora; prazo vencido é zero", () => {
    expect(mesesAteOPrazo(new Date(2026, 11, 31, 12), new Date(2026, 9, 1))).toBe(3);
    expect(mesesAteOPrazo(new Date(2027, 8, 30), new Date(2026, 8, 30, 0))).toBe(12);
    expect(mesesAteOPrazo(new Date(2027, 8, 30), new Date(2026, 8, 30, 23))).toBe(12);
    expect(mesesAteOPrazo(new Date(2026, 5, 1, 12), new Date(2026, 9, 16))).toBe(0);
  });

  it("o fuso do servidor (o prazo gravado ao meio-dia UTC) dá o mesmo mês", () => {
    const gravado = new Date(Date.UTC(2027, 9, 1, 15));
    expect(mesesAteOPrazo(gravado, new Date(2026, 9, 16, 21))).toBe(12);
  });

  it("o motor das metas usa a mesma conta", () => {
    expect(computeGoalPlan({ targetAmount: 5000, currentAmount: 0, targetDate: OUT_2027, annualRate: 0.1, now: new Date(2026, 9, 16, 19) }).monthsRemaining).toBe(12);
  });
});

describe("mesmo número em todas as telas: o por mês da meta", () => {
  it("folha, o que a meta grava, o detalhe e o Como vou juntar? dão o mesmo número a qualquer hora", async () => {
    const { planoDaMeta: planoDaMetaTela } = await import("@/lib/metas/projecao");
    const { planoDaMeta: motor } = await import("../plano-da-meta");
    for (const [alvo, ano, mes] of [[5000, 2027, 9], [12000, 2028, 2], [800, 2026, 11], [35000, 2028, 5]] as const) {
      const prazo = new Date(ano, mes, 1, 12);
      // A folha: hoje à meia-noite (como o navegador monta).
      const folha = porMesDaNovaMeta(alvo, prazo, new Date(2026, 9, 16));
      for (const hora of [0, 8, 12, 19, 23]) {
        const hoje = new Date(2026, 9, 16, hora, 30);
        const grava = porMesDaNovaMeta(alvo, prazo, hoje);
        const detalhe = planoDaMetaTela({ alvo, guardado: 0, prazo, taxaAnual: 0.1, inicio: hoje, porMesCombinado: grava, aportes: new Map(), hoje }).porMesNecessario;
        const plano = motor({ hoje, perfil: { tipo: "PESSOAL", moeda: "BRL" }, meta: { alvo, guardado: 0, prazo }, rendaMedia: null, gastoTipico: null, aportesCombinados: 0, lancamentos: [], assinaturas: [] });
        expect([grava, detalhe, plano.mostra ? plano.pede : null], `${alvo} até ${mes + 1}/${ano}, ${hora}h`).toEqual([folha, folha, folha]);
      }
    }
  });

  it("nenhuma conta de meses de meta divide milissegundos (a fonte é meses-do-prazo.ts)", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const raiz = join(__dirname, "..", "..", "..");
    const pastas = ["lib/planning", "lib/metas", "app/(app)/planejamento/metas"].map((p) => join(raiz, p));
    const achados: string[] = [];
    const varre = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (statSync(c).isDirectory()) {
          if (n !== "__tests__") varre(c);
        } else if (/\.tsx?$/.test(n) && !c.endsWith("meses-do-prazo.ts") && /30\.4375|30\.44/.test(readFileSync(c, "utf8"))) achados.push(c);
      }
    };
    pastas.forEach(varre);
    expect(achados).toEqual([]);
  });
});
