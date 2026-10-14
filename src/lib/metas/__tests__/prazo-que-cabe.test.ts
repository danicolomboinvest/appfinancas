import { describe, expect, it } from "vitest";
import { porMesDaNovaMeta } from "../projecao";
import { limiteDasMetas, motivoDoAperto, prazoApertado, prazoQueCabe } from "../prazo-que-cabe";

const hoje = new Date(2026, 9, 14, 12); // 14/out/2026

describe("limiteDasMetas: quanto cabe guardar por mês nas metas", () => {
  it("o quanto guardar do plano do mês vale quando passa de 20% da renda", () => {
    expect(limiteDasMetas({ planoGuardar: 1500, planoRenda: 6000, rendaMedia: 5970 })).toEqual({ porMes: 1500, renda: 6000, fonte: "plano" });
  });

  it("um quanto guardar baixo no plano não aperta: vale 20% da renda", () => {
    // A Ana local: plano guarda R$ 400 com renda de R$ 7.700. A Europa de R$ 1.340 por mês cabe.
    const l = limiteDasMetas({ planoGuardar: 400, planoRenda: 7700 })!;
    expect(l).toEqual({ porMes: 1500, renda: 7700, fonte: "renda" });
    expect(prazoApertado(1340, l)).toBe(false);
  });

  it("sem renda, o quanto guardar do plano", () => {
    expect(limiteDasMetas({ planoGuardar: 800, aporteMedio: 300 })).toEqual({ porMes: 800, renda: null, fonte: "plano" });
  });

  it("sem plano, 20% da renda média de 12 meses, para baixo de 50 em 50", () => {
    // R$ 5.970 x 20% = R$ 1.194, vira R$ 1.150.
    expect(limiteDasMetas({ rendaMedia: 5970 })).toEqual({ porMes: 1150, renda: 5970, fonte: "renda" });
  });

  it("a renda digitada no plano vence a média", () => {
    expect(limiteDasMetas({ planoRenda: 10000, rendaMedia: 5970 })?.porMes).toBe(2000);
  });

  it("sem renda, o que ela guarda em média", () => {
    expect(limiteDasMetas({ aporteMedio: 437 })).toEqual({ porMes: 400, renda: null, fonte: "aportes" });
  });

  it("sem renda e sem aportes, não há limite (nada aparece)", () => {
    expect(limiteDasMetas({})).toBeNull();
    expect(limiteDasMetas({ planoGuardar: 0, planoRenda: 0, rendaMedia: null, aporteMedio: 0 })).toBeNull();
    expect(prazoApertado(47810, null)).toBe(false);
  });
});

describe("prazoApertado e o motivo", () => {
  const limite = limiteDasMetas({ rendaMedia: 5970 })!;

  it("a Casa de R$ 2.000.000 para out/2029 pede mais que a renda", () => {
    const porMes = porMesDaNovaMeta(2_000_000, new Date(2029, 9, 1, 12), hoje);
    expect(porMes).toBeGreaterThan(40_000);
    expect(prazoApertado(porMes, limite)).toBe(true);
    expect(motivoDoAperto(porMes, limite)).toBe("mais que a sua renda");
  });

  it("abaixo do limite não acende", () => {
    expect(prazoApertado(1150, limite)).toBe(false);
    expect(prazoApertado(900, limite)).toBe(false);
  });

  it("acima do limite e abaixo da renda fala dos 20%", () => {
    expect(prazoApertado(3000, limite)).toBe(true);
    expect(motivoDoAperto(3000, limite)).toBe("mais que 20% da sua renda");
    expect(motivoDoAperto(900, { porMes: 500, renda: 6000, fonte: "plano" })).toBe("mais do que o seu plano guarda");
    expect(motivoDoAperto(900, { porMes: 500, renda: null, fonte: "aportes" })).toBe("mais do que você costuma guardar");
  });
});

describe("prazoQueCabe", () => {
  it("sem rendimento: R$ 12.000 a R$ 1.000 por mês chega em 12 meses", () => {
    const s = prazoQueCabe({ alvo: 12_000, guardado: 0, porMes: 1000, taxaAnual: 0, hoje });
    expect(s).toEqual({ meses: 12, ano: 2027, mes: 10, texto: "out/2027" });
  });

  it("sem rendimento, o que já tem conta", () => {
    expect(prazoQueCabe({ alvo: 12_000, guardado: 6000, porMes: 1000, taxaAnual: 0, hoje })?.meses).toBe(6);
  });

  it("com rendimento chega antes", () => {
    const sem = prazoQueCabe({ alvo: 100_000, guardado: 0, porMes: 1000, taxaAnual: 0, hoje })!;
    const com = prazoQueCabe({ alvo: 100_000, guardado: 0, porMes: 1000, taxaAnual: 0.1, hoje })!;
    expect(sem.meses).toBe(100);
    expect(com.meses).toBeLessThan(sem.meses);
  });

  it("o prazo sugerido é o primeiro em que a meta pede o valor escolhido ou menos (a conta do servidor)", () => {
    for (const [alvo, porMes, taxa] of [
      [2_000_000, 1150, 0.1],
      [80_000, 1000, 0.1],
      [30_000, 700, 0.06],
      [12_000, 1000, 0],
    ] as const) {
      const s = prazoQueCabe({ alvo, guardado: 0, porMes, taxaAnual: taxa, hoje })!;
      const no = porMesDaNovaMeta(alvo, new Date(s.ano, s.mes - 1, 1, 12), hoje, taxa);
      const antes = porMesDaNovaMeta(alvo, new Date(s.ano, s.mes - 2, 1, 12), hoje, taxa);
      expect(no).toBeLessThanOrEqual(porMes);
      expect(antes).toBeGreaterThan(porMes);
    }
  });

  it("a Casa de R$ 2.000.000 com R$ 1.150 por mês e 10% ao ano chega nos anos 2050", () => {
    const s = prazoQueCabe({ alvo: 2_000_000, guardado: 0, porMes: 1150, taxaAnual: 0.1, hoje })!;
    expect(s.ano).toBeGreaterThanOrEqual(2050);
    expect(s.ano).toBeLessThanOrEqual(2056);
  });

  it("não sugere depois de 2080 nem sem valor por mês", () => {
    expect(prazoQueCabe({ alvo: 2_000_000, guardado: 0, porMes: 100, taxaAnual: 0, hoje })).toBeNull();
    expect(prazoQueCabe({ alvo: 10_000, guardado: 0, porMes: 0, taxaAnual: 0.1, hoje })).toBeNull();
    expect(prazoQueCabe({ alvo: 10_000, guardado: 10_000, porMes: 500, taxaAnual: 0.1, hoje })).toBeNull();
  });
});
