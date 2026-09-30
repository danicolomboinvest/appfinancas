import { describe, expect, it } from "vitest";
import { MORE_NAV_SECTIONS, NAV_SECTIONS, abasDoCelular, secoesDoMais } from "../nav-sections";

/**
 * A barra de baixo e o "Mais" de quem tem e de quem não tem a área paga. A regra que importa:
 * toda seção aparece em EXATAMENTE um dos dois lugares no celular. Se a Carteira sumisse dos
 * dois, ou a Visão Geral ficasse nos dois, alguém ia ficar sem achar a tela (ou com o "Mais"
 * aceso junto com uma aba).
 */

const bases = (lista: { basePath: string }[]) => lista.map((x) => x.basePath);

describe("barra de baixo e Mais conforme o acesso", () => {
  it("com a área paga: a barra de sempre, com a Carteira", () => {
    expect(bases(abasDoCelular(true))).toEqual(["/mensal", "/planejamento", "/carteira"]);
    expect(bases(secoesDoMais(true))).not.toContain("/carteira");
    expect(secoesDoMais(true)).toEqual(MORE_NAV_SECTIONS);
  });

  it("sem a área paga: a Carteira sai da barra e vai pro Mais; a Visão Geral faz o caminho inverso", () => {
    const abas = bases(abasDoCelular(false));
    expect(abas).toEqual(["/mensal", "/planejamento", "/dashboard"]);
    expect(abas).toHaveLength(3); // o "+" continua no meio da barra
    const mais = bases(secoesDoMais(false));
    expect(mais).toContain("/carteira");
    expect(mais).not.toContain("/dashboard");
    // A Carteira do Mais é a seção premium de verdade: é ela que ganha o cadeado.
    expect(secoesDoMais(false).find((s) => s.basePath === "/carteira")?.premium).toBe(true);
  });

  it("em qualquer caso, cada seção fica em um lugar só (barra OU Mais)", () => {
    for (const premium of [true, false]) {
      const abas = bases(abasDoCelular(premium));
      const mais = bases(secoesDoMais(premium));
      for (const secao of bases(NAV_SECTIONS)) {
        const lugares = Number(abas.includes(secao)) + Number(mais.includes(secao));
        expect({ secao, premium, lugares }).toEqual({ secao, premium, lugares: 1 });
      }
    }
  });
});
