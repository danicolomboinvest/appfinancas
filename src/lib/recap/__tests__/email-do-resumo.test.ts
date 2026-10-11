import { describe, expect, it } from "vitest";
import { monthlyRecapEmail } from "@/lib/email/templates";
import { vozDoTema } from "@/lib/profiles/voice";
import { coresDoEmail } from "@/lib/email/blocos";
import { ajustarResumoPorEmail } from "../email-do-resumo";

/** O vermelho do "Faltou" é o do tema (o Girly tem o dele), nunca um vermelho genérico. */
const VERMELHO_GIRLY = coresDoEmail("girly").claro.danger;

/** Monta o e-mail do jeito que a rota monta, com o ajuste no meio. */
function emailDe(tema: string, valores: { income: number; expense: number; investment: number }, kind: string = "PESSOAL") {
  const base = vozDoTema(tema, kind).titulos;
  const { balance, t } = ajustarResumoPorEmail(base, valores, "setembro", kind === "EMPRESA");
  const { html, subject } = monthlyRecapEmail({
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
    tema,
  });
  return { html, subject, balance, t, base };
}

/** O herói: a palavra (Sobrou, Empatou, Faltou) e o valor grande (num-64). */
function valorGrande(html: string): string {
  const i = html.indexOf(`num-64"`);
  return html.slice(i - 700, i + 300);
}

describe("resumo por e-mail: sobrou = entrou − gastou − guardou, igual à tela", () => {
  it("os números de setembro da Ana: sobrou R$ 200, com as três linhas que fecham a conta", () => {
    const { html, subject, balance } = emailDe("padrao", { income: 7700, expense: 6600, investment: 900 });
    expect(balance).toBe(200);
    expect(subject).toBe("Sobrou R$ 200 em setembro");
    expect(valorGrande(html)).toMatch(/&nbsp;200</);
    expect(valorGrande(html)).toContain(">Sobrou<");
    expect(html).toMatch(/7\.700/);
    expect(html).toMatch(/6\.600/);
    expect(html).toContain("Guardou");
    expect(html).toMatch(/900/);
  });

  it("guardou mais do que sobrou dos gastos: é 'faltou', sem sinal de menos", () => {
    const { html, subject, balance } = emailDe("girly", { income: 5000, expense: 3000, investment: 2500 });
    expect(balance).toBe(-500);
    expect(subject).toBe("Faltou R$ 500 em setembro");
    expect(valorGrande(html)).toContain(">Faltou<");
    expect(valorGrande(html)).toContain(VERMELHO_GIRLY);
    expect(valorGrande(html)).not.toMatch(/[−-]\s*R\$/);
  });

  it("zero é 'empatou'", () => {
    const { html, subject, balance } = emailDe("padrao", { income: 4000, expense: 3000, investment: 1000 });
    expect(balance).toBe(0);
    expect(subject).toBe("Empatou em setembro");
    expect(valorGrande(html)).toContain(">Empatou<");
    expect(html).not.toContain("Faltou");
  });

  it("a linha do guardado aparece mesmo com zero: a conta fecha", () => {
    const { html, t } = emailDe("padrao", { income: 4000, expense: 3000, investment: 0 });
    expect(html).toContain(`>${t.aportou}<`);
    expect(valorGrande(html)).toContain(">Sobrou<");
  });

  it("o botão fala do fechamento do mês, no tom do tema", () => {
    expect(emailDe("girly", { income: 1, expense: 0, investment: 0 }).t.emailRecapBotao).toBe("Fechar setembro comigo");
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
