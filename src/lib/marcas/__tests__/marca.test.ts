import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MARCAS } from "../catalogo";
import { marcaDaDescricao, normalizarDescricao } from "../marca";

const slug = (d: string | null) => marcaDaDescricao(d)?.slug ?? null;

describe("logo real da marca pela descrição do extrato", () => {
  it("acha as marcas do jeito que vêm no extrato", () => {
    expect(slug("IFOOD *RESTAURANTE SABOR")).toBe("ifood");
    expect(slug("NETFLIX.COM")).toBe("netflix");
    expect(slug("UBER *TRIP HELP.UBER.COM")).toBe("uber");
    expect(slug("Spotify")).toBe("spotify");
    expect(slug("Vivo Fibra")).toBe("vivo");
    expect(slug("Drogasil")).toBe("drogasil");
    expect(slug("Smart Fit")).toBe("smartfit");
    expect(slug("Pag*MercadoLivre")).toBe("mercadolivre");
    expect(slug("Amil")).toBe("amil");
    expect(slug("Enel")).toBe("enel");
    expect(slug("C&A Modas")).toBe("cea");
  });

  it("o apelido mais comprido ganha e as genéricas ficam por último", () => {
    expect(slug("Amazon Prime Video")).toBe("amazonprime");
    expect(slug("AMAZON MARKETPLACE")).toBe("amazon");
    expect(slug("Pix enviado Mercado Livre")).toBe("mercadolivre");
    expect(slug("Pix enviado Maria Souza")).toBe("pix");
  });

  it("palavra inteira: nada de falso positivo com palavra comum", () => {
    expect(slug("Internet fibra")).toBeNull();
    expect(slug("Oi, tudo bem")).toBeNull();
    expect(slug("Dia das crianças")).toBeNull();
    expect(slug("Hora extra")).toBeNull();
    expect(slug("Luz light")).toBeNull();
    expect(slug("Gasto do dia 99")).toBeNull();
    expect(slug("Céu azul")).toBeNull();
    expect(slug("VOEAZUL 1234")).toBe("azul");
  });

  it("sem marca conhecida (Pão de Açúcar não tem logo limpo) devolve null: a tela mostra o ícone da categoria", () => {
    expect(slug("Pão de Açúcar")).toBeNull();
    expect(slug("Aluguel")).toBeNull();
    expect(slug("")).toBeNull();
    expect(slug(null)).toBeNull();
  });

  it("normaliza acento, maiúscula e pontuação", () => {
    expect(normalizarDescricao("Pão de Açúcar - LJ 12")).toBe("pao de acucar lj 12");
  });

  it("todo logo do catálogo existe em public, com cor oficial em hexadecimal", () => {
    for (const m of MARCAS) {
      expect(existsSync(`public/brand/marcas/${m.arquivo}`), m.slug).toBe(true);
      expect(m.cor, m.slug).toMatch(/^#[0-9a-f]{6}$/i);
      expect(m.apelidos.length, m.slug).toBeGreaterThan(0);
    }
    // O "Max (errado)" do estudo não entra.
    expect(MARCAS.some((m) => m.slug === "max")).toBe(false);
  });
});
