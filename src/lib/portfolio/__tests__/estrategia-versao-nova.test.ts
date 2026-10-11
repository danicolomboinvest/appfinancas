import { describe, expect, it } from "vitest";
import {
  estrategiaDaVersaoNova,
  experienciaPelasEscolhas,
  liberdadeEmValorDeHoje,
  misturaDoLongo,
  perfilPeloComportamento,
  PERFIS_PRONTOS,
  type Sonho,
} from "../estrategia-pelos-sonhos";

const soma = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);

describe("estratégia da versão nova (3.13, rodadas 22 e 32)", () => {
  it("exterior pelo plano em outra moeda: Não 10%, Viajar 20%, Morar 30%, saindo metade de Ações e metade de FIIs", () => {
    expect(misturaDoLongo("moderado", "nao").EXTERIOR).toBe(10);
    const viajar = misturaDoLongo("moderado", "viajar");
    expect(viajar).toMatchObject({ EXTERIOR: 20, ACOES_BRASIL: 15, FIIS: 10 });
    const morar = misturaDoLongo("moderado", "morar");
    expect(morar).toMatchObject({ EXTERIOR: 30, ACOES_BRASIL: 10, FIIS: 5 });
    expect(soma(morar)).toBe(100);
  });

  it("conservadora leva metade do extra (Viajar 10%, Morar 15%), tirado do pós-fixado", () => {
    expect(misturaDoLongo("conservador", "viajar")).toMatchObject({ EXTERIOR: 10, RENDA_FIXA_POS_FIXADA: 40 });
    expect(misturaDoLongo("conservador", "morar")).toMatchObject({ EXTERIOR: 15, RENDA_FIXA_POS_FIXADA: 35, ACOES_BRASIL: 5, FIIS: 5 });
    expect(misturaDoLongo("conservador", "nao").EXTERIOR).toBe(5);
  });

  it("arrojada no 'Não' volta a 10% de exterior, devolvendo para Ações e FIIs", () => {
    const m = misturaDoLongo("arrojado", "nao");
    expect(m).toMatchObject({ EXTERIOR: 10, ACOES_BRASIL: 45, FIIS: 25 });
    expect(soma(m)).toBe(100);
  });

  it("proventos 'Sim': 5 pontos de Ações vão para FIIs no longo prazo", () => {
    expect(misturaDoLongo("moderado", "nao", "sim")).toMatchObject({ ACOES_BRASIL: 15, FIIS: 20 });
    expect(misturaDoLongo("moderado", "nao", "tanto")).toMatchObject(PERFIS_PRONTOS.moderado);
  });

  it("teto pela queda: quem venderia tudo é sempre conservadora, mesmo com experiência", () => {
    expect(perfilPeloComportamento({ queda: 0, experiencia: 2 }).profile).toBe("conservador");
    expect(perfilPeloComportamento({ queda: 1, experiencia: experienciaPelasEscolhas(["cdb", "acoes"]) }).profile).toBe("moderado");
  });

  it("fundo de renda fixa não conta como renda variável na experiência", () => {
    expect(experienciaPelasEscolhas(["fundorf", "cdb"])).toBe(0);
    expect(experienciaPelasEscolhas(["fundorv"])).toBe(2);
    expect(perfilPeloComportamento({ queda: 2, experiencia: experienciaPelasEscolhas(["fundorf"]) }).profile).toBe("moderado");
  });

  it("a Liberdade entra pelo valor de hoje: R$ 709.288 em 28 anos a 4,5% viram R$ 206.808", () => {
    expect(liberdadeEmValorDeHoje(709288, 28, 0.045)).toBe(206808);
    expect(liberdadeEmValorDeHoje(0, 28, 0.045)).toBe(0);
  });

  it("a mistura final soma 100 e a reserva fica toda em pós-fixado", () => {
    const sonhos: Sonho[] = [
      { id: "reserva", nome: "Reserva", falta: 16800, meses: 0, tipo: "reserva" },
      { id: "europa", nome: "Europa", falta: 18571, meses: 13, tipo: "meta" },
      { id: "carro", nome: "Carro", falta: 21700, meses: 36, tipo: "meta" },
      { id: "liberdade", nome: "Liberdade", falta: liberdadeEmValorDeHoje(709288, 28, 0.045), meses: 336, tipo: "liberdade" },
    ];
    const r = estrategiaDaVersaoNova("moderado", sonhos, "viajar", "sim");
    expect(soma(r.valores)).toBe(100);
    expect(r.faixas.map((f) => f.faixa)).toEqual(["curto", "medio", "longo"]);
    // Só a reserva: tudo pós-fixado.
    expect(estrategiaDaVersaoNova("arrojado", [sonhos[0]]).valores.RENDA_FIXA_POS_FIXADA).toBe(100);
  });
});
