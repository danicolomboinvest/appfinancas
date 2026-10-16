import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeMoneyFormatter } from "@/lib/money";
import type { JaGuarda } from "@/lib/planning/plano-da-meta";
import { JaGuardaCartao } from "../JaGuarda";

const fmt = makeMoneyFormatter("BRL");
const m = (v: number) => fmt(v, { round: Number.isInteger(Math.round(v * 100) / 100) });
const HOJE = new Date(2026, 9, 16, 12);
const j: JaGuarda = {
  total: 550,
  origem: "metas",
  pedemAsMetas: 550,
  semMeta: 0,
  trazivel: 300,
  fontes: [
    { id: "reserva", nome: "Reserva", foto: null, porMes: 250, reserva: true, mesesDeReserva: 0.3, podeTrazer: 0, travada: "reserva_curta", alvo: 24000, guardado: 1000, prazo: null, taxaAnual: 0.1 },
    { id: "viagem", nome: "Viagem", foto: "/fotos/metas/praia.jpg", porMes: 300, reserva: false, mesesDeReserva: null, podeTrazer: 300, travada: null, alvo: 6000, guardado: 1000, prazo: "2027-10", taxaAnual: 0.1 },
  ],
};
const html = (trazer: Record<string, number>, jj: JaGuarda = j) => renderToStaticMarkup(createElement(JaGuardaCartao, { j: jj, trazer, onTrazer: () => {}, hoje: HOJE, m })).replace(/ /g, " ");

describe("Você já guarda", () => {
  it("diz para onde vai, com a foto, e trava a Reserva curta numa linha", () => {
    const h = html({});
    expect(h).toContain("Você já guarda <span class=\"tabular-nums\">R$ 550</span> por mês");
    expect(h).toContain("R$ 250 por mês");
    expect(h).toContain('src="/fotos/metas/praia.jpg"');
    expect(h).toContain("A Reserva fica: ela ainda está com menos de 3 meses.");
    // Só a Viagem tem régua.
    expect(h.match(/type="range"/g)).toHaveLength(1);
    expect(h).toMatch(/<label for="trazer-viagem"[^>]*>Trazer para esta meta<\/label>/);
  });

  it("trazendo da Viagem: o por mês dela desce e diz quando ela chega", () => {
    const h = html({ viagem: 100 });
    expect(h).toContain("R$ 300 para <b class=\"font-semibold text-ink\">R$ 200</b> por mês");
    expect(h).toMatch(/\+R\$ 100<\/b> por mês para esta meta · Viagem passa para [a-z]{3}\/20\d\d/);
    expect(html({ viagem: 300 })).toContain("Viagem fica parada");
  });

  it("com o quanto guardar do orçamento: diz que as metas pedem mais do que ela guarda", () => {
    const h = html({}, { ...j, total: 550, origem: "orcamento", pedemAsMetas: 1558, semMeta: 0 });
    expect(h).toContain("Você guarda <span class=\"tabular-nums\">R$ 550</span> por mês");
    expect(h).toMatch(/Suas metas já pedem <span[^>]*>R\$ 1\.558<\/span> e você guarda <span[^>]*>R\$ 550<\/span>\./);
    const sobra = html({}, { ...j, total: 550, origem: "orcamento", pedemAsMetas: 300, semMeta: 250 });
    expect(sobra).not.toContain("Suas metas já pedem");
    expect(sobra).toContain("R$ 250 por mês sem meta");
  });

  it("dinheiro sem meta: aparece e já conta para esta meta", () => {
    const h = html({}, { total: 550, origem: "metas", pedemAsMetas: 0, semMeta: 550, trazivel: 0, fontes: [] });
    expect(h).toContain("R$ 550 por mês sem meta");
    expect(h).not.toContain('type="range"');
  });
});
