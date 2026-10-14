import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { makeMoneyFormatter } from "@/lib/money";
import { mesAoTrocarDeAno, prazoJaPassou, valorDoLancamento } from "../visual";

/** QA de 14/10/2026 na área Metas: o calendário do "Para quando?" e os centavos dos lançamentos. */
const mi = (ano: number, mes1a12: number) => ano * 12 + (mes1a12 - 1);

describe("calendário do prazo", () => {
  it("em dezembro, o ano de hoje não tem mês que vale (antes caía em dezembro de hoje)", () => {
    const hoje = mi(2026, 12);
    expect(mesAoTrocarDeAno(2026, 5, hoje)).toBeNull();
    expect(mesAoTrocarDeAno(2027, 5, hoje)).toBe(5);
    expect(mesAoTrocarDeAno(2027, 0, hoje)).toBe(0);
  });

  it("voltar para o ano de hoje pula para o mês que vem quando o mês escolhido já passou", () => {
    const hoje = mi(2026, 10); // outubro
    expect(mesAoTrocarDeAno(2026, 2, hoje)).toBe(10); // março passou: novembro
    expect(mesAoTrocarDeAno(2026, 11, hoje)).toBe(11); // dezembro ainda vale
    expect(mesAoTrocarDeAno(2026, 9, hoje)).toBe(10); // outubro (hoje) não vale
    expect(mesAoTrocarDeAno(2025, 11, hoje)).toBeNull();
  });

  it("a meta que venceu pede prazo novo", () => {
    const hoje = mi(2026, 10);
    expect(prazoJaPassou({ ano: 2026, mes: 7 }, hoje)).toBe(true);
    expect(prazoJaPassou({ ano: 2026, mes: 9 }, hoje)).toBe(true);
    expect(prazoJaPassou({ ano: 2026, mes: 10 }, hoje)).toBe(false);
  });

  it("a folha trava o Continuar no prazo vencido e usa o calendário novo", () => {
    const fonte = readFileSync(join(__dirname, "..", "FolhaDaMeta.tsx"), "utf8");
    expect(fonte).toMatch(/podeSeguir = !vencido/);
    expect(fonte).toMatch(/Esse prazo já passou/);
    expect(fonte).not.toMatch(/Math\.min\(11, hoje\.mes\)/);
  });
});

describe("lançamentos da meta mostram os centavos que ela digitou", () => {
  const money = makeMoneyFormatter("BRL");
  const limpo = (s: string) => s.replace(/\s/g, " ");
  it("1.000,01 aparece com centavos; 600 continua redondo", () => {
    expect(limpo(valorDoLancamento(money, 1000.01))).toBe("R$ 1.000,01");
    expect(limpo(valorDoLancamento(money, 250.75))).toBe("R$ 250,75");
    expect(limpo(valorDoLancamento(money, 600))).toBe("R$ 600");
    expect(limpo(valorDoLancamento(money, -34.56))).toMatch(/34,56/);
  });
});

describe("a guia do Money Reset acha o Nova meta", () => {
  it("o botão grande tem o data-guia que a aula 11 procura", () => {
    const pagina = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
    const guias = readFileSync(join(__dirname, "..", "..", "..", "..", "..", "lib", "money-reset", "guias.ts"), "utf8");
    expect(guias).toMatch(/data-guia="nova-meta"/);
    expect(pagina).toMatch(/<AbrirFolhaDaMeta guia="nova-meta"/);
  });
});

describe("aporte e adicionar têm Cancelar", () => {
  it.each([["CartaoDoAporte.tsx", "setForm(null)"], ["AcoesDaMeta.tsx", "setTipo(null)"]])("%s", (arquivo, acao) => {
    const fonte = readFileSync(join(__dirname, "..", "[id]", arquivo), "utf8");
    expect(fonte).toContain(acao);
    expect(fonte).toMatch(/>\s*Cancelar\s*</);
  });
});
