import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { makeMoneyFormatter } from "@/lib/money";
import type { Coisinha } from "@/lib/planning/plano-da-meta";
import { ItemDaCoisinha } from "../ItemDaCoisinha";

const fmt = makeMoneyFormatter("BRL");
const m = (v: number) => fmt(v, { round: Number.isInteger(Math.round(v * 100) / 100) });
const ifood: Coisinha = { id: "delivery:ifood", tipo: "delivery", nome: "iFood", marca: "ifood", hoje: 390, para: 200, economia: 190, acao: "reduzir", nivel: 2, meses: 3, vezesPorMes: 9, ticket: 45, lojas: [], daCasa: false, raiox: null };
const max: Coisinha = { ...ifood, id: "assinatura:max", tipo: "assinatura", nome: "Max", marca: "hbomax", hoje: 29.9, para: 0, economia: 29.9, acao: "cancelar", nivel: 1, ticket: null, raiox: "max" };
const html = (c: Coisinha, on: boolean, valor: number) => renderToStaticMarkup(createElement(ItemDaCoisinha, { c, on, valor, economia: c.acao === "cancelar" ? c.hoje : c.hoje - valor, m, onToggle: () => {}, onValor: () => {} })).replace(/ /g, " ");

describe("a coisinha na tela do plano", () => {
  it("desmarcada: o botão para marcar, sem régua", () => {
    const h = html(ifood, false, 200);
    expect(h).toContain('aria-pressed="false"');
    expect(h).not.toContain('type="range"');
    expect(h).toContain("dia a dia");
    expect(h).toContain("hoje: 9 pedidos por mês");
  });

  it("marcada: a régua com rótulo, valor falado e a quantidade pelo ticket dela", () => {
    const h = html(ifood, true, 200);
    expect(h).toContain('aria-pressed="true"');
    expect(h).toMatch(/<label for="regua-delivery-ifood"[^>]*>Quanto quer gastar com iFood por mês\?<\/label>/);
    expect(h).toMatch(/type="range"[^>]*min="0"[^>]*max="39"/);
    expect(h).toContain('aria-valuetext="R$ 200 por mês, economiza R$ 190, dá uns 4 pedidos por mês"');
    expect(h).toContain("o seu custa uns R$ 45 · hoje: 9 pedidos por mês");
    expect(h).toContain("+R$ 190");
  });

  it("no limite: R$ 0, menos de 1 pedido e do jeito que está", () => {
    expect(html(ifood, true, 0)).toContain("nenhum pedido");
    expect(html(ifood, true, 20)).toContain("dá menos de 1 pedido por mês");
    expect(html(ifood, true, 390)).toContain("· do jeito que está");
  });

  it("assinatura: fica ou cancela, sem régua mesmo marcada", () => {
    const h = html(max, true, 0);
    expect(h).toContain("cancelar");
    expect(h).not.toContain('type="range"');
  });

  it("os textos das telas do plano seguem as regras: sem travessão, sem 'pra'", () => {
    for (const f of ["TelaDoPlano.tsx", "ItemDaCoisinha.tsx", "page.tsx", "TirarPlano.tsx", "../../BotaoDoPlano.tsx"]) {
      const src = readFileSync(join(__dirname, "..", f), "utf8");
      expect(src, f).not.toMatch(/[—–]/);
      expect(src, f).not.toMatch(/\bpra\b/);
    }
  });
});
