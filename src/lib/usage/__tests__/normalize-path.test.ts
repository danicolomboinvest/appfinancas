import { describe, expect, it } from "vitest";
import { normalizeUsagePath } from "../normalize-path";

describe("normalizeUsagePath", () => {
  it("agrega rotas com ano/mês num padrão só", () => {
    expect(normalizeUsagePath("/mensal/2026/8")).toBe("/mensal/[ano]/[mes]");
    expect(normalizeUsagePath("/mensal/2026/12")).toBe("/mensal/[ano]/[mes]");
    expect(normalizeUsagePath("/mensal/2026")).toBe("/mensal/[ano]");
    expect(normalizeUsagePath("/orcamento/2026")).toBe("/orcamento/[ano]");
    expect(normalizeUsagePath("/orcamento/comparativo/2027")).toBe("/orcamento/comparativo/[ano]");
  });

  it("esconde ids de fichas e metas", () => {
    expect(normalizeUsagePath("/fichas/acoes/cms3orpih000110sjghmnqm0m")).toBe("/fichas/acoes/[id]");
    expect(normalizeUsagePath("/fichas/fiis/abc-qualquer")).toBe("/fichas/fiis/[id]");
    expect(normalizeUsagePath("/planejamento/metas/cmsd1i8xg000110mq82dq1g3z")).toBe("/planejamento/metas/[id]");
  });

  it("rotas simples passam intactas", () => {
    expect(normalizeUsagePath("/dashboard")).toBe("/dashboard");
    expect(normalizeUsagePath("/viagem")).toBe("/viagem");
    expect(normalizeUsagePath("/planejamento/metas")).toBe("/planejamento/metas");
    expect(normalizeUsagePath("/simuladores/financiar-vs-alugar")).toBe("/simuladores/financiar-vs-alugar");
  });

  it("remove query string, hash e barra final", () => {
    expect(normalizeUsagePath("/mensal/2026/8?view=anual")).toBe("/mensal/[ano]/[mes]");
    expect(normalizeUsagePath("/dashboard#topo")).toBe("/dashboard");
    expect(normalizeUsagePath("/carteira/")).toBe("/carteira");
    expect(normalizeUsagePath("/")).toBe("/");
  });

  it("rota futura com id desconhecido: só o segmento-id vira marcador", () => {
    expect(normalizeUsagePath("/nova-area/cms3dr53m000010s2pb3ie8oo/detalhe")).toBe("/nova-area/[id]/detalhe");
    expect(normalizeUsagePath("/algo/123456")).toBe("/algo/[id]");
  });

  it("limita o tamanho pra rota estranha não virar lixo", () => {
    expect(normalizeUsagePath("/" + "x".repeat(500)).length).toBeLessThanOrEqual(120);
  });
});
