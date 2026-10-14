import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALLOWED_EVENTS } from "../eventos";

/** Todos os arquivos do app (fora os testes). */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "__tests__" ? [] : arquivos(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("eventos de uso aceitos", () => {
  it("todo trackEvent com nome escrito no código está na lista (fora dela vira 400 e o evento some)", () => {
    const fora: string[] = [];
    for (const arquivo of arquivos(join(process.cwd(), "src"))) {
      const texto = readFileSync(arquivo, "utf8");
      for (const m of texto.matchAll(/trackEvent\(\s*["'`]([^"'`]+)["'`]/g)) {
        const nome = m[1];
        // Nome montado com ${...}: confere cada valor possível do pedaço que varia.
        const nomes = nome.includes("${") ? ["empresa", "casal"].map((t) => nome.replace(/\$\{[^}]+\}/, t)) : [nome];
        for (const n of nomes) if (!ALLOWED_EVENTS.has(n)) fora.push(`${n} (${arquivo.split("/src/")[1]})`);
      }
    }
    expect(fora).toEqual([]);
  });
});
