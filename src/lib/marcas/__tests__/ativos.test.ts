import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { arquivoDoAtivo, logoDoAtivo } from "../ativos";
import { TICKERS_COM_LOGO } from "../ativos-lista";
import { MARCAS } from "../catalogo";

const PUBLIC = join(__dirname, "..", "..", "..", "..", "public");

describe("logos dos ativos", () => {
  it("todo ticker da lista tem arquivo, e todo arquivo é um SVG de verdade, pequeno e sem script", () => {
    for (const t of TICKERS_COM_LOGO) {
      const f = join(PUBLIC, "logos", "ativos", `${t}.svg`);
      expect(existsSync(f), t).toBe(true);
      const s = readFileSync(f, "utf8");
      expect(s.trimStart().startsWith("<svg"), t).toBe(true);
      expect(s.length, t).toBeLessThan(60_000);
      expect(/<script|\son\w+=/i.test(s), t).toBe(false);
    }
  });

  it("nenhum arquivo solto sem estar no mapa", () => {
    const usados = new Set([...TICKERS_COM_LOGO.map((t) => `${t}.svg`), "invesco.webp", "schwab.webp"]);
    const soltos = readdirSync(join(PUBLIC, "logos", "ativos")).filter((f) => !usados.has(f));
    expect(soltos).toEqual([]);
  });

  it("ticker da B3 usa o ícone dele; ação americana usa o do BDR da mesma empresa", () => {
    expect(arquivoDoAtivo("bbas3")).toBe("/logos/ativos/BBAS3.svg");
    expect(arquivoDoAtivo("MXRF11")).toBe("/logos/ativos/MXRF11.svg");
    expect(arquivoDoAtivo("AAPL")).toBe("/logos/ativos/AAPL34.svg");
    for (const t of ["AAPL", "NVDA", "IVV", "QQQ", "SCHD", "NU"]) {
      const src = arquivoDoAtivo(t)!;
      expect(existsSync(join(PUBLIC, src)), t).toBe(true);
    }
  });

  it("sem ícone: a marca pelo nome, e por fim as letras na cor da gestora ou do tema", () => {
    expect(logoDoAtivo(null, "CDB Banco Inter 105% CDI")).toMatchObject({ tipo: "marca", marca: { slug: "inter" } });
    expect(logoDoAtivo("VOO")).toEqual({ tipo: "letras", texto: "VOO", cor: "#96151D" });
    expect(logoDoAtivo("ZZZZ3")).toEqual({ tipo: "letras", texto: "ZZZZ", cor: null });
  });

  it("o Banco do Brasil vem com o símbolo, não com o nome por extenso", () => {
    const bb = MARCAS.find((m) => m.slug === "bancodobrasil")!;
    expect(bb.arquivo).toBe("bancodobrasil-simbolo.svg");
    expect(bb.cheio).toBe(true);
  });

  it("toda marca do catálogo tem o arquivo em public/brand/marcas", () => {
    for (const m of MARCAS) expect(existsSync(join(PUBLIC, "brand", "marcas", m.arquivo)), m.slug).toBe(true);
  });
});
