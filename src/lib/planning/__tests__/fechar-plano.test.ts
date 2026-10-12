import { describe, expect, it } from "vitest";
import { fecharExato } from "../fechar-plano";

const soma = (v: Record<string, number>) => Object.values(v).reduce((s, x) => s + x, 0);

describe("fecharExato (sugestões do Montar o plano fecham exato)", () => {
  it("a régua da aula com 18% guardado fecha no centavo do que há para dividir", () => {
    const renda = 7700;
    const resto = renda - Math.round(renda * 0.18);
    const base = { MORADIA: renda * 0.3, ALIMENTACAO: renda * 0.15, SAUDE: renda * 0.1, TRANSPORTE: renda * 0.08, EDUCACAO: renda * 0.05, LAZER: renda * 0.07, COMPRAS: renda * 0.07 };
    const r = fecharExato(resto, base, [], ["MORADIA", "EDUCACAO"]);
    expect(soma(r.val)).toBe(resto);
    for (const v of Object.values(r.val)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("guardando menos que a aula, a sugestão cresce até não sobrar nada solto", () => {
    const r = fecharExato(9000, { A: 3000, B: 1500, C: 1000 });
    expect(soma(r.val)).toBe(9000);
    expect(r.val.A).toBeGreaterThan(r.val.B);
  });

  it("o padrão dela: as fixas ficam, as variáveis encolhem e entram no aviso", () => {
    const r = fecharExato(5000, { MORADIA: 2500, LAZER: 2000, COMPRAS: 1500 }, ["MORADIA"], ["MORADIA"]);
    expect(r.val.MORADIA).toBe(2500);
    expect(soma(r.val)).toBe(5000);
    expect(r.abaixo).toEqual(["LAZER", "COMPRAS"]);
  });

  it("travas que não cabem são soltas, e tudo escala", () => {
    const r = fecharExato(1000, { MORADIA: 2000, LAZER: 500 }, ["MORADIA"]);
    expect(soma(r.val)).toBe(1000);
  });

  it("sem base nenhuma divide por igual e ainda fecha", () => {
    const r = fecharExato(1001, { A: 0, B: 0, C: 0 });
    expect(soma(r.val)).toBe(1001);
  });

  it("nada para dividir: tudo zero", () => {
    expect(soma(fecharExato(0, { A: 100, B: 50 }).val)).toBe(0);
  });
});

import { divisaoDoGuardar, porcentagensQueSomam100 } from "../fechar-plano";

describe("a regra do guardar", () => {
  it("18% de 7.700: 10% liberdade financeira e 8% sonhos", () => {
    const guardar = Math.round(7700 * 0.18);
    expect(divisaoDoGuardar(7700, guardar)).toEqual({ liberdade: 770, sonhos: 616 });
  });
  it("guardando menos que 10%, tudo vai para a liberdade", () => {
    expect(divisaoDoGuardar(5000, 300)).toEqual({ liberdade: 300, sonhos: 0 });
  });
  it("as porcentagens da legenda somam 100", () => {
    expect(porcentagensQueSomam100([1, 1, 1]).reduce((s, v) => s + v, 0)).toBe(100);
    expect(porcentagensQueSomam100([0, 0])).toEqual([0, 0]);
  });
});
