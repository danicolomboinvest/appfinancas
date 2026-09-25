import { describe, expect, it } from "vitest";
import { monthlyRecapEmail, monthlyNudgeEmail } from "../templates";
import { vozDoTema } from "@/lib/profiles/voice";

const padrao = vozDoTema("padrao").titulos;
const girly = vozDoTema("girly").titulos;
const disciplina = vozDoTema("disciplina").titulos;

const baseRecap = {
  name: "Dani",
  monthLabel: "setembro de 2026",
  income: 5000,
  expense: 3000,
  investment: 500,
  balance: 1500,
  expenseDelta: -0.12,
  topCategory: { label: "Moradia", value: 1200 },
  currency: "BRL" as const,
  appUrl: "https://app.test/mensal/2026/9",
  preferencesUrl: "https://app.test/configuracoes/notificacoes",
};

const baseNudge = {
  name: "Dani",
  newMonthLabel: "outubro",
  appUrl: "https://app.test/mensal",
  preferencesUrl: "https://app.test/configuracoes/notificacoes",
};

describe("monthlyRecapEmail: cada tema fala diferente sobre o mesmo mês", () => {
  it("mantém exatamente as frases que o e-mail já tinha, no Padrão", () => {
    const { subject, html } = monthlyRecapEmail({ ...baseRecap, t: padrao });
    expect(subject).toBe("Seu resumo de setembro de 2026 está pronto");
    expect(html).toContain("Oi, Dani!");
    expect(html).toContain("Fechamos setembro de 2026. Veja como foi:");
    expect(html).toContain("Sobrou no mês");
    expect(html).toContain("Ver o mês completo");
  });

  it("o Girly e a Disciplina escrevem coisas diferentes pro mesmo mês", () => {
    const p = monthlyRecapEmail({ ...baseRecap, t: padrao });
    const g = monthlyRecapEmail({ ...baseRecap, t: girly });
    const d = monthlyRecapEmail({ ...baseRecap, t: disciplina });
    expect(new Set([p.subject, g.subject, d.subject]).size).toBe(3);
    expect(g.html).toContain("💕");
    expect(d.html).not.toContain("💕");
  });

  it("sem base de comparação (primeiro mês), cada tema ainda avisa isso, não quebra", () => {
    const { html } = monthlyRecapEmail({ ...baseRecap, expenseDelta: null, t: girly });
    expect(html).toContain(girly.emailRecapPrimeiroMes);
  });

  it("sem aporte no mês, a linha de aporte não aparece", () => {
    const { html } = monthlyRecapEmail({ ...baseRecap, investment: 0, t: padrao });
    expect(html).not.toContain(">Aportou<");
  });

  it("mês negativo mostra o rótulo de falta, não o de sobra", () => {
    const { html } = monthlyRecapEmail({ ...baseRecap, balance: -200, t: padrao });
    expect(html).toContain("Faltou no mês");
    expect(html).not.toContain("Sobrou no mês");
  });
});

describe("monthlyNudgeEmail: o convite pra quem não usou também muda de tom", () => {
  it("mantém as frases do Padrão", () => {
    const { subject, html } = monthlyNudgeEmail({ ...baseNudge, t: padrao });
    expect(subject).toBe("Bora organizar outubro?");
    expect(html).toContain("Anote um gasto de hoje");
    expect(html).toContain("Anotar meu primeiro gasto");
  });

  it("Disciplina convida diferente do Padrão", () => {
    const { subject, html } = monthlyNudgeEmail({ ...baseNudge, t: disciplina });
    expect(subject).toBe("Bora começar outubro?");
    expect(html).toContain("Registra um gasto agora");
  });
});
