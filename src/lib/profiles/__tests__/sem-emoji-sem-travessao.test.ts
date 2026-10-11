import { describe, expect, it } from "vitest";
import { PROFILE_THEMES } from "../themes";
import { vozDoTema } from "../voice";

/**
 * Versão nova (11/10/2026): nenhum emoji e nenhum travessão no que o app escreve. Emoji fica só
 * no que a pessoa escreve (nome de categoria, descrição). O teste passa por TODO texto de toda
 * voz, nos quatro temas e nos três tipos de perfil, chamando as frases com argumentos de exemplo.
 */
const EMOJI = /\p{Extended_Pictographic}/u;
const TRAVESSAO = /[—–]/;

function textos(valor: unknown, caminho: string, saida: [string, string][], profundidade = 0): void {
  if (profundidade > 4) return;
  if (typeof valor === "string") {
    saida.push([caminho, valor]);
    return;
  }
  if (typeof valor === "function") {
    const exemplos: unknown[][] = [[], ["R$ 10", "R$ 20", "setembro", "MORADIA"], [10, 2, 3], ["bom", { resultado: 10, income: 100, expense: 50, money: (n: number) => `R$ ${n}` }], [true, true, "R$ 10"], ["pessoa"]];
    for (const args of exemplos) {
      try {
        textos((valor as (...a: unknown[]) => unknown)(...args), `${caminho}()`, saida, profundidade + 1);
      } catch {
        // Frase que precisa de outro formato de argumento: as outras tentativas cobrem.
      }
    }
    return;
  }
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => textos(v, `${caminho}[${i}]`, saida, profundidade + 1));
    return;
  }
  if (valor && typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) textos(v, `${caminho}.${k}`, saida, profundidade + 1);
  }
}

describe("sem emoji e sem travessão no que o app escreve", () => {
  for (const tema of PROFILE_THEMES) {
    for (const kind of ["PESSOAL", "CASAL", "EMPRESA"]) {
      it(`${tema.label} / ${kind}`, () => {
        const saida: [string, string][] = [];
        textos(vozDoTema(tema.key, kind), "voz", saida);
        expect(saida.length).toBeGreaterThan(500);
        const comEmoji = saida.filter(([, t]) => EMOJI.test(t)).map(([c, t]) => `${c}: ${t}`);
        const comTravessao = saida.filter(([, t]) => TRAVESSAO.test(t)).map(([c, t]) => `${c}: ${t}`);
        expect(comEmoji, "emoji").toEqual([]);
        expect(comTravessao, "travessão").toEqual([]);
      });
    }
  }
});
