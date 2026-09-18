import { describe, expect, it } from "vitest";
import { planAllocationLines, type AllocationInput } from "../contribution-link";
import { goalProgress } from "@/lib/planning/goal-progress";

/**
 * Simulação de um MÊS INTEIRO de uso, rodada por rodada, como uma pessoa faz de verdade:
 * aporta um pedaço, diz onde foi, aporta outro, esquece de distribuir, distribui pela metade,
 * volta no fim do mês e fecha. O que se testa aqui é a costura: o que sobra pra distribuir, o
 * que cada ativo recebeu, e se as metas andaram sem contar o mesmo dinheiro duas vezes.
 */

type Aporte = { entryId: string; amount: number; goalId: string | null };
type Ativo = { id: string; goalId: string | null; valor: number };

/** Um mês de verdade: os lançamentos de aporte, os ativos e as alocações já feitas. */
class Mes {
  aportes: Aporte[] = [];
  ativos = new Map<string, Ativo>();
  alocacoes: { entryId: string; assetId: string; amount: number }[] = [];

  ativo(id: string, goalId: string | null = null, valor = 0) {
    this.ativos.set(id, { id, goalId, valor });
    return this;
  }
  aportar(entryId: string, amount: number, goalId: string | null = null) {
    this.aportes.push({ entryId, amount, goalId });
    return this;
  }
  /** O que o card mostra: quanto de cada aporte ainda não tem destino. */
  pendentes() {
    return this.aportes
      .map((a) => {
        const alocado = this.alocacoes.filter((x) => x.entryId === a.entryId).reduce((s, x) => s + x.amount, 0);
        return { entryId: a.entryId, pending: Math.max(0, Math.round((a.amount - alocado) * 100) / 100) };
      })
      .filter((p) => p.pending > 0.009);
  }
  get aDistribuir() {
    return Math.round(this.pendentes().reduce((s, p) => s + p.pending, 0) * 100) / 100;
  }
  /** "É isso, atualizar carteira": aplica como o servidor aplica. */
  distribuir(entrada: AllocationInput[]) {
    const pedido = entrada.reduce((s, a) => s + a.amount, 0);
    if (pedido > this.aDistribuir + 0.01) return { ok: false as const, error: "passou do aportado" };
    const linhas = planAllocationLines(this.pendentes(), entrada);
    this.alocacoes.push(...linhas);
    for (const a of entrada) this.ativos.get(a.assetId)!.valor += a.amount;
    return { ok: true as const, linhas };
  }
  /** Progresso da meta pela regra DE VERDADE do app (goalProgress), não uma cópia dela. */
  meta(goalId: string) {
    const emAtivos = [...this.ativos.values()].filter((a) => a.goalId === goalId).reduce((s, a) => s + a.valor, 0);
    const aportesDaMeta = this.aportes
      .filter((a) => a.goalId === goalId)
      .map((a) => ({
        amount: a.amount,
        allocations: this.alocacoes
          .filter((x) => x.entryId === a.entryId)
          .map((x) => ({ amount: x.amount, assetGoalId: this.ativos.get(x.assetId)?.goalId ?? null })),
      }));
    return goalProgress(goalId, emAtivos, aportesDaMeta);
  }
  /** Invariante do app: o que o fluxo diz que foi aportado = distribuído + esperando destino. */
  fecha() {
    const totalAportado = this.aportes.reduce((s, a) => s + a.amount, 0);
    const distribuido = this.alocacoes.reduce((s, a) => s + a.amount, 0);
    return Math.abs(totalAportado - (distribuido + this.aDistribuir)) < 0.011;
  }
}

describe("um mês inteiro de aportes, rodada por rodada", () => {
  it("setembro típico: três aportes, distribuídos em momentos diferentes", () => {
    const m = new Mes().ativo("tesouro", "viagem").ativo("itub4").ativo("mxrf11");

    // Dia 5: aporte do salário, guardado pra viagem.
    m.aportar("e1", 1000, "viagem");
    expect(m.aDistribuir).toBe(1000);
    expect(m.meta("viagem")).toBe(1000); // ainda não virou ativo, mas o dinheiro existe

    // Diz que foi pro Tesouro da viagem.
    expect(m.distribuir([{ assetId: "tesouro", amount: 1000 }]).ok).toBe(true);
    expect(m.aDistribuir).toBe(0);
    expect(m.meta("viagem")).toBe(1000); // NÃO virou 2000
    expect(m.fecha()).toBe(true);

    // Dia 15: segundo aporte, sem meta. Distribui só metade.
    m.aportar("e2", 800);
    expect(m.aDistribuir).toBe(800);
    m.distribuir([{ assetId: "itub4", amount: 400 }]);
    expect(m.aDistribuir).toBe(400);
    expect(m.ativos.get("itub4")!.valor).toBe(400);

    // Dia 28: terceiro aporte. Agora sobram os 400 + 600.
    m.aportar("e3", 600);
    expect(m.aDistribuir).toBe(1000);

    // Fecha o mês distribuindo tudo de uma vez em dois ativos.
    const r = m.distribuir([
      { assetId: "mxrf11", amount: 700 },
      { assetId: "itub4", amount: 300 },
    ]);
    expect(r.ok).toBe(true);
    expect(m.aDistribuir).toBe(0);
    expect(m.ativos.get("itub4")!.valor).toBe(700);
    expect(m.ativos.get("mxrf11")!.valor).toBe(700);
    expect(m.ativos.get("tesouro")!.valor).toBe(1000);
    expect(m.fecha()).toBe(true);
  });

  it("um ativo recebendo pedaços de DOIS aportes vira duas linhas, e a conta fecha", () => {
    const m = new Mes().ativo("cdb");
    m.aportar("e1", 300).aportar("e2", 700);
    const r = m.distribuir([{ assetId: "cdb", amount: 1000 }]);
    expect(r.ok).toBe(true);
    expect(r.ok && r.linhas).toEqual([
      { entryId: "e1", assetId: "cdb", amount: 300 },
      { entryId: "e2", assetId: "cdb", amount: 700 },
    ]);
    expect(m.ativos.get("cdb")!.valor).toBe(1000);
    expect(m.fecha()).toBe(true);
  });

  it("nunca deixa distribuir mais do que foi aportado, mesmo em várias rodadas", () => {
    const m = new Mes().ativo("a").ativo("b");
    m.aportar("e1", 500);
    m.distribuir([{ assetId: "a", amount: 300 }]);
    expect(m.distribuir([{ assetId: "b", amount: 300 }]).ok).toBe(false);
    expect(m.distribuir([{ assetId: "b", amount: 200 }]).ok).toBe(true);
    expect(m.aDistribuir).toBe(0);
    expect(m.distribuir([{ assetId: "b", amount: 50 }]).ok).toBe(false);
    expect(m.fecha()).toBe(true);
  });

  it("centavos: aporte quebrado dividido em três ativos não perde nem inventa um centavo", () => {
    const m = new Mes().ativo("a").ativo("b").ativo("c");
    m.aportar("e1", 5728.57);
    const r = m.distribuir([
      { assetId: "a", amount: 1909.52 },
      { assetId: "b", amount: 1909.52 },
      { assetId: "c", amount: 1909.53 },
    ]);
    expect(r.ok).toBe(true);
    expect(m.aDistribuir).toBe(0);
    expect(m.alocacoes.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(5728.57, 2);
    expect(m.fecha()).toBe(true);
  });

  it("dinheiro da meta que foi pra ativo de outra meta continua contando na meta de origem", () => {
    const m = new Mes().ativo("cdbViagem", "viagem").ativo("cdbCasa", "casa");
    m.aportar("e1", 1000, "viagem");
    m.distribuir([{ assetId: "cdbCasa", amount: 1000 }]);
    expect(m.meta("viagem")).toBe(1000); // não sumiu
    expect(m.meta("casa")).toBe(1000); // o ativo da casa vale 1000
    expect(m.fecha()).toBe(true);
  });

  it("aporte dividido entre o ativo DA meta e um ativo de fora conta certo dos dois lados", () => {
    const m = new Mes().ativo("cdbViagem", "viagem").ativo("itub4");
    m.aportar("e1", 1000, "viagem");
    m.distribuir([
      { assetId: "cdbViagem", amount: 600 },
      { assetId: "itub4", amount: 400 },
    ]);
    // 600 estão no ativo da meta (contados uma vez) + 400 que foram pra fora, mas eram da meta.
    expect(m.meta("viagem")).toBe(1000);
    expect(m.fecha()).toBe(true);
  });

  it("seis meses seguidos aportando e distribuindo: a meta cresce linearmente, sem dobrar", () => {
    const m = new Mes().ativo("tesouro", "viagem");
    for (let i = 1; i <= 6; i += 1) {
      m.aportar(`e${i}`, 500, "viagem");
      expect(m.distribuir([{ assetId: "tesouro", amount: 500 }]).ok).toBe(true);
      expect(m.meta("viagem")).toBe(500 * i);
      expect(m.aDistribuir).toBe(0);
      expect(m.fecha()).toBe(true);
    }
    expect(m.ativos.get("tesouro")!.valor).toBe(3000);
  });

  it("mês em que a pessoa aporta e nunca distribui: nada se perde e a meta continua certa", () => {
    const m = new Mes().ativo("tesouro", "viagem");
    m.aportar("e1", 400, "viagem").aportar("e2", 400, "viagem").aportar("e3", 400, "viagem");
    expect(m.aDistribuir).toBe(1200);
    expect(m.meta("viagem")).toBe(1200);
    expect(m.ativos.get("tesouro")!.valor).toBe(0);
    expect(m.fecha()).toBe(true);
  });

  it("mesmo ativo aparecendo duas vezes na mesma rodada soma, não sobrescreve", () => {
    const m = new Mes().ativo("a");
    m.aportar("e1", 500);
    const r = m.distribuir([
      { assetId: "a", amount: 200 },
      { assetId: "a", amount: 300 },
    ]);
    expect(r.ok).toBe(true);
    expect(m.alocacoes.reduce((s, x) => s + x.amount, 0)).toBe(500);
    expect(m.ativos.get("a")!.valor).toBe(500);
    expect(m.aDistribuir).toBe(0);
    expect(m.fecha()).toBe(true);
  });

  it("aporte de um centavo: distribui e zera, sem sobrar migalha", () => {
    const m = new Mes().ativo("a");
    m.aportar("e1", 0.01);
    expect(m.aDistribuir).toBe(0.01);
    expect(m.distribuir([{ assetId: "a", amount: 0.01 }]).ok).toBe(true);
    expect(m.aDistribuir).toBe(0);
    expect(m.fecha()).toBe(true);
  });

  it("dez aportes quebrados no mês, distribuídos de uma vez: a soma bate no centavo", () => {
    const m = new Mes().ativo("a").ativo("b");
    let total = 0;
    for (let i = 1; i <= 10; i += 1) {
      const valor = Math.round((100 + i * 7.77) * 100) / 100;
      m.aportar(`e${i}`, valor);
      total = Math.round((total + valor) * 100) / 100;
    }
    expect(m.aDistribuir).toBe(total);
    const metade = Math.round((total / 2) * 100) / 100;
    const r = m.distribuir([
      { assetId: "a", amount: metade },
      { assetId: "b", amount: Math.round((total - metade) * 100) / 100 },
    ]);
    expect(r.ok).toBe(true);
    expect(m.aDistribuir).toBe(0);
    expect(m.alocacoes.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(total, 2);
    expect(Math.round((m.ativos.get("a")!.valor + m.ativos.get("b")!.valor) * 100) / 100).toBe(total);
    expect(m.fecha()).toBe(true);
  });

  it("aporte editado pra MENOS depois de distribuído não engole o aporte seguinte", () => {
    // O defeito que quase foi pra produção: "falta distribuir" era total − distribuído, e a
    // sobra de um lançamento corrigido pra menos abatia o dinheiro novo, em silêncio.
    const m = new Mes().ativo("a");
    m.aportar("e1", 1000);
    m.distribuir([{ assetId: "a", amount: 1000 }]);
    m.aportes[0].amount = 400; // a pessoa percebeu que lançou errado e corrigiu
    expect(m.aDistribuir).toBe(0);

    m.aportar("e2", 300); // aporte novo, de verdade
    expect(m.aDistribuir).toBe(300); // não pode ser 0 por causa da sobra do e1
    expect(m.distribuir([{ assetId: "a", amount: 300 }]).ok).toBe(true);
    expect(m.aDistribuir).toBe(0);
  });

  it("valor zero ou negativo no campo de um ativo é ignorado, não quebra a rodada", () => {
    const m = new Mes().ativo("a").ativo("b");
    m.aportar("e1", 500);
    const r = m.distribuir([
      { assetId: "a", amount: 0 },
      { assetId: "b", amount: 500 },
    ]);
    expect(r.ok).toBe(true);
    expect(r.ok && r.linhas).toEqual([{ entryId: "e1", assetId: "b", amount: 500 }]);
    expect(m.ativos.get("a")!.valor).toBe(0);
  });
});
