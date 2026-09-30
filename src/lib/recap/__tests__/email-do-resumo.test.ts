import { describe, expect, it } from "vitest";
import { monthlyRecapEmail } from "@/lib/email/templates";
import { vozDoTema } from "@/lib/profiles/voice";
import { ajustarResumoPorEmail } from "../email-do-resumo";

const VERMELHO = "#c0523c";

/** Monta o e-mail do jeito que a rota monta, com o ajuste no meio. */
function emailDe(tema: string, valores: { income: number; expense: number; investment: number }, kind: string = "PESSOAL") {
  const base = vozDoTema(tema, kind).titulos;
  const { balance, t } = ajustarResumoPorEmail(base, valores, "setembro", kind === "EMPRESA");
  const { html } = monthlyRecapEmail({
    name: "Ana",
    monthLabel: "setembro de 2026",
    currency: "BRL",
    ...valores,
    balance,
    expenseDelta: null,
    topCategory: null,
    appUrl: "https://app/mensal/foco/fechamento",
    preferencesUrl: "https://app/configuracoes/notificacoes",
    t,
  });
  return { html, balance, t, base };
}

/** O bloco do valor grande (o primeiro número do e-mail, 30px). */
function valorGrande(html: string): string {
  const i = html.indexOf("font-size:30px");
  return html.slice(i - 20, i + 200);
}

describe("resumo por e-mail: guardar não vira 'faltou'", () => {
  it("quem guardou mais do que sobrou não recebe 'Faltou no mês' em vermelho", () => {
    // Ganhou 5.000, gastou 3.000, guardou 2.500. Antes: 5.000 − 3.000 − 2.500 = "Faltou R$ 500".
    const { html, balance } = emailDe("girly", { income: 5000, expense: 3000, investment: 2500 });
    expect(balance).toBe(2000);
    expect(html).not.toContain("Faltou");
    expect(valorGrande(html)).not.toContain(VERMELHO);
    expect(html).toContain("Sobrou depois dos gastos 💖");
    // O guardado aparece como conquista, com o valor.
    expect(html).toContain("E ainda guardou 🐷✨");
    expect(html).toMatch(/2\.500/);
  });

  it("gastou mais do que entrou: aí sim é 'faltou', e o guardado continua aparecendo", () => {
    const { html, balance } = emailDe("padrao", { income: 3000, expense: 3500, investment: 200 });
    expect(balance).toBe(-500);
    expect(html).toContain("Faltou no mês");
    expect(html).toContain("E você ainda guardou");
  });

  it("sem nada guardado, o rótulo do tema continua o de sempre", () => {
    const { html, t, base } = emailDe("girly", { income: 4000, expense: 3000, investment: 0 });
    expect(html).toContain(base.emailRecapSobrou);
    expect(t.aportou).toBe(base.aportou);
  });

  it("o botão fala do fechamento do mês, no tom do tema", () => {
    expect(emailDe("girly", { income: 1, expense: 0, investment: 0 }).t.emailRecapBotao).toBe("Fechar setembro comigo 💕");
    expect(emailDe("padrao", { income: 1, expense: 0, investment: 0 }).t.emailRecapBotao).toBe("Fechar setembro");
  });

  it("perfil Empresa mantém o termo de negócio na linha do guardado", () => {
    const { t, base } = emailDe("padrao", { income: 10000, expense: 6000, investment: 1000 }, "EMPRESA");
    expect(t.aportou).toBe(base.aportou);
    expect(t.aportou).toBe("Reteve");
  });

  it("não altera o catálogo do tema (a troca vale só pra este e-mail)", () => {
    const antes = vozDoTema("girly").titulos.emailRecapSobrou;
    emailDe("girly", { income: 5000, expense: 3000, investment: 2500 });
    expect(vozDoTema("girly").titulos.emailRecapSobrou).toBe(antes);
  });
});
