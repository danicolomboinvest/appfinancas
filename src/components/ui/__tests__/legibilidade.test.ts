import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Trava de legibilidade: o público do app tem muita gente com vista cansada, e textos de 9–11px
 * tinham se espalhado por 24 arquivos (a barra de baixo inteira era 10px). Este teste impede
 * que voltem sem ninguém perceber.
 */

const RAIZ = join(__dirname, "..", "..", "..", "..");
const PASTAS = ["src/app", "src/components"];

function arquivosTsx(pasta: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === "__tests__" || nome === "node_modules") continue;
      saida.push(...arquivosTsx(caminho));
    } else if (/\.(tsx|ts)$/.test(nome)) {
      saida.push(caminho);
    }
  }
  return saida;
}

/**
 * Onde 11px ainda é aceito: telas internas da Dani (admin) e peças que desenham o TEMA
 * (a prévia em miniatura dos temas e o herói do Game/Manifestação), que vão ser revistas junto
 * com o redesenho dos temas. Todo o resto (barra de baixo, listas, chips) é 12px no mínimo.
 */
const PODE_11PX = [/\/admin\//, /ThemeHero\.tsx$/, /EscolhaInicial\.tsx$/, /ProfilesManager\.tsx$/];

const arquivos = PASTAS.flatMap((p) => arquivosTsx(join(RAIZ, p))).map((a) => relative(RAIZ, a));

function ocorrencias(regex: RegExp, filtro: (arquivo: string) => boolean = () => true): string[] {
  const achados: string[] = [];
  for (const arquivo of arquivos.filter(filtro)) {
    readFileSync(join(RAIZ, arquivo), "utf8")
      .split("\n")
      .forEach((linha, i) => {
        if (regex.test(linha)) achados.push(`${arquivo}:${i + 1}`);
      });
  }
  return achados;
}

describe("legibilidade", () => {
  it("nenhum texto abaixo de 11px em lugar nenhum", () => {
    expect(ocorrencias(/text-\[(\d|10)(\.\d+)?px\]/)).toEqual([]);
  });

  it("telas do dia a dia têm texto de 12px no mínimo (11px só no admin e nas peças de tema)", () => {
    expect(ocorrencias(/text-\[11(\.\d+)?px\]/, (a) => !PODE_11PX.some((r) => r.test(a)))).toEqual([]);
  });

  it("o app não dá zoom: nem pinça, nem duplo toque (a Dani quer o app parado, 01/10/2026)", () => {
    const layout = readFileSync(join(RAIZ, "src/app/layout.tsx"), "utf8");
    expect(layout).toMatch(/maximumScale\s*:\s*1\b/);
    expect(layout).toMatch(/userScalable\s*:\s*false/);
    const css = readFileSync(join(RAIZ, "src/app/globals.css"), "utf8");
    expect(css).toMatch(/touch-action:\s*pan-x pan-y\s*;/);
  });
});
