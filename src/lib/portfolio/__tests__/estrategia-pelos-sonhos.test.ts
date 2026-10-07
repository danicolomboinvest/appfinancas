import { describe, expect, it } from "vitest";
import { estrategiaPelosSonhos, faixaDoSonho, perfilPeloComportamento, PERFIS_PRONTOS, type Sonho } from "../estrategia-pelos-sonhos";

const soma = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);
const sonho = (p: Partial<Sonho> & Pick<Sonho, "falta">): Sonho => ({ id: p.nome ?? "x", nome: "x", meses: null, tipo: "meta", ...p });

describe("faixa de cada sonho", () => {
  it("reserva é sempre curto prazo; o resto pelo prazo; sem data fica no meio", () => {
    expect(faixaDoSonho({ tipo: "reserva", meses: 120 })).toBe("curto");
    expect(faixaDoSonho({ tipo: "meta", meses: 12 })).toBe("curto");
    expect(faixaDoSonho({ tipo: "meta", meses: 36 })).toBe("medio");
    expect(faixaDoSonho({ tipo: "liberdade", meses: 300 })).toBe("longo");
    expect(faixaDoSonho({ tipo: "meta", meses: null })).toBe("medio");
  });
});

describe("estratégia pelos sonhos", () => {
  it("sem sonho com valor faltando, é o perfil pronto de sempre", () => {
    expect(estrategiaPelosSonhos("moderado", []).valores).toEqual(PERFIS_PRONTOS.moderado);
    expect(estrategiaPelosSonhos("arrojado", [sonho({ falta: 0, meses: 12 })]).valores).toEqual(PERFIS_PRONTOS.arrojado);
  });

  it("só sonhos de curto prazo: tudo seguro e à mão, qualquer que seja o perfil", () => {
    const r = estrategiaPelosSonhos("arrojado", [sonho({ falta: 10_000, meses: 10 }), sonho({ tipo: "reserva", falta: 5_000, meses: 0 })]);
    expect(r.valores.RENDA_FIXA_POS_FIXADA).toBe(100);
    expect(r.faixas.map((f) => f.faixa)).toEqual(["curto"]);
  });

  it("mistura pesada pelo que falta em cada faixa, e sempre fecha 100", () => {
    const r = estrategiaPelosSonhos("moderado", [
      sonho({ nome: "Viagem", falta: 20_000, meses: 12 }),
      sonho({ nome: "Liberdade", tipo: "liberdade", falta: 80_000, meses: 300 }),
    ]);
    expect(soma(r.valores)).toBe(100);
    // 20% curto (100% pós) + 80% longo (moderado, 25% pós) = 40% pós.
    expect(r.valores.RENDA_FIXA_POS_FIXADA).toBe(40);
    expect(r.valores.ACOES_BRASIL).toBe(16);
  });

  it("arredonda sem perder ponto: três faixas iguais ainda somam 100", () => {
    const r = estrategiaPelosSonhos("arrojado", [
      sonho({ falta: 1, meses: 6 }),
      sonho({ falta: 1, meses: 40 }),
      sonho({ falta: 1, meses: 200 }),
    ]);
    expect(soma(r.valores)).toBe(100);
  });
});

describe("perfil pelo comportamento", () => {
  it("quem venderia tudo numa queda é conservadora, mesmo com experiência", () => {
    expect(perfilPeloComportamento({ queda: 0, experiencia: 2 }).profile).toBe("conservador");
  });
  it("quem nunca investiu em renda variável começa no máximo moderada", () => {
    expect(perfilPeloComportamento({ queda: 2, experiencia: 0 }).profile).toBe("moderado");
  });
  it("calma na queda e experiência: arrojada", () => {
    expect(perfilPeloComportamento({ queda: 2, experiencia: 1 }).profile).toBe("arrojado");
  });
  it("segura tensa: moderada", () => {
    expect(perfilPeloComportamento({ queda: 1, experiencia: 2 }).profile).toBe("moderado");
  });
});
