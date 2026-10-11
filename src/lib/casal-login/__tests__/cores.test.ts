import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { contraste, todasAsCores } from "../cores";

/** Matiz (0 a 360) e saturação (0 a 1) de uma cor, para reconhecer laranja. */
function matizESaturacao(hex: string): [number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return [(h + 360) % 360, s];
}

describe("as cores das duas pessoas do casal", () => {
  it("a letra dentro de cada bolinha tem contraste AA (4,5:1) em todo tema e modo", () => {
    for (const { tema, escuro, cores } of todasAsCores()) {
      expect(contraste(cores.titular, cores.titularTinta), `${tema} ${escuro ? "escuro" : "claro"} titular`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cores.par, cores.parTinta), `${tema} ${escuro ? "escuro" : "claro"} par`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("as duas pessoas se distinguem uma da outra", () => {
    for (const { cores } of todasAsCores()) expect(cores.titular.toLowerCase()).not.toBe(cores.par.toLowerCase());
  });

  it("no Titânio não tem laranja: o titular é o champanhe e o par é o azul acinzentado", () => {
    const titanio = todasAsCores().filter((c) => c.tema === "titanio");
    expect(titanio.map((c) => c.cores.titular.toLowerCase()).sort()).toEqual(["#5f4520", "#d8bc88"].sort());
    for (const { cores } of titanio) {
      for (const cor of [cores.titular, cores.par]) {
        const [h, s] = matizESaturacao(cor);
        // Laranja: matiz entre 10 e 35 graus e bem saturado (o champanhe fica perto de 38 e com pouca saturação).
        expect(h >= 10 && h <= 35 && s > 0.55, `${cor} parece laranja`).toBe(false);
      }
    }
  });

  it("nenhuma cor fixa de pessoa nas telas do Nós dois (vêm das variáveis do tema)", () => {
    const pasta = "src/components/casal-login";
    const achados: string[] = [];
    for (const f of readdirSync(pasta).filter((n) => n.endsWith(".tsx"))) {
      const linhas = readFileSync(join(pasta, f), "utf-8").split("\n");
      linhas.forEach((l, i) => {
        if (/^\s*(\/\/|\*)/.test(l)) return;
        // Só as reservas dentro de var(--casal-*, ...) podem ter hex; fora disso, nada de cor fixa.
        const semReserva = l.replace(/var\(--[a-z-]+,\s*#[0-9a-fA-F]{3,6}\)/g, "");
        if (/#[0-9a-fA-F]{6}\b|text-white|bg-white\b/.test(semReserva)) achados.push(`${f}:${i + 1}`);
      });
    }
    expect(achados).toEqual([]);
  });
});
